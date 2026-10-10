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
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { SendOtpDto, VerifyOtpDto } from "./dto/send-otp.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { JwtRefreshGuard } from "./guards/jwt-refresh.guard";
import { CurrentUser } from "./decorators/current-user.decorator";

const REFRESH_COOKIE = "refresh_token";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

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
    this.setRefreshCookie(res, refreshToken);
    return { user, accessToken };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Giriş yap" })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.authService.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return { user, accessToken };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({ summary: "Çıkış yap" })
  @ApiCookieAuth()
  async logout(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.id, user.refreshTokenJti);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
    return { message: "Çıkış yapıldı" };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({ summary: "Access token yenile (httpOnly cookie gerekli)" })
  @ApiCookieAuth()
  async refresh(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user: updatedUser, accessToken, refreshToken } =
      await this.authService.refreshTokens(user.id, user.refreshTokenJti);
    this.setRefreshCookie(res, refreshToken);
    return { user: updatedUser, accessToken };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Mevcut kullanıcı bilgisi" })
  me(@CurrentUser() user: any) {
    return this.authService.sanitizeUser(user);
  }

  @Post("send-otp")
  @HttpCode(HttpStatus.OK)
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

  // ─── Yardımcılar ─────────────────────────────────────────────────────────

  private cookieOptions() {
    const isProduction = this.config.get("NODE_ENV") === "production";
    const refreshDays = parseInt(
      (this.config.get("JWT_REFRESH_EXPIRES") ?? "7d").replace("d", ""),
      10,
    );
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ("strict" as const) : ("lax" as const),
      maxAge: refreshDays * 24 * 60 * 60 * 1000,
      path: "/api/v1/auth",
    };
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, this.cookieOptions());
  }
}
