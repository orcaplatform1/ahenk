import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  HttpException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { OtpService } from "./otp/otp.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ConsentType, UserRole, SubscriptionStatus, ReferralStatus, SanctionType, Gender } from "@prisma/client";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    private otpService: OtpService,
  ) {}

  // ─── Aktif yaptırım kontrolü ─────────────────────────────────────────────

  private async checkSanction(userId: string, status: string): Promise<void> {
    if (status === 'DELETED') throw new ForbiddenException("Bu hesap silinmiş");

    if (status === 'BANNED' || status === 'SUSPENDED') {
      const sanction = await this.prisma.userSanction.findFirst({
        where: {
          userId,
          liftedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: 'desc' },
        select: { type: true, reason: true, expiresAt: true },
      });

      // Aktif yaptırım kalmamış ama status güncellenmemiş → otomatik kaldır
      if (!sanction && (status === 'SUSPENDED' || status === 'BANNED')) {
        await this.prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
        return;
      }

      const type = sanction?.type ?? (status === 'BANNED' ? SanctionType.BAN : SanctionType.SUSPENSION);
      const reason = sanction?.reason ?? 'Yönetici tarafından uygulandı';
      const expiresAt = sanction?.expiresAt ?? null;

      throw new HttpException(
        {
          statusCode: 403,
          type,
          reason,
          expiresAt,
          message:
            type === SanctionType.BAN
              ? 'Hesabınız kalıcı olarak engellendi'
              : 'Hesabınız geçici olarak askıya alındı',
        },
        403,
      );
    }
  }

  // ─── Kayıt ───────────────────────────────────────────────────────────────

  async register(dto: RegisterDto, ip?: string, userAgent?: string) {
    if (!dto.acceptTerms) {
      throw new BadRequestException("Kullanım şartlarını kabul etmelisiniz");
    }

    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException("Bu e-posta zaten kullanılıyor");

    const passwordHash = await bcrypt.hash(dto.password, 12);

    if (dto.phoneNumber) {
      const phoneExists = await this.prisma.user.findUnique({ where: { phone: dto.phoneNumber } });
      if (phoneExists) throw new ConflictException("Bu telefon numarası zaten kullanılıyor");
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          phone: dto.phoneNumber ?? null,
          role: UserRole.USER,
          occupationSector: dto.occupationSector,
          profile: {
            create: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              primaryCity: dto.primaryCityId ?? null,
              gender: (dto.gender as Gender) ?? null,
              birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
            },
          },
          consents: {
            createMany: {
              data: [
                { type: ConsentType.TERMS_OF_SERVICE, accepted: true, ip, userAgent },
                { type: ConsentType.PRIVACY_POLICY, accepted: true, ip, userAgent },
              ],
            },
          },
        },
        include: { profile: true },
      });

      return created;
    });

    // Referral kodu ile geldiyse ilişkilendir
    if (dto.referralCode) {
      await this.prisma.referral.updateMany({
        where: { inviteCode: dto.referralCode, status: ReferralStatus.PENDING },
        data: { referredId: user.id, status: ReferralStatus.REGISTERED },
      });
      // Referral bulundu ise davet edilen kullanıcıya indirim hakkı ver
      const updated = await this.prisma.referral.findFirst({
        where: { inviteCode: dto.referralCode, referredId: user.id },
        select: { referrerId: true },
      });
      if (updated) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { referralDiscountAvailable: true },
        });
        // Davet eden kullanıcıya FCM bildirimi
        const referrer = await this.prisma.user.findUnique({
          where: { id: updated.referrerId },
          select: { fcmToken: true },
        });
        if (referrer?.fcmToken) {
          const { FcmService } = await import("../notification/fcm/fcm.service");
          // Notification servisini enjekte etmek yerine doğrudan prisma üzerinden yaz
          await this.prisma.notification.create({
            data: {
              userId: updated.referrerId,
              type: "IN_APP",
              title: "Arkadaşın platforma katıldı!",
              body: "Bir davet hakkın kullanıldı. 1 indirim hakkın eklendi.",
              data: { event: "REFERRAL_REGISTERED" },
              sentAt: new Date(),
            },
          });
        }
      }
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ─── Giriş ───────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { profile: true },
    });

    if (!user) throw new UnauthorizedException("E-posta veya şifre hatalı");
    await this.checkSanction(user.id, user.status);

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) throw new UnauthorizedException("E-posta veya şifre hatalı");

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ─── Çıkış ───────────────────────────────────────────────────────────────

  async logout(userId: string, refreshTokenJti: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, token: refreshTokenJti, revoked: false },
      data: { revoked: true },
    });
  }

  // ─── Token Yenile ─────────────────────────────────────────────────────────

  async refreshTokens(userId: string, refreshTokenJti: string) {
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { userId, token: refreshTokenJti, revoked: false },
    });

    if (!storedToken) throw new UnauthorizedException("Refresh token geçersiz");
    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revoked: true },
      });
      throw new UnauthorizedException("Refresh token süresi dolmuş, tekrar giriş yapın");
    }

    const user = await this.usersService.findById(userId);
    if (!user || user.status !== "ACTIVE") throw new UnauthorizedException("Oturum geçersiz");

    // Eski token'ı iptal et, yeni üret (rotation)
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ─── WhatsApp OTP ile Giriş (public) ────────────────────────────────────

  async sendLoginOtp(phone: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw new UnauthorizedException("Bu telefon numarasıyla kayıtlı hesap bulunamadı");
    await this.checkSanction(user.id, user.status);
    await this.otpService.send(phone);
    return { message: "Doğrulama kodu gönderildi" };
  }

  async verifyLoginOtp(phone: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: { profile: true },
    });
    if (!user) throw new UnauthorizedException("Hesap bulunamadı");
    await this.checkSanction(user.id, user.status);

    await this.otpService.verify(phone, code);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ─── WhatsApp OTP ─────────────────────────────────────────────────────────

  async sendOtp(phone: string) {
    await this.otpService.send(phone);
    return { message: "OTP gönderildi" };
  }

  async verifyOtp(phone: string, code: string) {
    await this.otpService.verify(phone, code);

    // Telefonu doğrulanmış olarak işaretle
    await this.prisma.user.updateMany({
      where: { phone },
      data: { phoneVerified: true },
    });

    return { message: "Telefon numarası doğrulandı" };
  }

  // ─── Token üretimi ────────────────────────────────────────────────────────

  private async generateTokens(userId: string, email: string, role: string) {
    const jti = randomUUID(); // refresh token'ın benzersiz ID'si

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role },
        {
          secret: this.config.getOrThrow("JWT_SECRET"),
          expiresIn: this.config.get("JWT_ACCESS_EXPIRES") ?? "15m",
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, jti },
        {
          secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
          expiresIn: this.config.get("JWT_REFRESH_EXPIRES") ?? "7d",
        },
      ),
    ]);

    const refreshExpiryDays = parseInt(
      (this.config.get("JWT_REFRESH_EXPIRES") ?? "7d").replace("d", ""),
      10,
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshExpiryDays);

    // Refresh token'ı DB'ye kaydet (jti ile)
    await this.prisma.refreshToken.create({
      data: { userId, token: jti, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  // passwordHash ve hassas alanları çıkar; KYC rozetini ekle
  sanitizeUser(user: any) {
    const { passwordHash, kyc, profile, ...safe } = user;
    return {
      ...safe,
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      isKycVerified: kyc?.status === "APPROVED",
      profile,
    };
  }

  async getMe(user: any) {
    const [primaryCity, activeSubs, activeSanction] = await Promise.all([
      user.profile?.primaryCity
        ? this.prisma.city.findUnique({ where: { id: user.profile.primaryCity }, select: { id: true, name: true } })
        : Promise.resolve(null),
      this.prisma.subscription.findMany({
        where: { userId: user.id, status: SubscriptionStatus.ACTIVE },
        select: { plan: true },
      }),
      this.prisma.userSanction.findFirst({
        where: {
          userId: user.id,
          liftedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, reason: true, expiresAt: true, createdAt: true },
      }),
    ]);

    const hasIcerde = activeSubs.some((s) => s.plan === 'ICERDE');
    const hasMasada = activeSubs.some((s) => s.plan === 'MASADA' || s.plan === 'ICERDE');
    const hasKarsimda = activeSubs.some((s) => s.plan === 'KARSIMDA' || s.plan === 'ICERDE');
    const activePlan = hasIcerde ? 'ICERDE' : hasMasada ? 'MASADA' : hasKarsimda ? 'KARSIMDA' : null;

    const { passwordHash, kyc, profile, ...safe } = user;
    return {
      ...safe,
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      isKycVerified: kyc?.status === 'APPROVED',
      kyc: kyc ? { status: kyc.status, rejectReason: kyc.rejectReason ?? null } : undefined,
      activePlan,
      activeSanction: activeSanction ?? null,
      profile: profile ? {
        gender: profile.gender,
        birthDate: profile.birthDate,
        primaryCity: primaryCity ?? undefined,
        topics: profile.topicPreferences ?? [],
        venuePreference: profile.venuePreference,
      } : undefined,
    };
  }

  getActiveCities() {
    return this.prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }
}
