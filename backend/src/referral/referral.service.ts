import { Injectable, BadRequestException, ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";
import { ReferralStatus } from "@prisma/client";
import { ConfigService } from "@nestjs/config";

// Kullanıcı başına davet sınırları
const DAILY_INVITE_LIMIT = 2;
const TOTAL_INVITE_LIMIT = 10;

// TR gününün başlangıcı (UTC+3 sabit)
function trDayStart(now = new Date()): Date {
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()) - 3 * 60 * 60 * 1000);
}

@Injectable()
export class ReferralService {
  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappNotifyService,
    private config: ConfigService,
  ) {}

  async getMyStats(userId: string) {
    const [totalInvites, availableDiscounts] = await Promise.all([
      this.prisma.referral.count({ where: { referrerId: userId, status: { not: ReferralStatus.PENDING } } }),
      this.prisma.referral.count({ where: { referrerId: userId, status: ReferralStatus.KYC_APPROVED } }),
    ]);
    return { totalInvites, availableDiscounts };
  }

  async invite(userId: string, phoneNumber: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new BadRequestException("Kullanıcı bulunamadı");

    if (user.phone === phoneNumber) throw new BadRequestException("Kendi numaranızı davet edemezsiniz.");
    const [registered, invited, todayCount, totalCount] = await Promise.all([
      this.prisma.user.findUnique({ where: { phone: phoneNumber }, select: { id: true } }),
      this.prisma.referral.findFirst({ where: { invitedPhone: phoneNumber }, select: { id: true } }),
      this.prisma.referral.count({ where: { referrerId: userId, createdAt: { gte: trDayStart() } } }),
      this.prisma.referral.count({ where: { referrerId: userId } }),
    ]);
    if (registered) throw new ConflictException("Bu numara zaten Ahenk'e kayıtlı.");
    if (invited) throw new ConflictException("Bu numara daha önce davet edildi.");
    if (totalCount >= TOTAL_INVITE_LIMIT) {
      throw new BadRequestException(`Toplam davet hakkınız doldu (${TOTAL_INVITE_LIMIT}).`);
    }
    if (todayCount >= DAILY_INVITE_LIMIT) {
      throw new BadRequestException(`Günlük davet hakkınız doldu (${DAILY_INVITE_LIMIT}). Yarın tekrar deneyebilirsiniz.`);
    }

    const referral = await this.prisma.referral.create({
      data: { referrerId: userId, invitedPhone: phoneNumber, status: ReferralStatus.PENDING },
    });

    const appUrl = this.config.get<string>("APP_URL") ?? "https://ahenk.co";
    const inviteLink = `${appUrl}/kayit?ref=${referral.inviteCode}`;
    const fullName = `${user.profile?.firstName ?? ""} ${user.profile?.lastName ?? ""}`.trim();

    try {
      await this.whatsapp.send(phoneNumber, "ahenk_referral_invite", [fullName, inviteLink]);
    } catch {
      // Gönderilemeyen davet hakkı yemesin
      await this.prisma.referral.delete({ where: { id: referral.id } });
      throw new ServiceUnavailableException("Davet gönderilemedi, lütfen tekrar deneyin.");
    }

    return { ok: true, inviteCode: referral.inviteCode };
  }

  async applyReferrerDiscount(userId: string): Promise<{ referralId: string; discountKurus: number; originalKurus: number } | null> {
    const referral = await this.prisma.referral.findFirst({
      where: { referrerId: userId, status: ReferralStatus.KYC_APPROVED },
    });
    return referral ? { referralId: referral.id, discountKurus: 0, originalKurus: 0 } : null;
  }

  async markReferrerDiscountUsed(referralId: string) {
    await this.prisma.referral.update({
      where: { id: referralId },
      data: { discountUsedAt: new Date(), status: ReferralStatus.DISCOUNT_USED },
    });
  }

  async markInviteeDiscountUsed(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { referralDiscountAvailable: false },
    });
  }
}
