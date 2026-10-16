import { Injectable, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";
import { FcmService } from "../notification/fcm/fcm.service";
import { Logger } from "@nestjs/common";
import { AdminAlertType, UserRole } from "@prisma/client";

const THREAT_LABELS: Record<string, string> = {
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
  ) {}

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
    const inactiveStatuses = ['CANCELLED', 'DECLINED', 'NO_SHOW'];
    if (!participation || inactiveStatuses.includes(participation.status)) {
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

  async updateLocation(reportId: string, userId: string, lat: number, lng: number, accuracy?: number) {
    const report = await this.prisma.sosReport.findUnique({ where: { id: reportId } });
    if (!report || report.userId !== userId) throw new ForbiddenException();

    await this.prisma.sosLocationUpdate.create({
      data: { reportId, lat, lng, accuracy: accuracy ?? null },
    });

    // En son konumu raporda da güncelle
    await this.prisma.sosReport.update({
      where: { id: reportId },
      data: { lat, lng, accuracy: accuracy ?? null },
    });

    return { ok: true };
  }

  // ─── Admin: tüm raporlar ──────────────────────────────────────────────────

  async adminListReports() {
    return this.prisma.sosReport.findMany({
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
      },
    });
  }

  // ─── Admin: rapor detayı (+ tüm katılımcı konumları) ────────────────────

  async adminGetReport(id: string) {
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
      },
    });
    if (!report) throw new NotFoundException();

    // Aynı masadaki tüm katılımcıların en güncel konumları
    const participantLocations = await this.prisma.participantLocation.findMany({
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

    return {
      ...report,
      allParticipantLocations: Array.from(latestByUser.values()),
      participantLocationHistory: participantLocations,
    };
  }

  // ─── Tüm masa üyeleri konum güncelle ────────────────────────────────────

  async updateParticipantLocation(
    meetingId: string,
    userId: string,
    lat: number,
    lng: number,
    accuracy?: number,
  ) {
    const participation = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId } },
    });
    if (!participation) throw new ForbiddenException("Bu masanın katılımcısı değilsiniz");

    await this.prisma.participantLocation.create({
      data: { meetingId, userId, lat, lng, accuracy: accuracy ?? null },
    });
    return { ok: true };
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

      // 3. AdminAlert kaydı (panel bildirim)
      try {
        await this.prisma.adminAlert.create({
          data: { userId: adm.id, alertType: AdminAlertType.SOS_ALERT },
        });
      } catch (e) {
        this.logger.error(`AdminAlert oluşturulamadı (admin: ${adm.id}): ${e}`);
      }
    }
  }
}
