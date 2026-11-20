import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Injectable, Post, Req, UseGuards } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { Request } from "express";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum } from "class-validator";
import { MeetingMode, MeetingType, SubscriptionStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { NotSuspendedGuard, activeSuspension } from "../common/suspension";
import { activeKankaLink } from "../kanka/kanka-links";
import { groupPartOpen, kankaPartOpen, oneOnOnePartOpen, RIGHTS_SELECT } from "../payment/package-rights";
import { meetingCardEnd, meetingLockAt, tomorrowMeetingAt } from "../meetings/meeting-windows";
import { ASSIGN_QUEUE, enqueueAssign } from "./assign-queue";
import {
  activeSelectionWhere, busyMeetingDays, cancelCooldownUntil, cancelSelection, changeAvailableAt, deadlineOf, plannedTargetWeek,
  seatWhere, SelectionDeps, selectionDayKey, trIsoWeekOf,
} from "./selection-cancel";

export { deadlineOf, selectedThisWeek, trIsoWeekOf, SELECTION_DEADLINE } from "./selection-cancel";

// Seçim ekranı (web + mobil): "Buluşma Türü" (Yarın Buluşma / Hafta Sonu Buluşma, tek seçim) + "Masa Türü" (Grup / Baş Başa /
// Kankamla, çoklu). Mod kullanıcıya değil her katılım kaydına aittir. Sistem hakları otomatik taramaya almaz; her hak kullanıcı
// seçince taramaya girer. Ekran: paket alınınca ve girişte (showModal kuralı state() içinde).
// İptal masa kilitlenene kadar serbest, kullanım hakkı yanmaz; iptal eden 24 saat hiçbir türde yeni seçim yapamaz.
// "Değiştir" seçimden sonra 24 saat (Yarın Buluşma'da 3 saat) kapalı. Aynı güne masası (kurulu / kilitli / oluşturuluyor) olan
// kullanıcı o günün başka bir taramasına giremez. Kankamla kanka seçilmeden de seçilir; kanka katılana kadar kayıt
// "Kanka bekleniyor" durumunda kalır, taramaya girmez.
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
    const [rights, link, user, cardSeats] = await Promise.all([
      this.rightTypes(userId),
      activeKankaLink(this.prisma, userId),
      this.prisma.user.findUnique({ where: { id: userId }, select: { selectionCancelledAt: true } }),
      // Masası olan (kurulu / kilitli; buluşma sonrası ertesi gün 08:00'e kadar) kullanıcıya seçim ekranı otomatik açılmaz
      this.prisma.meetingParticipant.findMany({
        where: {
          userId,
          status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] },
          meeting: { status: { in: ["PENDING", "ACTIVE", "COMPLETED"] }, scheduledAt: { gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) } },
        },
        select: { meeting: { select: { scheduledAt: true } } },
      }),
    ]);
    // Askıdaki kullanıcı masaya katılamaz: seçim ekranı otomatik açılmaz, Seçim Yap kapalı
    const suspension = await activeSuspension(this.prisma, userId);
    const cooldownUntil = cancelCooldownUntil(user?.selectionCancelledAt);
    const cooling = !!cooldownUntil && cooldownUntil > now;
    const hasTable = cardSeats.some((s) => meetingCardEnd(s.meeting.scheduledAt) > now);
    const options = await Promise.all(TYPES.map(async (type) => {
      const [selection, seat] = await Promise.all([
        this.prisma.weeklySelection.findFirst({
          where: { userId, ...activeSelectionWhere(type, now) },
          orderBy: { createdAt: "desc" },
          select: { mode: true, meetingDate: true, year: true, weekNumber: true, createdAt: true },
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
          mode: selection.mode,
          meetingDate: selection.meetingDate,
          year: selection.year,
          weekNumber: selection.weekNumber,
          // "Değiştir" bu andan sonra açılır (Planlı 24 saat, Yarın 3 saat)
          changeAvailableAt: changeAvailableAt(selection),
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
      // İptal sonrası 24 saat: bu ana kadar hiçbir türde "Seçim Yap" yok
      cancelCooldownUntil: cooling ? cooldownUntil : null,
      // Girişte otomatik açılış: masası kurulu / kilitli olan kullanıcıda hiçbir yerde açılmaz; buluşmadan sonraki gün 08:00'de
      // (kart Geçmiş Masalarım'a geçip değerlendirme açılınca) yeniden açılabilir. Aktif seçim / tarama sürüyorsa ya da iptal
      // sonrası 24 saat dolmadıysa açılmaz; aksi hâlde kullanılmamış hak varsa açılır. Elle açılış ("Seçim Yap") aynen.
      suspendedUntil: suspension?.expiresAt ?? null,
      showModal: !suspension && !hasTable && !cooling && !options.some((o) => !!o.selection || o.seated) && options.some((o) => o.hasRight),
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
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { selectionCancelledAt: true } });
    const until = cancelCooldownUntil(user?.selectionCancelledAt);
    if (until && until > now) throw new ForbiddenException("İptal ettiğin için 24 saat boyunca yeni masaya katılamazsın.");
    // Aynı güne açık tarama kaydı ya da masası olan kullanıcı o güne ikinci kayıt açamaz (aynı gönderimdeki türler de birbirini sayar)
    const busy = await busyMeetingDays(this.prisma, userId, now);
    const days = unique.map((type) => selectionDayKey(type, mode, now));
    if (days.some((d) => busy.has(d)) || new Set(days).size !== days.length) throw new ConflictException("Bu güne zaten bir masan var.");
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

  // Buluşma türünü değiştir: kilitten önce ve seçimden 24 saat (Yarın 3 saat) sonra; mevcut tarama kaydı ve masa eşleşmesi düşer, hak yanmaz
  async change(userId: string, type: MeetingType, mode: MeetingMode) {
    const now = new Date();
    const current = await this.prisma.weeklySelection.findFirst({
      where: { userId, ...activeSelectionWhere(type, now) },
      orderBy: { createdAt: "desc" },
      select: { mode: true, createdAt: true },
    });
    if (!current) throw new BadRequestException("Bu masa türü için kaydın yok.");
    if (changeAvailableAt(current) > now) {
      throw new ForbiddenException(current.mode === MeetingMode.TOMORROW
        ? "Yarın Buluşma seçimini yaptıktan sonra 3 saat değiştiremezsin."
        : "Seçimini yaptıktan sonra 24 saat değiştiremezsin.");
    }
    // Yeni buluşma gününe başka açık kaydı ya da masası olan kullanıcı o günün taramasına giremez (değiştirilen kayıt sayılmaz)
    const busy = await busyMeetingDays(this.prisma, userId, now, type);
    if (busy.has(selectionDayKey(type, mode, now))) throw new ConflictException("Bu güne zaten bir masan var.");
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
    // İptal eden 24 saat boyunca hiçbir masa türünde yeni seçim yapamaz
    await this.prisma.user.update({ where: { id: userId }, data: { selectionCancelledAt: now } });
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
  @UseGuards(NotSuspendedGuard)
  submit(@Req() req: Request, @Body() dto: SubmitSelectionDto) {
    return this.service.submit((req.user as { id: string }).id, dto.mode, dto.types);
  }

  @Post("change")
  @UseGuards(NotSuspendedGuard)
  change(@Req() req: Request, @Body() dto: ChangeDto) {
    return this.service.change((req.user as { id: string }).id, dto.type, dto.mode);
  }

  @Post("cancel")
  cancel(@Req() req: Request, @Body() dto: TypeDto) {
    return this.service.cancel((req.user as { id: string }).id, dto.type);
  }
}
