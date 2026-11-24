import { Injectable, NotFoundException } from "@nestjs/common";
import { MeetingType, ParticipantStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ensureReferralCode, referralLink } from "../referral/referral-code";

// Paylaşım kartı teaser'ları masa türüne göre 10'ar metin (i18n share.teasers.<TÜR>.<0-9>); 10'dan sonra başa döner
export const TEASER_COUNT = 10;

type ReportRow = { content: string; uyumSkoru: number; generatedAt: Date; detail: unknown };
type ReportLang = { questions: string[]; dna: string; dnaShort: string; comment: string };

// Yapay Zekâ Masa Raporu: kullanıcının dilindeki sürüm (eski raporlarda yalnız content + uyumSkoru vardır)
export function localizeAiReport(r: ReportRow, lang: string) {
  const d = (r.detail ?? null) as { tr?: ReportLang; en?: ReportLang } | null;
  const l = (lang === "en" ? d?.en : d?.tr) ?? null;
  return {
    content: l?.comment ?? r.content,
    uyumSkoru: r.uyumSkoru,
    generatedAt: r.generatedAt,
    questions: l?.questions ?? null,
    dna: l?.dna ?? null,
    dnaShort: l?.dnaShort ?? null,
  };
}

@Injectable()
export class ShareCardService {
  constructor(private prisma: PrismaService) {}

  // Kart açıldıktan sonra (buluşma günü 10:00, mekân belli) masanın katılımcısı paylaşım kartını alabilir.
  // Kartta yalnız masa bilgisi ve rapor özeti döner; diğer katılımcılara ait hiçbir bilgi dönmez.
  private async revealedMeeting(meetingId: string, userId: string) {
    const part = await this.prisma.meetingParticipant.findFirst({
      where: { meetingId, userId, status: { notIn: [ParticipantStatus.CANCELLED, ParticipantStatus.DECLINED] } },
      select: { meeting: { select: { id: true, type: true, scheduledAt: true, locationText: true, aiReport: true } } },
    });
    const m = part?.meeting;
    const revealed = !!m?.locationText && Date.now() >= m.scheduledAt.getTime() - 10 * 60 * 60 * 1000;
    if (!m || !revealed || !m.aiReport) throw new NotFoundException("Paylaşım kartı henüz hazır değil.");
    return m;
  }

  // Kartın teaser'ı: ilk açılışta kullanıcının o masa türündeki sıradaki teaser'ı atanır ve sıra bir ilerler
  private async teaserIndex(userId: string, meetingId: string, type: MeetingType): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.shareTeaser.findUnique({ where: { userId_meetingId: { userId, meetingId } } });
      if (existing) return existing.index;
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const again = await tx.shareTeaser.findUnique({ where: { userId_meetingId: { userId, meetingId } } });
      if (again) return again.index;
      const cursor = await tx.teaserCursor.findUnique({ where: { userId_type: { userId, type } } });
      const index = (cursor?.next ?? 0) % TEASER_COUNT;
      await tx.teaserCursor.upsert({
        where: { userId_type: { userId, type } },
        create: { userId, type, next: (index + 1) % TEASER_COUNT },
        update: { next: (index + 1) % TEASER_COUNT },
      });
      await tx.shareTeaser.create({ data: { userId, meetingId, index } });
      return index;
    });
  }

  async get(meetingId: string, userId: string) {
    const m = await this.revealedMeeting(meetingId, userId);
    const [user, teaser, code] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { language: true } }),
      this.teaserIndex(userId, meetingId, m.type),
      ensureReferralCode(this.prisma, userId),
    ]);
    const report = localizeAiReport(m.aiReport!, user?.language ?? "tr");
    return {
      type: m.type,
      uyumSkoru: report.uyumSkoru,
      dnaShort: report.dnaShort,
      venueName: m.locationText,
      scheduledAt: m.scheduledAt,
      teaser,
      inviteCode: code,
      inviteLink: code == null ? null : referralLink(code),
    };
  }

  // "Değiştir": bu kartın teaser'ı listedeki bir sonrakiyle değişir
  async nextTeaser(meetingId: string, userId: string) {
    const m = await this.revealedMeeting(meetingId, userId);
    const index = await this.teaserIndex(userId, meetingId, m.type);
    const next = (index + 1) % TEASER_COUNT;
    await this.prisma.shareTeaser.update({ where: { userId_meetingId: { userId, meetingId } }, data: { index: next } });
    return { teaser: next };
  }
}
