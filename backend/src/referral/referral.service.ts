import { Injectable, ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { KycStatus, MeetingType, ReferralStatus, SubscriptionPlan, SubscriptionStatus } from "../generated/prisma/client";
import { ensureReferralCode, referralLink } from "./referral-code";
import { GROUP_RIGHTS, kankaRightsOf } from "../payment/package-rights";

// Her 3 geçerli davette 1 ücretsiz masa hakkı. Geçerli davet: davet edilen kişi ilk paketini satın almış
// (davet durumu KYC_APPROVED / DISCOUNT_USED: "hak tanımlandı") ve KYC'si onaylanmış.
export const INVITES_PER_REWARD = 3;
// Ödül hakkının türü kullanıcı seçer: tek seferlik paket olarak tanımlanır (Paketim'de diğer haklar gibi görünür)
const REWARD_PLAN: Record<MeetingType, SubscriptionPlan> = {
  [MeetingType.GROUP]: SubscriptionPlan.MASADA,
  [MeetingType.ONE_ON_ONE]: SubscriptionPlan.KARSIMDA,
  [MeetingType.KANKA]: SubscriptionPlan.KANKAMLA,
};

@Injectable()
export class ReferralService {
  constructor(private prisma: PrismaService) {}

  async getMyStats(userId: string) {
    const [totalInvites, availableDiscounts, code, validInvites] = await Promise.all([
      this.prisma.referral.count({ where: { referrerId: userId, status: { not: ReferralStatus.PENDING } } }),
      this.prisma.referral.count({ where: { referrerId: userId, status: ReferralStatus.KYC_APPROVED } }),
      ensureReferralCode(this.prisma, userId),
      this.validInviteCount(userId),
    ]);
    const pendingRewards = await this.syncRewards(userId, validInvites);
    return {
      totalInvites,
      availableDiscounts,
      referralCode: code,
      inviteLink: referralLink(code),
      validInvites,
      invitesToNextReward: INVITES_PER_REWARD - (validInvites % INVITES_PER_REWARD),
      pendingRewards,
    };
  }

  private validInviteCount(userId: string) {
    return this.prisma.referral.count({
      where: {
        referrerId: userId,
        status: { in: [ReferralStatus.KYC_APPROVED, ReferralStatus.DISCOUNT_USED] },
        referred: { kyc: { status: KycStatus.APPROVED } },
      },
    });
  }

  // Kazanılan ödül sayısı = geçerli davet / 3 (aşağı yuvarlanır); eksik ödül kaydı oluşturulur, türü seçilmemişler döner
  private async syncRewards(userId: string, validInvites: number) {
    const earned = Math.floor(validInvites / INVITES_PER_REWARD);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const have = await tx.referralReward.count({ where: { userId } });
      if (earned > have) {
        await tx.referralReward.createMany({ data: Array.from({ length: earned - have }, () => ({ userId })) });
      }
      return tx.referralReward.findMany({ where: { userId, claimedAt: null }, select: { id: true, createdAt: true }, orderBy: { createdAt: "asc" } });
    });
  }

  // Ödül hakkının türünü seç: 1 Grup / Baş Başa / Kankamla masası hakkı tek seferlik paket olarak tanımlanır.
  // Aynı türden haklar birikir (engel yok); Paketim'de türüne göre toplam adet görünür.
  async claimReward(userId: string, rewardId: string, type: MeetingType) {
    const plan = REWARD_PLAN[type];
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const reward = await tx.referralReward.findFirst({ where: { id: rewardId, userId } });
      if (!reward) throw new NotFoundException("Ödül bulunamadı.");
      if (reward.claimedAt) throw new ConflictException("Bu ödülün türü zaten seçildi.");
      const sub = await tx.subscription.create({
        data: { userId, plan, status: SubscriptionStatus.ACTIVE, groupRights: GROUP_RIGHTS[plan], kankaRights: kankaRightsOf(plan) },
      });
      await tx.referralReward.update({ where: { id: reward.id }, data: { claimedAt: new Date(), plan, subscriptionId: sub.id } });
      return { ok: true, plan };
    });
  }
}
