import { Injectable, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OtpService } from "../auth/otp/otp.service";
import { VenuePreference, Prisma } from "../generated/prisma/client";
import bcrypt from "bcryptjs";

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private otpService: OtpService,
  ) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        kyc: { select: { status: true } },
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
  }

  // Sadece aktif şehir seçilebilir (pasif şehirler kayıtta ve profilde listelenmez)
  private async assertActiveCity(cityId: string) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { isActive: true } });
    if (!city?.isActive) throw new BadRequestException("Bu şehir şu an aktif değil");
  }

  // Ana şehir (primaryCity) üye tarafından değiştirilemez; yalnız admin panelinden (admin.service updateUser cityId) düzeltilir

  async updateVenuePreference(userId: string, venuePreference: VenuePreference) {
    await this.prisma.profile.update({
      where: { userId },
      data: { venuePreference },
    });
    return { ok: true };
  }

  async updateActiveCity(userId: string, activeCityId: string | null) {
    if (activeCityId) await this.assertActiveCity(activeCityId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { activeCity: activeCityId },
    });
    return { ok: true };
  }

  async updateLanguage(userId: string, language: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { language: language === "en" ? "en" : "tr" } });
    return { ok: true };
  }

  // Başka konuşulan diller; ana dilin (nativeLanguage) alanı her zaman true kalır, kapatılamaz
  async updateSpokenLanguages(userId: string, dto: { speaksEnglish?: boolean; speaksTurkish?: boolean }) {
    const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { nativeLanguage: true } });
    const native = me?.nativeLanguage === "en" ? "en" : "tr";
    const data: { speaksEnglish?: boolean; speaksTurkish?: boolean } = {};
    if (typeof dto.speaksEnglish === "boolean") data.speaksEnglish = dto.speaksEnglish;
    if (typeof dto.speaksTurkish === "boolean") data.speaksTurkish = dto.speaksTurkish;
    if (native === "en") data.speaksEnglish = true;
    else data.speaksTurkish = true;
    const u = await this.prisma.user.update({ where: { id: userId }, data, select: { speaksEnglish: true, speaksTurkish: true } });
    return u;
  }

  // Yalnız pasif bölgeye kayıt olunur; aynı kullanıcı aynı bölgeye bir kez (tekrar istek hata vermez)
  async joinRegionWaitlist(userId: string, cityId: string) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { isActive: true } });
    if (!city) throw new BadRequestException("Bölge bulunamadı");
    if (city.isActive) throw new BadRequestException("Bu bölge zaten açık");
    await this.prisma.regionWaitlist.upsert({ where: { userId_cityId: { userId, cityId } }, create: { userId, cityId }, update: {} });
    return { ok: true };
  }

  async myRegionWaitlist(userId: string) {
    const rows = await this.prisma.regionWaitlist.findMany({ where: { userId }, select: { cityId: true } });
    return rows.map((r) => r.cityId);
  }

  async requestPhoneChange(userId: string, newPhone: string) {
    const existing = await this.prisma.user.findUnique({ where: { phone: newPhone } });
    if (existing && existing.id === userId) throw new BadRequestException("Bu numara zaten hesabınızda kayıtlı.");
    if (existing) throw new ConflictException("Bu telefon numarası kullanılmaktadır.");
    const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { language: true } });
    const resendSeconds = await this.otpService.send(newPhone, "change-phone", me?.language ?? "tr");
    return { ok: true, resendSeconds };
  }

  async verifyPhoneChange(userId: string, newPhone: string, code: string) {
    // Kod gönderildikten sonra numara başka hesaba geçmiş olabilir → kod harcanmadan kontrol
    const existing = await this.prisma.user.findUnique({ where: { phone: newPhone } });
    if (existing && existing.id !== userId) throw new ConflictException("Bu telefon numarası kullanılmaktadır.");
    await this.otpService.verify(newPhone, code, "change-phone");
    try {
      await this.prisma.user.update({ where: { id: userId }, data: { phone: newPhone } });
    } catch (e) {
      // Kontrol ile kayıt arasında aynı numara alınmışsa (unique ihlali)
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("Bu telefon numarası kullanılmaktadır.");
      }
      throw e;
    }
    return { ok: true };
  }

  async changeEmail(userId: string, newEmail: string, currentPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new BadRequestException("Şifre bulunamadı.");
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException("Şifrenizi yanlış girdiniz.");
    const existing = await this.prisma.user.findUnique({ where: { email: newEmail } });
    if (existing && existing.id !== userId) throw new ConflictException("Bu e-posta adresi kullanılmaktadır.");
    await this.prisma.user.update({ where: { id: userId }, data: { email: newEmail } });
    return { ok: true };
  }

}
