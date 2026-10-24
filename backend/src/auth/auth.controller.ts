import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCookieAuth,
} from "@nestjs/swagger";
import { Response, Request } from "express";
import { ConfigService } from "@nestjs/config";
import { Throttle, SkipThrottle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { SendOtpDto, VerifyOtpDto, SendLoginOtpDto, VerifyLoginOtpDto, ForgotPasswordDto, ResetPasswordDto, RegisterSendOtpDto, RegisterVerifyOtpDto } from "./dto/send-otp.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { JwtRefreshGuard } from "./guards/jwt-refresh.guard";
import { CurrentUser } from "./decorators/current-user.decorator";

import { ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE } from "./auth-cookies";

@ApiTags("Auth")
@Controller("auth")
@Throttle({ default: { ttl: 60000, limit: 10 } })
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  @Post("register/send-otp")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: "Kayıt — telefon doğrulama kodu gönder (public)" })
  async registerSendOtp(@Body() dto: RegisterSendOtpDto) {
    return this.authService.registerSendOtp(dto.phone);
  }

  @Post("register/verify-otp")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: "Kayıt — telefon doğrulama kodunu kontrol et (public)" })
  async registerVerifyOtp(@Body() dto: RegisterVerifyOtpDto) {
    return this.authService.registerVerifyOtp(dto.phone, dto.code);
  }

  @Post("register")
  @ApiOperation({ summary: "Yeni hesap oluştur" })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip;
    const userAgent = req.headers["user-agent"];
    const { user, accessToken, refreshToken } = await this.authService.register(dto, ip, userAgent);
    return this.issueSession(req, res, user, accessToken, refreshToken);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Giriş yap" })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.authService.login(dto);
    return this.issueSession(req, res, user, accessToken, refreshToken);
  }

  // Guard yok: refresh token geçersiz/eksik olsa da oturum çerezleri her durumda silinir
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Çıkış yap" })
  @ApiCookieAuth()
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (raw) await this.authService.logoutByRefreshToken(raw);
    this.clearSession(res);
    return { message: "Çıkış yapıldı" };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({ summary: "Access token yenile (httpOnly cookie gerekli)" })
  @ApiCookieAuth()
  async refresh(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user: updatedUser, accessToken, refreshToken } =
      await this.authService.refreshTokens(user.id, user.refreshTokenJti);
    return this.issueSession(req, res, updatedUser, accessToken, refreshToken);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: "Mevcut kullanıcı bilgisi" })
  me(@CurrentUser() user: any) {
    return this.authService.getMe(user);
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: "Şifre sıfırlama — WhatsApp kodu gönder (public)" })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.phone);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: "Şifre sıfırlama — kod + yeni şifre (public)" })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.phone, dto.code, dto.newPassword);
  }

  @Post("send-login-otp")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: "WhatsApp OTP ile giriş — kod gönder (public)" })
  async sendLoginOtp(@Body() dto: SendLoginOtpDto) {
    return this.authService.sendLoginOtp(dto.phone);
  }

  @Post("verify-login-otp")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: "WhatsApp OTP ile giriş — kodu doğrula (public)" })
  async verifyLoginOtp(
    @Body() dto: VerifyLoginOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.authService.verifyLoginOtp(dto.phone, dto.code);
    return this.issueSession(req, res, user, accessToken, refreshToken);
  }

  @Post("send-otp")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "WhatsApp OTP gönder (telefon doğrulama)" })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Post("verify-otp")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "WhatsApp OTP doğrula" })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }

  @Get("cities")
  @ApiOperation({ summary: "Aktif şehirleri listele (public)" })
  getCities() {
    return this.authService.getActiveCities();
  }

  // ─── Yardımcılar ─────────────────────────────────────────────────────────

  private isProduction() {
    return this.config.get("NODE_ENV") === "production";
  }

  private refreshMaxAge() {
    return durationMs(this.config.get("JWT_REFRESH_EXPIRES") ?? "7d");
  }

  private cookieOptions() {
    const isProduction = this.isProduction();
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ("strict" as const) : ("lax" as const),
      maxAge: this.refreshMaxAge(),
      path: "/api/v1/auth",
    };
  }

  // Erişim token'ı: JS okuyamaz (HttpOnly), sadece API isteklerine gider
  private accessCookieOptions() {
    const isProduction = this.isProduction();
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ("strict" as const) : ("lax" as const),
      maxAge: durationMs(this.config.get("JWT_ACCESS_EXPIRES") ?? "15m"),
      path: "/api/v1",
    };
  }

  // Oturum işareti: gizli değer taşımaz ("1"); web middleware'i ve arayüz oturum var mı diye bakar.
  // Lax: ödeme dönüşü gibi dış siteden gelen yönlendirmelerde de gönderilir.
  private sessionCookieOptions() {
    return {
      httpOnly: false,
      secure: this.isProduction(),
      sameSite: "lax" as const,
      maxAge: this.refreshMaxAge(),
      path: "/",
    };
  }

  // Çerezleri yazar. Tarayıcı isteğinde (Origin başlığı var) token yanıt gövdesine konmaz;
  // Origin'siz istemciler (Bearer kullanan uygulamalar) token'ı gövdeden alır.
  private issueSession(req: Request, res: Response, user: unknown, accessToken: string, refreshToken: string) {
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions());
    res.cookie(ACCESS_COOKIE, accessToken, this.accessCookieOptions());
    res.cookie(SESSION_COOKIE, "1", this.sessionCookieOptions());
    return req.headers.origin ? { user } : { user, accessToken };
  }

  private clearSession(res: Response) {
    const strip = <T extends { maxAge?: number }>({ maxAge: _m, ...rest }: T) => rest;
    res.clearCookie(REFRESH_COOKIE, strip(this.cookieOptions()));
    res.clearCookie(ACCESS_COOKIE, strip(this.accessCookieOptions()));
    res.clearCookie(SESSION_COOKIE, strip(this.sessionCookieOptions()));
  }
}

// "15m", "7d", "1h", "30s" → milisaniye
function durationMs(value: string): number {
  const m = /^(\d+)\s*([smhd]?)$/.exec(value.trim());
  if (!m) return 15 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000, "": 1000 }[m[2] as "s" | "m" | "h" | "d" | ""];
  return n * unit;
}
