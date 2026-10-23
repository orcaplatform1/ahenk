import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";
import { ReferralStatus } from "@prisma/client";
import { ConfigService } from "@nestjs/config";

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

    const referral = await this.prisma.referral.create({
      data: { referrerId: userId, invitedPhone: phoneNumber, status: ReferralStatus.PENDING },
    });

    const appUrl = this.config.get<string>("APP_URL") ?? "https://ahenk.co";
    const inviteLink = `${appUrl}/kayit?ref=${referral.inviteCode}`;
    const fullName = `${user.profile?.firstName ?? ""} ${user.profile?.lastName ?? ""}`.trim();

    await this.whatsapp.send(phoneNumber, "ahenk_referral_invite", [fullName, inviteLink]);

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
