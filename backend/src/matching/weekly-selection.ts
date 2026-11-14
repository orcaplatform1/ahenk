import { BadRequestException, Body, ConflictException, Controller, Get, Injectable, Post, Req, UseGuards } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { Request } from "express";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum } from "class-validator";
import { MeetingType, Prisma, SubscriptionStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { activeKankaLink } from "../kanka/kanka-links";
import { groupPartOpen, kankaPartOpen, oneOnOnePartOpen, RIGHTS_SELECT } from "../payment/package-rights";
import { ASSIGN_QUEUE, enqueueAssign } from "./assign-queue";

// Haftalık buluşma seçimi: Pazar 23:59'dan sonra (yeni ISO hafta, TR saati) paketi olan kullanıcıya Eşleşme Paneli /
// Masalarım'da pencere açılır; paketinde kalan türlerden bu hafta hangilerine gireceğini seçer (1, 2 ya da 3 tür).
// Sistem kimseyi taramaya otomatik sokmaz: yalnız seçilen türlerin taramasına girilir. Seçim tek seferdir, değiştirilemez.
// Son saatler (TR): Grup Perşembe 18:00, Başbaşa Cuma 18:00, Kankamla Cumartesi 18:00. Seçilmeyen türün hakkı düşmez.
export const SELECTION_DEADLINE: Record<MeetingType, { day: number; minutes: number }> = {
  [MeetingType.GROUP]: { day: 4, minutes: 18 * 60 },
  [MeetingType.ONE_ON_ONE]: { day: 5, minutes: 18 * 60 },
  [MeetingType.KANKA]: { day: 6, minutes: 18 * 60 },
};

const TR_OFFSET_MS = 3 * 60 * 60 * 1000;

// ISO hafta (TR saati, Pazartesi başlangıç) — matching.service ile aynı hesap
export function trIsoWeekOf(date: Date): { week: number; year: number } {
  const tr = new Date(date.getTime() + TR_OFFSET_MS);
  const d = new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7), year: d.getUTCFullYear() };
}

// Bu haftanın son seçim anı (UTC)
export function deadlineOf(type: MeetingType, now = new Date()): Date {
  const tr = new Date(now.getTime() + TR_OFFSET_MS);
  const isoDay = tr.getUTCDay() || 7; // Pazartesi 1 … Pazar 7
  const monday = Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()) - (isoDay - 1) * 86400000;
  const dl = SELECTION_DEADLINE[type];
  return new Date(monday + (dl.day - 1) * 86400000 + dl.minutes * 60000 - TR_OFFSET_MS);
}

// Havuz sorgularına eklenir: kişi bu hafta bu türü seçmiş olmalı
export function selectedThisWeek(type: MeetingType, now = new Date()): Prisma.UserWhereInput {
  const { week, year } = trIsoWeekOf(now);
  return { weeklySelections: { some: { year, weekNumber: week, type } } };
}

class SubmitSelectionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsEnum(MeetingType, { each: true })
  types: MeetingType[];
}

@Injectable()
export class WeeklySelectionService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue(ASSIGN_QUEUE) private assignQueue: Queue,
  ) {}

  // Paketinde hakkı kalan türler (Kankamla: kişinin kendi açık hakkı ve aktif kankası olmalı)
  private async availableTypes(userId: string): Promise<MeetingType[]> {
    const subs = await this.prisma.subscription.findMany({ where: { userId, status: SubscriptionStatus.ACTIVE }, select: RIGHTS_SELECT });
    const types: MeetingType[] = [];
    if (subs.some(groupPartOpen)) types.push(MeetingType.GROUP);
    if (subs.some(oneOnOnePartOpen)) types.push(MeetingType.ONE_ON_ONE);
    if (subs.some(kankaPartOpen) && (await activeKankaLink(this.prisma, userId))) types.push(MeetingType.KANKA);
    return types;
  }

  async state(userId: string) {
    const now = new Date();
    const { week, year } = trIsoWeekOf(now);
    const [available, selected] = await Promise.all([
      this.availableTypes(userId),
      this.prisma.weeklySelection.findMany({ where: { userId, year, weekNumber: week }, select: { type: true } }),
    ]);
    const options = available.map((type) => {
      const deadline = deadlineOf(type, now);
      return { type, deadline, open: now < deadline };
    });
    const submitted = selected.length > 0;
    return {
      year, week, submitted,
      selected: selected.map((s) => s.type),
      options,
      // Pencere: paketi olan, bu hafta henüz seçim yapmamış ve süresi geçmemiş türü olan kullanıcıya açılır
      showModal: !submitted && options.some((o) => o.open),
    };
  }

  async submit(userId: string, types: MeetingType[]) {
    const now = new Date();
    const { week, year } = trIsoWeekOf(now);
    const unique = [...new Set(types)];
    const available = await this.availableTypes(userId);
    for (const t of unique) {
      if (!available.includes(t)) throw new BadRequestException("Paketinde bu buluşma türünün hakkı yok.");
      if (now >= deadlineOf(t, now)) throw new BadRequestException("Bu buluşma türü için seçim süresi doldu.");
    }
    const done = await this.prisma.weeklySelection.count({ where: { userId, year, weekNumber: week } });
    if (done > 0) throw new ConflictException("Bu haftanın seçimini zaten yaptın; seçim değiştirilemez.");
    await this.prisma.weeklySelection.createMany({
      data: unique.map((type) => ({ userId, year, weekNumber: week, type })),
      skipDuplicates: true,
    });
    // Seçilen türlerin taramasına girer
    await enqueueAssign(this.assignQueue, userId);
    return this.state(userId);
  }
}

@Controller("weekly-selection")
@UseGuards(JwtAuthGuard)
export class WeeklySelectionController {
  constructor(private service: WeeklySelectionService) {}

  @Get()
  get(@Req() req: Request) {
    return this.service.state((req.user as { id: string }).id);
  }

  @Post()
  submit(@Req() req: Request, @Body() dto: SubmitSelectionDto) {
    return this.service.submit((req.user as { id: string }).id, dto.types);
  }
}
