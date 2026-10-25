import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import { activeNoShowWarningsWhere } from "../admin/no-show-warnings";
import { NO_SHOW_WARNING_LIMIT } from "../admin/sanction-reasons";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { isMaintenanceMode } from "../admin/app-settings";
import { groupPartOpen, oneOnOnePartOpen } from "../payment/package-rights";
import { UsersService } from "../users/users.service";
import { OtpService, OTP_RESEND_SECONDS } from "./otp/otp.service";
import { RedisService } from "../redis/redis.service";
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
    private redis: RedisService,
  ) {}

  // ─── Kayıt: telefon doğrulama (hesap oluşmadan önce WhatsApp OTP) ────────

  async registerSendOtp(phone: string) {
    const used = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (used) throw new ConflictException("Bu telefon numarası zaten kullanılıyor");
    await this.otpService.send(phone);
    return { message: "Doğrulama kodu gönderildi", resendSeconds: OTP_RESEND_SECONDS };
  }

  // Doğru kod → 30 dk geçerli telefon anahtarı; kayıt bu anahtar olmadan yapılamaz
  async registerVerifyOtp(phone: string, code: string) {
    await this.otpService.verify(phone, code);
    const phoneToken = randomUUID();
    await this.redis.set(`regphone:${phone}`, phoneToken, 30 * 60);
    return { phoneToken };
  }

  // ─── Aktif yaptırım kontrolü ─────────────────────────────────────────────

  private async checkSanction(userId: string, status: string): Promise<void> {
    if (status === 'DELETED') throw new ForbiddenException("Bu hesap silinmiş");

    if (status === 'BANNED' || status === 'SUSPENDED') {
      const sanction = await this.prisma.userSanction.findFirst({
        where: {
          userId,
          liftedAt: null,
          // Uyarılar girişi engellemez; sadece askı/ban
          type: { in: [SanctionType.BAN, SanctionType.SUSPENSION] },
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

    if (dto.primaryCityId) {
      const city = await this.prisma.city.findUnique({ where: { id: dto.primaryCityId }, select: { isActive: true } });
      if (!city?.isActive) throw new BadRequestException("Seçilen şehir şu an aktif değil");
    }

    const phoneExists = await this.prisma.user.findUnique({ where: { phone: dto.phoneNumber } });
    if (phoneExists) throw new ConflictException("Bu telefon numarası zaten kullanılıyor");
    // Telefon WhatsApp OTP ile doğrulanmış olmalı
    const phoneToken = await this.redis.get(`regphone:${dto.phoneNumber}`);
    if (!phoneToken || phoneToken !== dto.phoneToken) {
      throw new BadRequestException("Telefon doğrulaması geçersiz ya da süresi doldu. Lütfen numaranı tekrar doğrula.");
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          phone: dto.phoneNumber,
          phoneVerified: true,
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
    await this.redis.del(`regphone:${dto.phoneNumber}`);

    // Referral kodu ile geldiyse ilişkilendir
    if (dto.referralCode) {
      // Davet sadece davet edilen numarayla kayıt olunca geçerli
      await this.prisma.referral.updateMany({
        where: { inviteCode: dto.referralCode, status: ReferralStatus.PENDING, invitedPhone: dto.phoneNumber },
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

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) throw new UnauthorizedException("E-posta veya şifre hatalı");
    // Yaptırım bilgisi sadece şifre doğruysa gösterilir
    await this.checkSanction(user.id, user.status);

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

  // Çerezdeki refresh token'ı iptal eder; imza geçersizse sessizce geçer (çerezler yine silinir)
  async logoutByRefreshToken(rawToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; jti: string }>(rawToken, {
        secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
        ignoreExpiration: true,
      });
      if (payload?.sub && payload?.jti) await this.logout(payload.sub, payload.jti);
    } catch { /* geçersiz token: iptal edilecek kayıt yok */ }
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
    // Yaptırım kontrolü kod doğrulandıktan sonra yapılır (verifyLoginOtp)
    await this.otpService.send(phone);
    return { message: "Doğrulama kodu gönderildi" };
  }

  // ─── Şifre sıfırlama (WhatsApp kodu) ──────────────────────────────────────

  async forgotPassword(phone: string) {
    const user = await this.prisma.user.findUnique({ where: { phone }, select: { id: true, isBot: true } });
    if (!user || user.isBot) throw new NotFoundException("Bu telefon numarasıyla kayıtlı hesap bulunamadı");
    await this.otpService.send(phone);
    return { message: "Doğrulama kodu gönderildi" };
  }

  async resetPassword(phone: string, code: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { phone }, select: { id: true, isBot: true } });
    if (!user || user.isBot) throw new NotFoundException("Bu telefon numarasıyla kayıtlı hesap bulunamadı");

    await this.otpService.verify(phone, code);

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    // Tüm oturumlar kapatılır
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revoked: false },
      data: { revoked: true },
    });
    return { message: "Şifre güncellendi" };
  }

  async verifyLoginOtp(phone: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: { profile: true },
    });
    if (!user) throw new UnauthorizedException("Hesap bulunamadı");

    await this.otpService.verify(phone, code);
    // Yaptırım bilgisi sadece kod doğruysa gösterilir
    await this.checkSanction(user.id, user.status);

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

  // Girişte gösterilecek yaptırım: önce aktif askı/ban, yoksa son askıdan sonraki kaldırılmamış en son uyarı
  private async currentSanction(userId: string) {
    const select = { id: true, type: true, reason: true, expiresAt: true, createdAt: true } as const;
    const hard = await this.prisma.userSanction.findFirst({
      where: {
        userId,
        liftedAt: null,
        type: { in: [SanctionType.BAN, SanctionType.SUSPENSION] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
      select,
    });
    if (hard) return hard;
    const lastSuspension = await this.prisma.userSanction.findFirst({
      where: { userId, type: SanctionType.SUSPENSION },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return this.prisma.userSanction.findFirst({
      where: {
        userId,
        type: SanctionType.WARNING,
        liftedAt: null,
        ...(lastSuspension ? { createdAt: { gt: lastSuspension.createdAt } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select,
    });
  }

  async getMe(user: any) {
    const [primaryCity, activeSubs, activeSanction, maintenanceMode] = await Promise.all([
      user.profile?.primaryCity
        ? this.prisma.city.findUnique({ where: { id: user.profile.primaryCity }, select: { id: true, name: true } })
        : Promise.resolve(null),
      this.prisma.subscription.findMany({
        where: { userId: user.id, status: SubscriptionStatus.ACTIVE },
        select: { plan: true, groupRights: true, groupCycles: true, usedAt: true, oneOnOneCycles: true },
      }),
      this.currentSanction(user.id),
      isMaintenanceMode(this.prisma),
    ]);
    // Profildeki sarı uyarı için gelmedi uyarı sayacı (askıdan sonra sıfırlanır)
    const noShowCount = await this.prisma.userSanction.count({ where: await activeNoShowWarningsWhere(this.prisma, user.id) });

    // Paketin açık kısmına göre (hak kalmış ve 4 döngü dolmamış): grup / başbaşa
    const hasMasada = activeSubs.some(groupPartOpen);
    const hasKarsimda = activeSubs.some(oneOnOnePartOpen);
    const hasIcerde = hasMasada && hasKarsimda && activeSubs.some((s) => s.plan === 'ICERDE');
    const activePlan = hasIcerde ? 'ICERDE' : hasMasada ? 'MASADA' : hasKarsimda ? 'KARSIMDA' : null;

    const { passwordHash, kyc, profile, ...safe } = user;
    return {
      ...safe,
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      isKycVerified: kyc?.status === 'APPROVED',
      kyc: kyc ? { status: kyc.status, rejectReason: kyc.rejectReason ?? null } : undefined,
      activePlan,
      // Tüm aktif paketler (paket kartı kuralı: Masada + Karşımda birlikte olabilir)
      ownedPlans: [...new Set(activeSubs.map((s) => s.plan))],
      // Açık kısımlar (hak kalmış, 4 döngü dolmamış): satın alma kuralı bunlara göre
      openParts: { group: hasMasada, oneOnOne: hasKarsimda },
      activeSanction: activeSanction ?? null,
      noShowWarning: noShowCount > 0
        ? { count: noShowCount, remaining: Math.max(NO_SHOW_WARNING_LIMIT - noShowCount, 0) }
        : null,
      maintenanceMode,
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
