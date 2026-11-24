import { Injectable, BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";
import { KycStatus, MeetingType, ReferralStatus, SubscriptionPlan, SubscriptionStatus } from "../generated/prisma/client";
import { ConfigService } from "@nestjs/config";
import { ensureReferralCode, referralLink } from "./referral-code";
import { GROUP_RIGHTS, groupPartOpen, kankaPartOpen, kankaRightsOf, oneOnOnePartOpen } from "../payment/package-rights";
import { activeKankaLink } from "../kanka/kanka-links";

// Her 3 geçerli davette 1 ücretsiz masa hakkı. Geçerli davet: davet edilen kişi ilk paketini satın almış
// (davet durumu KYC_APPROVED / DISCOUNT_USED: "hak tanımlandı") ve KYC'si onaylanmış.
export const INVITES_PER_REWARD = 3;
// Ödül hakkının türü kullanıcı seçer: tek seferlik paket olarak tanımlanır (Paketim'de diğer haklar gibi görünür)
const REWARD_PLAN: Record<MeetingType, SubscriptionPlan> = {
  [MeetingType.GROUP]: SubscriptionPlan.MASADA,
  [MeetingType.ONE_ON_ONE]: SubscriptionPlan.KARSIMDA,
  [MeetingType.KANKA]: SubscriptionPlan.KANKAMLA,
};

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
  // Aynı türde kullanılmamış hakkı varken o tür seçilemez (satın alma kuralıyla aynı: türü başına tek açık hak).
  async claimReward(userId: string, rewardId: string, type: MeetingType) {
    const plan = REWARD_PLAN[type];
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const reward = await tx.referralReward.findFirst({ where: { id: rewardId, userId } });
      if (!reward) throw new NotFoundException("Ödül bulunamadı.");
      if (reward.claimedAt) throw new ConflictException("Bu ödülün türü zaten seçildi.");
      const active = await tx.subscription.findMany({
        where: { userId, status: SubscriptionStatus.ACTIVE },
        select: { plan: true, groupRights: true, groupCycles: true, usedAt: true, oneOnOneCycles: true, kankaRights: true, kankaCycles: true },
      });
      let open = false;
      if (type === MeetingType.GROUP) open = active.some(groupPartOpen);
      else if (type === MeetingType.ONE_ON_ONE) open = active.some(oneOnOnePartOpen);
      else {
        const link = await activeKankaLink(tx, userId);
        const pair = await tx.subscription.count({
          where: { userId: { in: link ? [userId, link.kankaId] : [userId] }, plan: SubscriptionPlan.KANKAMLA, status: SubscriptionStatus.ACTIVE },
        });
        open = pair > 0 || active.some(kankaPartOpen);
      }
      if (open) throw new ConflictException("Bu türde kullanılmamış hakkın var; hakkını kullandıktan sonra bu türü seçebilirsin.");
      const sub = await tx.subscription.create({
        data: { userId, plan, status: SubscriptionStatus.ACTIVE, groupRights: GROUP_RIGHTS[plan], kankaRights: kankaRightsOf(plan) },
      });
      await tx.referralReward.update({ where: { id: reward.id }, data: { claimedAt: new Date(), plan, subscriptionId: sub.id } });
      return { ok: true, plan };
    });
  }

  async invite(userId: string, phoneNumber: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new BadRequestException("Kullanıcı bulunamadı");

    if (user.phone === phoneNumber) throw new BadRequestException("Kendi numaranı davet edemezsin.");
    // Sınır kontrolü ve kayıt kişi satırı kilitliyken yapılır: eşzamanlı davetler sırayla işlenir
    const referral = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const [registered, invited, todayCount, totalCount] = await Promise.all([
        tx.user.findUnique({ where: { phone: phoneNumber }, select: { id: true } }),
        tx.referral.findFirst({ where: { invitedPhone: phoneNumber }, select: { id: true } }),
        tx.referral.count({ where: { referrerId: userId, createdAt: { gte: trDayStart() } } }),
        tx.referral.count({ where: { referrerId: userId } }),
      ]);
      if (registered) throw new ConflictException("Bu numara zaten Ahenk'e kayıtlı.");
      if (invited) throw new ConflictException("Bu numara daha önce davet edildi.");
      if (totalCount >= TOTAL_INVITE_LIMIT) {
        throw new BadRequestException(`Toplam davet hakkın doldu (${TOTAL_INVITE_LIMIT}).`);
      }
      if (todayCount >= DAILY_INVITE_LIMIT) {
        throw new BadRequestException(`Günlük davet hakkın doldu (${DAILY_INVITE_LIMIT}). Yarın tekrar deneyebilirsin.`);
      }
      return tx.referral.create({
        data: { referrerId: userId, invitedPhone: phoneNumber, status: ReferralStatus.PENDING },
      });
    });

    const appUrl = this.config.get<string>("APP_URL") ?? "https://ahenk.co";
    const inviteLink = `${appUrl}/kayit?ref=${referral.inviteCode}`;
    const fullName = `${user.profile?.firstName ?? ""} ${user.profile?.lastName ?? ""}`.trim();

    try {
      await this.whatsapp.send(phoneNumber, "ahenk_referral_invite", [fullName, inviteLink]);
    } catch {
      // Gönderilemeyen davet hakkı yemesin
      await this.prisma.referral.delete({ where: { id: referral.id } });
      throw new ServiceUnavailableException("Davet gönderilemedi, lütfen tekrar dene.");
    }

    return { ok: true, inviteCode: referral.inviteCode };
  }
}
