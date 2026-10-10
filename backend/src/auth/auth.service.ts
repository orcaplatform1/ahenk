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
import { ConsentType, UserRole } from "@prisma/client";

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

    if (dto.phone) {
      const existingPhone = await this.usersService.findByPhone(dto.phone);
      if (existingPhone) throw new ConflictException("Bu telefon numarası zaten kullanılıyor");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: UserRole.USER,
        profile: {
          create: {
            firstName: dto.firstName,
            lastName: dto.lastName,
          },
        },
        consents: {
          createMany: {
            data: [
              { type: ConsentType.TERMS_OF_SERVICE, accepted: true, ip, userAgent },
              { type: ConsentType.PRIVACY_POLICY, accepted: true, ip, userAgent },
              ...(dto.acceptMarketing
                ? [
                    { type: ConsentType.MARKETING_EMAIL, accepted: true, ip, userAgent },
                    { type: ConsentType.MARKETING_SMS, accepted: true, ip, userAgent },
                  ]
                : []),
            ],
          },
        },
      },
      include: { profile: true },
    });

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
}
