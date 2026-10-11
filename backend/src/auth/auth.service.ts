import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
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
import { ConsentType, UserRole, SubscriptionStatus, ReferralStatus } from "@prisma/client";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    private otpService: OtpService,
  ) {}

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
    if (user.status === "DELETED") throw new ForbiddenException("Bu hesap silinmiş");
    if (user.status === "SUSPENDED") throw new ForbiddenException("Bu hesap askıya alınmış");

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
    if (user.status === "DELETED") throw new ForbiddenException("Bu hesap silinmiş");
    if (user.status === "SUSPENDED") throw new ForbiddenException("Bu hesap askıya alınmış");
    await this.otpService.send(phone);
    return { message: "Doğrulama kodu gönderildi" };
  }

  async verifyLoginOtp(phone: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: { profile: true },
    });
    if (!user) throw new UnauthorizedException("Hesap bulunamadı");
    if (user.status === "DELETED") throw new ForbiddenException("Bu hesap silinmiş");
    if (user.status === "SUSPENDED") throw new ForbiddenException("Bu hesap askıya alınmış");

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
    const { passwordHash, kyc, ...safe } = user;
    return {
      ...safe,
      isKycVerified: kyc?.status === "APPROVED",
    };
  }

  async getMe(user: any) {
    const [primaryCity, activeSubs] = await Promise.all([
      user.profile?.primaryCity
        ? this.prisma.city.findUnique({ where: { id: user.profile.primaryCity }, select: { id: true, name: true } })
        : Promise.resolve(null),
      this.prisma.subscription.findMany({
        where: { userId: user.id, status: SubscriptionStatus.ACTIVE },
        select: { plan: true },
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
      kyc: kyc ? { status: kyc.status } : undefined,
      activePlan,
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
