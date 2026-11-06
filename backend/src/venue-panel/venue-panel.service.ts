import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { MeetingStatus, ParticipantStatus, VenueAccount } from "../generated/prisma/client";
import bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { OtpService } from "../auth/otp/otp.service";
import { venueJwtSecret } from "./venue-auth.guard";
import { assertVenuePhotos, saveVenuePhotos, VENUE_PHOTO_MAX_COUNT } from "./venue-media";
import { CLEARED_MEETING_VENUE, meetingVenueFields, VenueAssignmentService } from "./venue-assignment.service";
import { isValidDistrict } from "../common/districts";
import { VenueInfoDto } from "./venue-panel.dto";

export const VENUE_SESSION_DAYS = 7;
const LEFT_STATUSES: ParticipantStatus[] = [ParticipantStatus.DECLINED, ParticipantStatus.CANCELLED];

const LOGIN_BLOCKED: Record<string, string> = {
  PENDING: "Başvurunuz henüz onaylanmadı.",
  REJECTED: "Başvurunuz reddedildi, panele giriş yapamazsınız.",
  DEACTIVATED: "Bu mekân hesabı kapatıldı.",
};

@Injectable()
export class VenuePanelService {
  private readonly logger = new Logger(VenuePanelService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private otp: OtpService,
    private assignment: VenueAssignmentService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private sign(account: Pick<VenueAccount, "id" | "tokenVersion">) {
    return this.jwt.signAsync(
      { sub: account.id, tv: account.tokenVersion },
      { secret: venueJwtSecret(this.config), expiresIn: `${VENUE_SESSION_DAYS}d` },
    );
  }

  // Durum mesajı yalnızca şifre doğruysa gösterilir (e-posta/başvuru durumu sızmaz)
  async login(email: string, password: string) {
    const account = await this.prisma.venueAccount.findUnique({ where: { email: this.normalizeEmail(email) } });
    if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
      throw new UnauthorizedException("E-posta veya şifre hatalı");
    }
    if (account.status !== "ACTIVE") throw new ForbiddenException(LOGIN_BLOCKED[account.status]);
    if (!account.venueId) throw new ForbiddenException("Mekân kaydı bulunamadı, destek ile iletişime geçin.");
    return this.sign(account);
  }

  // Kod kayıtlı telefona WhatsApp ile gider; hesabın varlığı yanıttan anlaşılmaz
  async forgotPassword(email: string) {
    const account = await this.prisma.venueAccount.findUnique({ where: { email: this.normalizeEmail(email) } });
    if (account?.status === "ACTIVE") {
      await this.otp.send(account.phone).catch((err) => this.logger.warn(`Mekân şifre kodu gönderilemedi: ${err}`));
    }
    return { message: "Hesap varsa kayıtlı WhatsApp numarasına kod gönderildi" };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const account = await this.prisma.venueAccount.findUnique({ where: { email: this.normalizeEmail(email) } });
    if (account?.status !== "ACTIVE") throw new BadRequestException("Doğrulama kodunun süresi doldu, yeni kod isteyin");
    await this.otp.verify(account.phone, code);
    await this.prisma.venueAccount.update({
      where: { id: account.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12), tokenVersion: { increment: 1 } },
    });
    return { success: true };
  }

  private async venueOf(account: VenueAccount) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: account.venueId! },
      include: { city: { select: { name: true } } },
    });
    if (!venue) throw new NotFoundException("Mekân bulunamadı");
    return venue;
  }

  async me(account: VenueAccount) {
    const venue = await this.venueOf(account);
    return {
      email: account.email,
      phone: account.phone,
      registeredAt: account.registeredAt,
      venue: {
        name: venue.name,
        city: venue.city.name,
        description: venue.description,
        address: venue.address,
        district: venue.district,
        locationUrl: venue.locationUrl,
        websiteOrSocial: venue.websiteOrSocial,
        venueType: venue.venueType,
        venueKind: venue.venueKind,
        photos: venue.photos,
      },
    };
  }

  // Yaklaşan masaların kartı da güncel mekân bilgisini gösterir
  private async syncUpcomingMeetings(venueId: string) {
    const venue = await this.prisma.venue.findUniqueOrThrow({ where: { id: venueId } });
    await this.prisma.meeting.updateMany({
      where: { venueId, scheduledAt: { gt: new Date() }, status: { in: [MeetingStatus.PENDING, MeetingStatus.ACTIVE] } },
      data: meetingVenueFields(venue),
    });
  }

  // Başvuru detayındaki "Son güncelleme"
  private async markEdited(account: VenueAccount) {
    await this.prisma.partnershipApplication.update({
      where: { id: account.applicationId },
      data: { lastEditedAt: new Date(), lastEditedByName: "Mekân" },
    });
  }

  async updateInfo(account: VenueAccount, dto: VenueInfoDto) {
    if (dto.district !== undefined) {
      const { city } = await this.venueOf(account);
      if (!isValidDistrict(city.name, dto.district)) throw new BadRequestException("Geçerli bir ilçe seçin");
    }
    await this.prisma.venue.update({
      where: { id: account.venueId! },
      data: {
        description: dto.description,
        address: dto.address,
        district: dto.district,
        locationUrl: dto.locationUrl,
        websiteOrSocial: dto.websiteOrSocial,
        venueType: dto.venueType,
      },
    });
    await this.syncUpcomingMeetings(account.venueId!);
    await this.markEdited(account);
    return this.me(account);
  }

  async addPhotos(account: VenueAccount, files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException("Fotoğraf seçin");
    assertVenuePhotos(files);
    const venue = await this.venueOf(account);
    if (venue.photos.length + files.length > VENUE_PHOTO_MAX_COUNT) {
      throw new BadRequestException(`En fazla ${VENUE_PHOTO_MAX_COUNT} fotoğraf eklenebilir`);
    }
    const urls = saveVenuePhotos(venue.id, files);
    await this.prisma.venue.update({ where: { id: venue.id }, data: { photos: [...venue.photos, ...urls] } });
    await this.syncUpcomingMeetings(venue.id);
    await this.markEdited(account);
    return this.me(account);
  }

  // Dosya diskte kalır: başvuru kaydı ve geçmiş masalar aynı adresi kullanır
  async removePhoto(account: VenueAccount, url: string) {
    const venue = await this.venueOf(account);
    if (!venue.photos.includes(url)) throw new NotFoundException("Fotoğraf bulunamadı");
    if (venue.photos.length === 1) throw new BadRequestException("En az 1 fotoğraf kalmalı");
    await this.prisma.venue.update({ where: { id: venue.id }, data: { photos: venue.photos.filter((p) => p !== url) } });
    await this.syncUpcomingMeetings(venue.id);
    await this.markEdited(account);
    return this.me(account);
  }

  // Sadece özet: katılımcıların kişisel bilgisi seçilmez
  async meetings(account: VenueAccount) {
    const rows = await this.prisma.meeting.findMany({
      where: { venueId: account.venueId!, status: { not: MeetingStatus.CANCELLED } },
      orderBy: { scheduledAt: "desc" },
      take: 200,
      select: {
        id: true, scheduledAt: true, type: true,
        _count: { select: { participants: { where: { status: { notIn: LEFT_STATUSES } } } } },
      },
    });
    return rows.map((m) => ({ id: m.id, scheduledAt: m.scheduledAt, type: m.type, seats: m._count.participants }));
  }

  private async assertPassword(account: VenueAccount, password: string) {
    if (!(await bcrypt.compare(password, account.passwordHash))) throw new BadRequestException("Şifre hatalı");
  }

  // Yeni oturum döner: tokenVersion artınca diğer cihazlar düşer, bu cihaz açık kalır
  async changePassword(account: VenueAccount, currentPassword: string, newPassword: string) {
    await this.assertPassword(account, currentPassword);
    const updated = await this.prisma.venueAccount.update({
      where: { id: account.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12), tokenVersion: { increment: 1 } },
    });
    return this.sign(updated);
  }

  // Kalıcı silme yok: hesap pasife alınır, mekân atamadan çıkar, yaklaşan masalar yeniden atamaya döner
  async deactivate(account: VenueAccount, password: string) {
    await this.assertPassword(account, password);
    const venueId = account.venueId!;
    await this.prisma.$transaction([
      this.prisma.venueAccount.update({
        where: { id: account.id },
        data: { status: "DEACTIVATED", deactivatedAt: new Date(), tokenVersion: { increment: 1 } },
      }),
      this.prisma.venue.update({ where: { id: venueId }, data: { isActive: false } }),
      this.prisma.meeting.updateMany({
        where: { venueId, scheduledAt: { gt: new Date() }, status: { in: [MeetingStatus.PENDING, MeetingStatus.ACTIVE] } },
        data: CLEARED_MEETING_VENUE,
      }),
    ]);
    return { success: true };
  }
}
