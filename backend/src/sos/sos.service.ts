import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";
import { FcmService } from "../notification/fcm/fcm.service";
import { NotificationService } from "../notification/notification.service";
import { Logger } from "@nestjs/common";
import { AdminAlertType, MeetingStatus, UserRole } from "@prisma/client";
import { sosWindowEnd } from "../meetings/meeting-windows";

type Viewer = { id: string; role: UserRole };
type SnapshotPerson = { userId: string; [key: string]: unknown };

const INACTIVE = ["CANCELLED", "DECLINED", "NO_SHOW"];

export const THREAT_LABELS: Record<string, string> = {
  LIFE_DANGER:      "Hayatım tehlikede",
  PHYSICAL_VIOLENCE:"Fiziksel şiddet gördüm",
  ABDUCTION:        "Zorla alıkoyuluyorum",
  HARASSMENT:       "Taciz veya istismara uğradım",
};

@Injectable()
export class SosService {
  private readonly logger = new Logger(SosService.name);

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappNotifyService,
    private fcm: FcmService,
    private notifications: NotificationService,
  ) {}

  private inSosWindow(scheduledAt: Date): boolean {
    const now = new Date();
    return now >= scheduledAt && now < sosWindowEnd(scheduledAt);
  }

  // ─── Rapor oluştur ────────────────────────────────────────────────────────

  async createReport(
    userId: string,
    meetingId: string,
    threats: string[],
    lat?: number,
    lng?: number,
    accuracy?: number,
  ) {
    // Kullanıcı bu masanın aktif katılımcısı mı?
    const participation = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId } },
    });
    if (!participation || INACTIVE.includes(participation.status)) {
      throw new ForbiddenException("Bu masanın aktif katılımcısı değilsiniz");
    }

    // Masa + tüm katılımcıların tam bilgisi (snapshot)
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });
    if (!meeting) throw new NotFoundException("Masa bulunamadı");
    if (meeting.status === MeetingStatus.CANCELLED) {
      throw new ForbiddenException("İptal edilmiş masada acil yardım kullanılamaz");
    }

    // SOS süresi: masa saatinden (scheduledAt) ertesi gün 10:00 TR'ye kadar (web ile aynı kural)
    if (!this.inSosWindow(meeting.scheduledAt)) {
      throw new ForbiddenException("Acil yardım bu masa için şu an kullanılamaz");
    }

    // Açık talebi varsa (ör. "Tekrar dene") yeni talep açılmaz, aynı talep döner
    const open = await this.prisma.sosReport.findFirst({
      where: { userId, meetingId, resolvedAt: null },
      select: { id: true },
    });
    if (open) return { reportId: open.id };

    const participantSnapshot = meeting.participants.map((p) => {
      const u = p.user;
      const prof = u.profile;
      const birthDate = prof?.birthDate;
      const age = birthDate
        ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : null;
      return {
        userId:     u.id,
        firstName:  prof?.firstName ?? null,
        lastName:   prof?.lastName ?? null,
        email:      u.email,
        phone:      u.phone ?? null,
        age,
        gender:     prof?.gender ?? null,
        occupation: u.occupationSector,
        city:       prof?.city ?? null,
        isRequester: u.id === userId,
        isBot:      u.isBot,
      };
    });

    const report = await this.prisma.sosReport.create({
      data: {
        userId,
        meetingId,
        threats,
        lat: lat ?? null,
        lng: lng ?? null,
        accuracy: accuracy ?? null,
        participantSnapshot,
      },
    });

    // WhatsApp: tüm admin ve superadmin kullanıcılarına gönder
    this.notifyAdmins(report.id, userId, meetingId, threats, lat, lng).catch((e) =>
      this.logger.error("Admin WhatsApp bildirimi gönderilemedi", e),
    );

    return { reportId: report.id };
  }

  // ─── Canlı konum güncelle ─────────────────────────────────────────────────

  // Talep eden: talep çözülene ya da acil yardım süresi bitene kadar canlı konum; sonra { active: false } → takip durur
  async updateLocation(reportId: string, userId: string, lat: number, lng: number, accuracy?: number) {
    const report = await this.prisma.sosReport.findUnique({
      where: { id: reportId },
      include: { meeting: { select: { scheduledAt: true } } },
    });
    if (!report || report.userId !== userId) throw new ForbiddenException();
    if (report.resolvedAt || !report.meeting || !this.inSosWindow(report.meeting.scheduledAt)) return { active: false };

    await this.prisma.sosLocationUpdate.create({
      data: { reportId, lat, lng, accuracy: accuracy ?? null },
    });

    // En son konumu raporda da güncelle
    await this.prisma.sosReport.update({
      where: { id: reportId },
      data: { lat, lng, accuracy: accuracy ?? null },
    });

    return { active: true };
  }

  // Sayfa yenilenince kullanıcının o masadaki açık talebi geri yüklenir (canlı konum devam eder)
  async myOpenReport(userId: string, meetingId: string) {
    const report = await this.prisma.sosReport.findFirst({
      where: { userId, meetingId, resolvedAt: null },
      orderBy: { createdAt: "desc" },
      include: { meeting: { select: { scheduledAt: true } } },
    });
    if (!report || !report.meeting || !this.inSosWindow(report.meeting.scheduledAt)) return { reportId: null };
    return { reportId: report.id };
  }

  // ─── Admin: görünürlük ────────────────────────────────────────────────────
  // Talebi "İlgileniyorum" ile üstlenen admin + SUPERADMIN tüm veriyi görür; diğer adminler sadece kimin ilgilendiğini.
  // Bot bilgisi sadece SUPERADMIN'e (ADMIN listesinde bot hiç yer almaz); e-posta HideEmail interceptor ile gizlenir.

  private canSee(report: { claimedById: string | null }, viewer: Viewer): boolean {
    return viewer.role === UserRole.SUPERADMIN || !report.claimedById || report.claimedById === viewer.id;
  }

  private async botIds(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const bots = await this.prisma.user.findMany({ where: { id: { in: userIds }, isBot: true }, select: { id: true } });
    return new Set(bots.map((b) => b.id));
  }

  private shapeSnapshot(snapshot: unknown, bots: Set<string>, viewer: Viewer) {
    const people = (Array.isArray(snapshot) ? snapshot : []) as SnapshotPerson[];
    if (viewer.role === UserRole.SUPERADMIN) return people.map((p) => ({ ...p, isBot: bots.has(p.userId) }));
    return people.filter((p) => !bots.has(p.userId)).map(({ isBot: _isBot, ...p }) => p);
  }

  private adminName = { select: { id: true, profile: { select: { firstName: true, lastName: true } } } } as const;

  // ─── Admin: tüm raporlar ──────────────────────────────────────────────────

  async adminListReports(viewer: Viewer) {
    const reports = await this.prisma.sosReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: {
          select: {
            id: true, email: true, phone: true,
            profile: { select: { firstName: true, lastName: true, gender: true, birthDate: true, city: true } },
          },
        },
        meeting: {
          select: { id: true, type: true, scheduledAt: true, locationText: true, venueAddress: true },
        },
        locationUpdates: { orderBy: { timestamp: "desc" }, take: 1 },
        claimedBy: this.adminName,
        resolvedBy: this.adminName,
      },
    });
    const bots = await this.botIds(
      reports.flatMap((r) => ((Array.isArray(r.participantSnapshot) ? r.participantSnapshot : []) as SnapshotPerson[]).map((p) => p.userId)),
    );
    return reports.map((r) =>
      this.canSee(r, viewer)
        ? { ...r, restricted: false, participantSnapshot: this.shapeSnapshot(r.participantSnapshot, bots, viewer) }
        : { id: r.id, createdAt: r.createdAt, resolvedAt: r.resolvedAt, claimedAt: r.claimedAt, claimedBy: r.claimedBy, restricted: true },
    );
  }

  // ─── Admin: rapor detayı (+ tüm katılımcı konumları) ────────────────────

  async adminGetReport(id: string, viewer: Viewer) {
    const report = await this.prisma.sosReport.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true, email: true, phone: true,
            profile: { select: { firstName: true, lastName: true, gender: true, birthDate: true, city: true } },
          },
        },
        meeting: true,
        locationUpdates: { orderBy: { timestamp: "asc" } },
        claimedBy: this.adminName,
        resolvedBy: this.adminName,
      },
    });
    if (!report) throw new NotFoundException();
    if (!this.canSee(report, viewer)) throw new ForbiddenException("Bu talep başka bir admin tarafından takip ediliyor");

    // Aynı masadaki tüm katılımcıların konumları (kayıtlar talep çözülse de durur)
    // Masa silindiyse (meetingId null) katılımcı konumu yoktur
    const participantLocations = !report.meetingId ? [] : await this.prisma.participantLocation.findMany({
      where: { meetingId: report.meetingId },
      orderBy: { timestamp: "desc" },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    // Her kullanıcı için en son konum
    const latestByUser = new Map<string, typeof participantLocations[0]>();
    for (const loc of participantLocations) {
      if (!latestByUser.has(loc.userId)) latestByUser.set(loc.userId, loc);
    }

    const snapshot = (Array.isArray(report.participantSnapshot) ? report.participantSnapshot : []) as SnapshotPerson[];
    const bots = await this.botIds(snapshot.map((p) => p.userId));
    return {
      ...report,
      restricted: false,
      participantSnapshot: this.shapeSnapshot(report.participantSnapshot, bots, viewer),
      allParticipantLocations: Array.from(latestByUser.values()),
      participantLocationHistory: participantLocations,
    };
  }

  // ─── Admin: üstlen / çöz ─────────────────────────────────────────────────

  async claimReport(id: string, viewer: Viewer) {
    const report = await this.prisma.sosReport.findUnique({ where: { id }, select: { claimedById: true, resolvedAt: true } });
    if (!report) throw new NotFoundException();
    if (report.resolvedAt) throw new BadRequestException("Talep zaten çözülmüş");
    if (!this.canSee(report, viewer)) throw new ForbiddenException("Bu talep başka bir admin tarafından takip ediliyor");
    await this.prisma.sosReport.update({ where: { id }, data: { claimedById: viewer.id, claimedAt: new Date() } });
    return { claimed: true };
  }

  // Çözülünce o masada konum alınması durur; tüm kayıtlar saklanır
  async resolveReport(id: string, viewer: Viewer) {
    const report = await this.prisma.sosReport.findUnique({ where: { id }, select: { claimedById: true, resolvedAt: true } });
    if (!report) throw new NotFoundException();
    if (report.resolvedAt) throw new BadRequestException("Talep zaten çözülmüş");
    if (viewer.role !== UserRole.SUPERADMIN && report.claimedById !== viewer.id) {
      throw new ForbiddenException("Önce 'İlgileniyorum' ile talebi üstlenin");
    }
    await this.prisma.sosReport.update({ where: { id }, data: { resolvedAt: new Date(), resolvedById: viewer.id } });
    return { resolved: true };
  }

  // ─── Tüm masa üyeleri konum güncelle ────────────────────────────────────
  // Sadece acil yardım süresinde ve aktif katılımcıdan (iptal eden / gelmedi sayılan alınmaz).
  // Masadaki talep çözüldüyse (açık talep kalmadıysa) konum alınmaz. Kabul edilmezse { active: false } → takip durur.
  // Katılımcıya masa başına bir kez bilgilendirme gider.

  async updateParticipantLocation(
    meetingId: string,
    userId: string,
    lat: number,
    lng: number,
    accuracy?: number,
  ) {
    const participation = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId } },
      select: { status: true, meeting: { select: { status: true, scheduledAt: true } } },
    });
    if (!participation) throw new ForbiddenException("Bu masanın katılımcısı değilsiniz");
    if (
      INACTIVE.includes(participation.status) ||
      participation.meeting.status === MeetingStatus.CANCELLED ||
      !this.inSosWindow(participation.meeting.scheduledAt)
    ) {
      return { active: false };
    }
    const [resolved, open] = await Promise.all([
      this.prisma.sosReport.count({ where: { meetingId, resolvedAt: { not: null } } }),
      this.prisma.sosReport.count({ where: { meetingId, resolvedAt: null } }),
    ]);
    if (resolved > 0 && open === 0) return { active: false };

    const first = (await this.prisma.participantLocation.count({ where: { meetingId, userId } })) === 0;
    await this.prisma.participantLocation.create({
      data: { meetingId, userId, lat, lng, accuracy: accuracy ?? null },
    });
    if (first) {
      await this.notifications.sendToUser(userId, {
        title: "Güvenliğin için",
        body: "Masa süresince konumun, acil bir durumda kullanılmak üzere güvenlik ekibimizle paylaşılır.",
        data: { type: "LOCATION_NOTICE", meetingId },
      }).catch(() => undefined);
    }
    return { active: true };
  }

  // ─── İç: admin bildirim ───────────────────────────────────────────────────

  private async notifyAdmins(
    reportId: string,
    userId: string,
    meetingId: string,
    threats: string[],
    lat?: number,
    lng?: number,
  ) {
    const admins = await this.prisma.user.findMany({
      where: { role: { in: [UserRole.ADMIN, UserRole.SUPERADMIN] } },
      select: { id: true, phone: true, fcmToken: true, profile: { select: { firstName: true, lastName: true } } },
    });

    const reporter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true, profile: { select: { firstName: true, lastName: true } } },
    });

    const name     = reporter?.profile ? `${reporter.profile.firstName} ${reporter.profile.lastName}` : reporter?.email ?? userId;
    const threatTx = threats.map((t) => THREAT_LABELS[t] ?? t).join(", ");
    const locTx    = lat && lng ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Konum alınamadı";
    const logMsg   = `[ACİL YARDIM] ${name} (${reporter?.phone ?? reporter?.email}) — Tehdit: ${threatTx} — Konum: ${locTx} — Masa: ${meetingId} — Rapor: ${reportId}`;

    this.logger.error(logMsg);

    for (const adm of admins) {
      // 1. WhatsApp
      if (adm.phone) {
        try {
          await this.whatsapp.send(adm.phone, "ahenk_sos_alert", [name, threatTx, locTx]);
        } catch {
          this.logger.warn(`Admin ${adm.phone} WhatsApp bildirimi başarısız`);
        }
      }

      // 2. FCM push (fallback)
      if (adm.fcmToken) {
        try {
          await this.fcm.sendToToken({
            token: adm.fcmToken,
            title: "🚨 ACİL YARDIM TALEBİ",
            body:  `${name} — ${threatTx}`,
            data:  { reportId, meetingId, type: "SOS_ALERT" },
          });
        } catch {
          this.logger.warn(`Admin ${adm.id} FCM bildirimi başarısız`);
        }
      }

    }

    // 3. AdminAlert: talep başına tek kayıt, talep eden kişiye bağlı (uyarılar sayfası tüm adminlere ortak)
    try {
      await this.prisma.adminAlert.create({ data: { userId, alertType: AdminAlertType.SOS_ALERT } });
    } catch (e) {
      this.logger.error(`AdminAlert oluşturulamadı (rapor: ${reportId}): ${e}`);
    }
  }
}
