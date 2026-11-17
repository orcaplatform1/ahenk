import { BadRequestException, Body, ConflictException, Controller, Get, Injectable, Post, Req, UseGuards } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { Request } from "express";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum } from "class-validator";
import { MeetingMode, MeetingType, SubscriptionStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { activeKankaLink } from "../kanka/kanka-links";
import { groupPartOpen, kankaPartOpen, oneOnOnePartOpen, RIGHTS_SELECT } from "../payment/package-rights";
import { meetingLockAt, tomorrowMeetingAt } from "../meetings/meeting-windows";
import { ASSIGN_QUEUE, enqueueAssign } from "./assign-queue";
import {
  activeSelectionWhere, cancelSelection, deadlineOf, plannedTargetWeek, seatWhere, SelectionDeps, trIsoWeekOf,
} from "./selection-cancel";

export { deadlineOf, selectedThisWeek, trIsoWeekOf, SELECTION_DEADLINE } from "./selection-cancel";

// Seçim ekranı (web + mobil): "Buluşma Türü" (Yarın Buluşma / Hafta Sonu Buluşma, tek seçim) + "Masa Türü" (Grup / Baş Başa /
// Kankamla, çoklu). Mod kullanıcıya değil her katılım kaydına aittir. Sistem hakları otomatik taramaya almaz; her hak kullanıcı
// seçince taramaya girer. Ekran: paket alınınca ve girişte, taramada ya da masada olmayan kullanılmamış hak varsa açılır.
// Kilitten önce iptal / buluşma türü değişikliği serbest, kullanım hakkı yanmaz. Kankamla kanka seçilmeden de seçilir;
// kanka katılana kadar kayıt "Kanka bekleniyor" durumunda kalır, taramaya girmez.
const TYPES: MeetingType[] = [MeetingType.GROUP, MeetingType.ONE_ON_ONE, MeetingType.KANKA];

class SubmitSelectionDto {
  @IsEnum(MeetingMode)
  mode: MeetingMode;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsEnum(MeetingType, { each: true })
  types: MeetingType[];
}

class TypeDto {
  @IsEnum(MeetingType)
  type: MeetingType;
}

class ChangeDto extends TypeDto {
  @IsEnum(MeetingMode)
  mode: MeetingMode;
}

@Injectable()
export class WeeklySelectionService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
    @InjectQueue(ASSIGN_QUEUE) private assignQueue: Queue,
  ) {}

  private get deps(): SelectionDeps {
    return { prisma: this.prisma, notifications: this.notifications, assignQueue: this.assignQueue };
  }

  // Kullanılmamış hakkı olan türler (Kankamla kanka seçilmeden de seçilebilir)
  private async rightTypes(userId: string): Promise<MeetingType[]> {
    const subs = await this.prisma.subscription.findMany({ where: { userId, status: SubscriptionStatus.ACTIVE }, select: RIGHTS_SELECT });
    const types: MeetingType[] = [];
    if (subs.some(groupPartOpen)) types.push(MeetingType.GROUP);
    if (subs.some(oneOnOnePartOpen)) types.push(MeetingType.ONE_ON_ONE);
    if (subs.some(kankaPartOpen)) types.push(MeetingType.KANKA);
    return types;
  }

  async state(userId: string) {
    const now = new Date();
    const current = trIsoWeekOf(now);
    const [rights, link] = await Promise.all([this.rightTypes(userId), activeKankaLink(this.prisma, userId)]);
    const options = await Promise.all(TYPES.map(async (type) => {
      const [selection, seat] = await Promise.all([
        this.prisma.weeklySelection.findFirst({
          where: { userId, ...activeSelectionWhere(type, now) },
          orderBy: { createdAt: "desc" },
          select: { mode: true, meetingDate: true, year: true, weekNumber: true },
        }),
        this.prisma.meetingParticipant.findFirst({ where: seatWhere(userId, type, now), select: { meeting: { select: { scheduledAt: true } } } }),
      ]);
      const locked = !!seat && now.getTime() >= meetingLockAt(seat.meeting.scheduledAt);
      return {
        type,
        hasRight: rights.includes(type),
        seated: !!seat,
        locked,
        plannedDeadline: deadlineOf(type, now),
        selection: selection && {
          ...selection,
          kankaWaiting: type === MeetingType.KANKA && !link,
          // Planlı kayıt gelecek haftanın taramasında (bu haftanın son saati geçtiyse)
          nextWeek: selection.mode === MeetingMode.PLANNED && (selection.year !== current.year || selection.weekNumber !== current.week),
        },
      };
    }));
    const selected = options.filter((o) => o.selection).map((o) => o.type);
    return {
      selected,
      options,
      tomorrowDate: tomorrowMeetingAt(now),
      // Taramada ya da masada olmayan kullanılmamış hak varsa ekran açılır
      showModal: options.some((o) => o.hasRight && !o.selection && !o.seated),
    };
  }

  private async create(userId: string, mode: MeetingMode, type: MeetingType, now: Date) {
    if (mode === MeetingMode.TOMORROW) {
      const meetingDate = tomorrowMeetingAt(now);
      const { week, year } = trIsoWeekOf(meetingDate);
      await this.prisma.weeklySelection.create({ data: { userId, type, mode, meetingDate, year, weekNumber: week } });
    } else {
      // Planlı son saat (Grup Perşembe 18:00, Baş Başa Cuma 18:00, Kankamla Cumartesi 18:00) geçtiyse sonraki hafta
      const { week, year } = plannedTargetWeek(type, now);
      await this.prisma.weeklySelection.create({ data: { userId, type, mode, year, weekNumber: week } });
    }
  }

  async submit(userId: string, mode: MeetingMode, types: MeetingType[]) {
    const now = new Date();
    const unique = [...new Set(types)];
    const rights = await this.rightTypes(userId);
    // Kişinin satırı kilitlenir: eşzamanlı ikinci istek aynı türü ikinci kez kaydedemez
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      for (const type of unique) {
        if (!rights.includes(type)) throw new BadRequestException("Paketinde bu buluşma türünün hakkı yok.");
        if (await tx.weeklySelection.count({ where: { userId, ...activeSelectionWhere(type, now) } })) {
          throw new ConflictException("Bu masa türü için zaten kaydın var.");
        }
        if (await tx.meetingParticipant.count({ where: seatWhere(userId, type, now) })) {
          throw new ConflictException("Bu masa türü için zaten kaydın var.");
        }
      }
    });
    for (const type of unique) await this.create(userId, mode, type, now);
    // Seçilen türlerin taramasına girer
    await enqueueAssign(this.assignQueue, userId);
    return this.state(userId);
  }

  // Buluşma türünü değiştir: kilitten önce; mevcut tarama kaydı ve masa eşleşmesi düşer, hak yanmaz
  async change(userId: string, type: MeetingType, mode: MeetingMode) {
    const now = new Date();
    if (!(await this.prisma.weeklySelection.count({ where: { userId, ...activeSelectionWhere(type, now) } }))) {
      throw new BadRequestException("Bu masa türü için kaydın yok.");
    }
    await cancelSelection(this.deps, userId, type, "Buluşma türü değiştirildi");
    await this.create(userId, mode, type, now);
    await enqueueAssign(this.assignQueue, userId);
    return this.state(userId);
  }

  // Seçimi iptal et: kilitten önce; tarama kaydı ve masa eşleşmesi düşer, hak yanmaz
  async cancel(userId: string, type: MeetingType) {
    const now = new Date();
    const has = await this.prisma.weeklySelection.count({ where: { userId, ...activeSelectionWhere(type, now) } });
    const seated = await this.prisma.meetingParticipant.count({ where: seatWhere(userId, type, now) });
    if (!has && !seated) throw new BadRequestException("Bu masa türü için kaydın yok.");
    await cancelSelection(this.deps, userId, type, "Seçim iptal edildi");
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
    return this.service.submit((req.user as { id: string }).id, dto.mode, dto.types);
  }

  @Post("change")
  change(@Req() req: Request, @Body() dto: ChangeDto) {
    return this.service.change((req.user as { id: string }).id, dto.type, dto.mode);
  }

  @Post("cancel")
  cancel(@Req() req: Request, @Body() dto: TypeDto) {
    return this.service.cancel((req.user as { id: string }).id, dto.type);
  }
}
