import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import * as fs from "fs";
import * as path from "path";
import { Prisma, UserStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { isAutoDataDeletionEnabled } from "../admin/app-settings";
import { hashPhone } from "../users/account-deletion.service";
import { PROFILE_PHOTO_DIR } from "../profile-photo/profile-photo.util";
import { PROBLEM_REPORT_DIR } from "../problem-reports/problem-reports.service";
import { decryptKyc, KYC_ENC_SUFFIX } from "../kyc/kyc-crypto";
import { buildZip } from "../common/zip";
import { RETENTION_JOB_CRON, RETENTION_JOB_TZ, RETENTION_POLICY, type RetentionCategoryId } from "./retention-policy";

// Bir kategorideki saklanan kayıt: süre başlangıcı ve süre sonu (null: süre işlemiyor; ör. hesap silinmedi, olay kapanmadı, süresiz)
type Candidate = { id: string; userId: string | null; start: Date | null; expiresAt: Date | null };

const TR_OFFSET_MS = 3 * 60 * 60 * 1000; // Europe/Istanbul sabit UTC+3
const trYear = (d: Date) => new Date(d.getTime() + TR_OFFSET_MS).getUTCFullYear();
const startOfTrYear = (y: number) => new Date(Date.UTC(y, 0, 1) - TR_OFFSET_MS);
const addYears = (d: Date, n: number) => { const x = new Date(d); x.setUTCFullYear(x.getUTCFullYear() + n); return x; };
const maxDate = (ds: (Date | null | undefined)[]) => ds.filter((d): d is Date => !!d).reduce<Date | null>((a, d) => (!a || d > a ? d : a), null);
const minDate = (ds: (Date | null | undefined)[]) => ds.filter((d): d is Date => !!d).reduce<Date | null>((a, d) => (!a || d < a ? d : a), null);

// Ödeme kayıtları anonimleşince bağlandığı kimliksiz hesap
const PAYMENT_PLACEHOLDER_EMAIL = "anonim-odeme@ahenk.invalid";

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Kategori adayları ────────────────────────────────────────────────────

  private async candidates(id: RetentionCategoryId): Promise<Candidate[]> {
    const p = this.prisma;
    switch (id) {
      case "PAYMENT": {
        // Süre: işlemin yılını izleyen takvim yılı başından 10 yıl; anonimleştirilmiş kayıt yeniden işlenmez
        const rows = await p.payment.findMany({ where: { anonymizedAt: null }, select: { id: true, userId: true, paidAt: true, createdAt: true } });
        return rows.map((r) => {
          const at = r.paidAt ?? r.createdAt;
          const start = startOfTrYear(trYear(at) + 1);
          return { id: r.id, userId: r.userId, start, expiresAt: addYears(start, 10) };
        });
      }
      case "DISTANCE_SALES_CONSENT": {
        // Onay tarihinden 3 yıl; hesap silinse de saklanır
        const rows = await p.agreementConsent.findMany({
          where: { documentType: { in: ["mesafeli_satis", "on_bilgilendirme"] } },
          select: { id: true, userId: true, acceptedAt: true },
        });
        return rows.map((r) => ({ id: r.id, userId: r.userId, start: r.acceptedAt, expiresAt: addYears(r.acceptedAt, 3) }));
      }
      case "COMMERCIAL_MESSAGE_CONSENT": {
        // Onayın sona erdiği an: kişi + türdeki son kayıt ret (accepted false) ise onun tarihi; onay sürüyorsa süre işlemez
        const rows = await p.consentLog.findMany({
          where: { type: "MARKETING_SMS" },
          select: { id: true, userId: true, type: true, accepted: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        });
        const last = new Map<string, (typeof rows)[number]>();
        for (const r of rows) last.set(`${r.userId}:${r.type}`, r);
        return rows.map((r) => {
          const l = last.get(`${r.userId}:${r.type}`)!;
          const start = l.accepted ? null : l.createdAt;
          return { id: r.id, userId: r.userId, start, expiresAt: start ? addYears(start, 3) : null };
        });
      }
      case "TRAFFIC_LOG": {
        // Kayıt tarihinden 2 yıl; süresi dolmamış / iptal edilmemiş açık oturum, oturum bitene kadar silinmez
        const now = new Date();
        const [tokens, venue, logins] = await Promise.all([
          p.refreshToken.findMany({ select: { id: true, userId: true, createdAt: true, expiresAt: true, revoked: true } }),
          p.venueSession.findMany({ select: { id: true, createdAt: true, revokedAt: true } }),
          p.loginLog.findMany({ select: { id: true, userId: true, createdAt: true } }),
        ]);
        return [
          // Giriş kaydı (LoginLog): kayıt tarihinden 2 yıl
          ...logins.map((l) => ({ id: `ll:${l.id}`, userId: l.userId, start: l.createdAt, expiresAt: addYears(l.createdAt, 2) })),
          ...tokens.map((t) => {
            const open = !t.revoked && t.expiresAt > now;
            const exp = addYears(t.createdAt, 2);
            return { id: `rt:${t.id}`, userId: t.userId, start: t.createdAt, expiresAt: open ? maxDate([exp, t.expiresAt]) : exp };
          }),
          ...venue.map((v) => ({ id: `vs:${v.id}`, userId: null, start: v.createdAt, expiresAt: v.revokedAt ? addYears(v.createdAt, 2) : null })),
        ];
      }
      case "KVKK_CONSENT": {
        // Hesap silinmesinden (silme talebinin onayı) 10 yıl; hesap silinmediyse süre işlemez
        const [rows, bio, deletions] = await Promise.all([
          p.consentLog.findMany({ where: { type: "PRIVACY_POLICY" }, select: { id: true, userId: true } }),
          p.agreementConsent.findMany({ where: { documentType: "acik_riza_biyometrik" }, select: { id: true, userId: true } }),
          p.accountDeletionRequest.findMany({ where: { status: "APPROVED" }, select: { userId: true, decidedAt: true } }),
        ]);
        const deletedAt = new Map(deletions.map((d) => [d.userId, d.decidedAt]));
        // Biyometrik açık rıza kaydı (AgreementConsent) "ac:" önekiyle
        return [...rows, ...bio.map((b) => ({ ...b, id: `ac:${b.id}` }))].map((r) => {
          const start = deletedAt.get(r.userId) ?? null;
          return { id: r.id, userId: r.userId, start, expiresAt: start ? addYears(start, 10) : null };
        });
      }
      case "INCIDENT_IDENTITY": {
        // Olay kapanışı: hesabın silinmesi ve kişinin SOS talepleri (çözülme), şikâyetleri (inceleme) ve yaptırımlarının (kaldırılma /
        // bitiş / ban tarihi) en geç tarihi. Açık SOS talebi ya da bekleyen şikâyet varsa süre işlemez.
        const reqs = (await p.accountDeletionRequest.findMany({ where: { status: "APPROVED" }, select: { id: true, userId: true, decidedAt: true, retainedIdentity: true } }))
          .filter((r) => r.retainedIdentity && typeof r.retainedIdentity === "object");
        const out: Candidate[] = [];
        for (const r of reqs) {
          const [sos, reports, sanctions] = await Promise.all([
            p.sosReport.findMany({ where: { userId: r.userId }, select: { resolvedAt: true } }),
            p.report.findMany({ where: { OR: [{ reporterId: r.userId }, { reportedId: r.userId }] }, select: { status: true, updatedAt: true } }),
            p.userSanction.findMany({ where: { userId: r.userId }, select: { liftedAt: true, expiresAt: true, createdAt: true } }),
          ]);
          const open = sos.some((s) => !s.resolvedAt) || reports.some((x) => x.status === "PENDING");
          const closure = open ? null : maxDate([
            r.decidedAt,
            ...sos.map((s) => s.resolvedAt),
            ...reports.map((x) => x.updatedAt),
            ...sanctions.map((s) => s.liftedAt ?? s.expiresAt ?? s.createdAt),
          ]);
          out.push({ id: r.id, userId: r.userId, start: closure, expiresAt: closure ? addYears(closure, 2) : null });
        }
        return out;
      }
      case "SOS_RECORD": {
        // Son açık adres: talebin çözülmesinden 2 yıl (koordinat ve konum geçmişi çözülünce zaten silinir)
        const rows = await p.sosReport.findMany({ where: { lastAddress: { not: null } }, select: { id: true, userId: true, resolvedAt: true } });
        return rows.map((r) => ({ id: r.id, userId: r.userId, start: r.resolvedAt, expiresAt: r.resolvedAt ? addYears(r.resolvedAt, 2) : null }));
      }
      case "KYC_DOCUMENTS": {
        const rows = await p.kycSubmission.findMany({ select: { id: true, userId: true, submittedAt: true } });
        return rows.map((r) => ({ id: r.id, userId: r.userId, start: r.submittedAt, expiresAt: null }));
      }
      case "COMPLAINT_MODERATION": {
        // Şikâyet / otomatik engel kayıtları ve ekran görüntüsü ihlal kayıtları (ScreenshotLog, "sl:" önekli): kayıt tarihinden 2 yıl
        const [rows, shots] = await Promise.all([
          p.chatReport.findMany({ select: { id: true, reporterId: true, createdAt: true } }),
          p.screenshotLog.findMany({ select: { id: true, userId: true, createdAt: true } }),
        ]);
        return [
          ...rows.map((r) => ({ id: r.id, userId: r.reporterId, start: r.createdAt, expiresAt: addYears(r.createdAt, 2) })),
          ...shots.map((r) => ({ id: `sl:${r.id}`, userId: r.userId, start: r.createdAt, expiresAt: addYears(r.createdAt, 2) })),
        ];
      }
      case "CHAT_MESSAGES": {
        // Masa tarihinden 6 ay
        const rows = await p.chatMessage.findMany({ where: { reports: { none: {} } }, select: { id: true, senderId: true, meeting: { select: { scheduledAt: true } } } });
        return rows.map((r) => {
          const start = r.meeting.scheduledAt;
          const exp = new Date(start); exp.setUTCMonth(exp.getUTCMonth() + 6);
          return { id: r.id, userId: r.senderId, start, expiresAt: exp };
        });
      }
      case "PROBLEM_REPORTS": {
        const rows = await p.problemReport.findMany({ select: { id: true, userId: true, createdAt: true } });
        return rows.map((r) => ({ id: r.id, userId: r.userId, start: r.createdAt, expiresAt: addYears(r.createdAt, 2) }));
      }
      case "PROFILE_DATA": {
        const rows = await p.profile.findMany({ select: { id: true, userId: true, createdAt: true } });
        return rows.map((r) => ({ id: r.id, userId: r.userId, start: r.createdAt, expiresAt: null }));
      }
      case "BANNED_PHONE_HASH": {
        const rows = await p.user.findMany({ where: { phoneHash: { not: null } }, select: { id: true, updatedAt: true } });
        return rows.map((r) => ({ id: r.id, userId: r.id, start: r.updatedAt, expiresAt: null }));
      }
      default:
        return [];
    }
  }

  private async activeLocks() {
    const locks = await this.prisma.retentionLock.findMany({ where: { releasedAt: null }, select: { userId: true, category: true, recordId: true } });
    return {
      users: new Set(locks.filter((l) => l.userId).map((l) => l.userId as string)),
      records: new Set(locks.filter((l) => l.category && l.recordId).map((l) => `${l.category}:${l.recordId}`)),
    };
  }

  private isLocked(locks: { users: Set<string>; records: Set<string> }, cat: RetentionCategoryId, c: Candidate) {
    return (!!c.userId && locks.users.has(c.userId)) || locks.records.has(`${cat}:${c.id}`);
  }

  // ─── Otomatik silme işi ───────────────────────────────────────────────────

  @Cron(RETENTION_JOB_CRON, { timeZone: RETENTION_JOB_TZ })
  async nightly() {
    try { await this.run(); } catch (err) { this.logger.error(`Veri saklama işi hatası: ${err}`); }
  }

  // Anahtar kapalıyken yalnız sayar (silmez); her çalışmada kategori başına RetentionRun kaydı
  async run() {
    const enabled = await isAutoDataDeletionEnabled(this.prisma);
    const locks = await this.activeLocks();
    const now = new Date();
    const result: { category: RetentionCategoryId; count: number }[] = [];
    for (const cat of RETENTION_POLICY.filter((c) => c.auto)) {
      const due = (await this.candidates(cat.id)).filter((c) => c.expiresAt && c.expiresAt <= now && !this.isLocked(locks, cat.id, c));
      if (enabled && due.length) await this.apply(cat.id, due);
      await this.prisma.retentionRun.create({ data: { category: cat.id, count: due.length, enabled } });
      result.push({ category: cat.id, count: due.length });
    }
    this.logger.log(`Veri saklama işi (${enabled ? "silme açık" : "yalnız sayım"}): ${result.map((r) => `${r.category}=${r.count}`).join(", ")}`);
    return { enabled, result };
  }

  private async apply(cat: RetentionCategoryId, due: Candidate[]) {
    const p = this.prisma;
    const ids = due.map((c) => c.id);
    switch (cat) {
      case "PAYMENT": {
        // Kişisel alanlar anonimleşir: kullanıcı bağı kimliksiz hesaba taşınır, ödeme formu / konuşma kimliği ve hata metni silinir;
        // tutar, tarih ve işlem numarası (iyzicoPaymentId / storeTransactionId) korunur
        const ph = await p.user.upsert({
          where: { email: PAYMENT_PLACEHOLDER_EMAIL },
          update: {},
          create: { email: PAYMENT_PLACEHOLDER_EMAIL, passwordHash: "silindi", status: UserStatus.DELETED },
          select: { id: true },
        });
        for (const id of ids) {
          const pay = await p.payment.update({
            where: { id },
            data: { userId: ph.id, iyzicoToken: null, iyzicoConversationId: null, failureReason: null, anonymizedAt: new Date() },
            select: { subscriptionId: true },
          });
          if (pay.subscriptionId) {
            await p.subscription.update({ where: { id: pay.subscriptionId }, data: { userId: ph.id, cancelNote: null, iyzicoSubscriptionRef: null } });
          }
        }
        return;
      }
      case "DISTANCE_SALES_CONSENT":
        await p.agreementConsent.deleteMany({ where: { id: { in: ids } } });
        return;
      case "COMMERCIAL_MESSAGE_CONSENT":
        await p.consentLog.deleteMany({ where: { id: { in: ids } } });
        return;
      case "KVKK_CONSENT":
        await p.consentLog.deleteMany({ where: { id: { in: ids.filter((i) => !i.startsWith("ac:")) } } });
        await p.agreementConsent.deleteMany({ where: { id: { in: ids.filter((i) => i.startsWith("ac:")).map((i) => i.slice(3)) } } });
        return;
      case "SOS_RECORD":
        await p.sosReport.updateMany({ where: { id: { in: ids } }, data: { lastAddress: null } });
        return;
      case "COMPLAINT_MODERATION": {
        // Süresi dolan şikâyet / otomatik engel kayıtları silinir; şikâyet edilen mesaj, başka şikâyeti kalmadıysa onunla birlikte silinir.
        // Süresi dolan ekran görüntüsü ihlal kayıtları ("sl:" önekli) silinir
        await p.screenshotLog.deleteMany({ where: { id: { in: ids.filter((i) => i.startsWith("sl:")).map((i) => i.slice(3)) } } });
        const reportIds = ids.filter((i) => !i.startsWith("sl:"));
        const reports = await p.chatReport.findMany({ where: { id: { in: reportIds } }, select: { messageId: true } });
        await p.chatReport.deleteMany({ where: { id: { in: reportIds } } });
        await p.chatMessage.deleteMany({ where: { id: { in: [...new Set(reports.map((r) => r.messageId))] }, reports: { none: {} } } });
        return;
      }
      case "CHAT_MESSAGES":
        // Yalnız şikâyet edilmemiş mesajlar (masa tarihinden 6 ay)
        await p.chatMessage.deleteMany({ where: { id: { in: ids }, reports: { none: {} } } });
        return;
      case "PROBLEM_REPORTS":
        // Kayıt + sunucudaki görseller (uploads/problem-reports/<id>/)
        await p.problemReport.deleteMany({ where: { id: { in: ids } } });
        for (const id of ids) {
          try { fs.rmSync(path.join(PROBLEM_REPORT_DIR, id), { recursive: true, force: true }); } catch (e) { this.logger.error(`Sorun bildirimi klasörü silinemedi (${id}): ${e}`); }
        }
        return;
      case "TRAFFIC_LOG":
        await p.refreshToken.deleteMany({ where: { id: { in: ids.filter((i) => i.startsWith("rt:")).map((i) => i.slice(3)) } } });
        await p.venueSession.deleteMany({ where: { id: { in: ids.filter((i) => i.startsWith("vs:")).map((i) => i.slice(3)) } } });
        await p.loginLog.deleteMany({ where: { id: { in: ids.filter((i) => i.startsWith("ll:")).map((i) => i.slice(3)) } } });
        return;
      case "INCIDENT_IDENTITY":
        await p.accountDeletionRequest.updateMany({ where: { id: { in: ids } }, data: { retainedIdentity: Prisma.JsonNull } });
        return;
      default:
        return;
    }
  }

  // ─── Politika tablosu ─────────────────────────────────────────────────────

  async policy() {
    const locks = await this.activeLocks();
    const now = new Date();
    const enabled = await isAutoDataDeletionEnabled(this.prisma);
    const rows = [];
    for (const cat of RETENTION_POLICY) {
      if (cat.id === "EXISTING_RULES") { rows.push({ ...cat, count: null, oldest: null, nextDeletion: null, dueNow: null }); continue; }
      const list = await this.candidates(cat.id);
      const open = list.filter((c) => !this.isLocked(locks, cat.id, c));
      rows.push({
        ...cat,
        count: list.length,
        oldest: minDate(list.map((c) => c.start)),
        nextDeletion: cat.auto ? minDate(open.map((c) => c.expiresAt)) : null,
        dueNow: cat.auto ? open.filter((c) => c.expiresAt && c.expiresAt <= now).length : null,
      });
    }
    return { autoDataDeletion: enabled, categories: rows };
  }

  // ─── Kişi arama (silinmiş hesaplar dahil) ─────────────────────────────────

  async search(q: string) {
    const term = q.trim();
    if (term.length < 2) throw new BadRequestException("En az 2 karakter gir");
    const digits = term.replace(/[^\d+]/g, "");
    const ids = new Set<string>();
    const byId = await this.prisma.user.findUnique({ where: { id: term }, select: { id: true } });
    if (byId) ids.add(byId.id);
    if (digits.replace("+", "").length >= 4) {
      const phones = await this.prisma.user.findMany({ where: { phone: { contains: digits.replace(/^\+/, "") } }, select: { id: true }, take: 20 });
      phones.forEach((u) => ids.add(u.id));
      const e164 = digits.startsWith("+") ? digits : `+${digits}`;
      const hashed = await this.prisma.user.findMany({ where: { phoneHash: { in: [hashPhone(digits), hashPhone(e164)] } }, select: { id: true } });
      hashed.forEach((u) => ids.add(u.id));
    }
    const parts = term.split(/\s+/).filter(Boolean);
    const names = await this.prisma.profile.findMany({
      where: { AND: parts.map((w) => ({ OR: [{ firstName: { contains: w, mode: "insensitive" as const } }, { lastName: { contains: w, mode: "insensitive" as const } }] })) },
      select: { userId: true }, take: 20,
    });
    names.forEach((n) => ids.add(n.userId));
    // Silinmiş hesap: saklanan kimlik bilgisinde ad / telefon
    const retained = await this.prisma.accountDeletionRequest.findMany({ where: { status: "APPROVED" }, select: { userId: true, retainedIdentity: true } });
    for (const r of retained) {
      const ri = r.retainedIdentity as { firstName?: string | null; lastName?: string | null; phone?: string | null } | null;
      if (!ri || typeof ri !== "object") continue;
      const full = `${ri.firstName ?? ""} ${ri.lastName ?? ""}`.toLocaleLowerCase("tr");
      if (parts.every((w) => full.includes(w.toLocaleLowerCase("tr"))) || (digits.length >= 4 && (ri.phone ?? "").includes(digits.replace(/^\+/, "")))) ids.add(r.userId);
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, phone: true, status: true, isBot: true, createdAt: true, profile: { select: { firstName: true, lastName: true } }, deletionRequests: { where: { status: "APPROVED" }, select: { retainedIdentity: true, decidedAt: true } } },
      take: 30,
    });
    return users.map((u) => {
      const ri = u.deletionRequests[0]?.retainedIdentity as { firstName?: string; lastName?: string; phone?: string } | null | undefined;
      const name = u.profile ? `${u.profile.firstName} ${u.profile.lastName}`.trim() : ri && typeof ri === "object" ? `${ri.firstName ?? ""} ${ri.lastName ?? ""}`.trim() : "";
      return { userId: u.id, name, phone: u.phone ?? (ri && typeof ri === "object" ? ri.phone ?? null : null), status: u.status, deleted: u.status === UserStatus.DELETED, deletedAt: u.deletionRequests[0]?.decidedAt ?? null, isBot: u.isBot };
    });
  }

  // ─── Kişinin saklanan bütün verisi (kategori kategori) ────────────────────

  async personData(userId: string) {
    const p = this.prisma;
    const user = await p.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("Kullanıcı bulunamadı");
    const { passwordHash: _pw, phoneHash, ...userRow } = user;
    const or2 = (a: string, b: string) => ({ OR: [{ [a]: userId }, { [b]: userId }] });
    const [
      payments, subscriptions, consents, refreshTokens, deletionRequests, profile, oceanScore, oceanAnswers, kyc, profilePhotos,
      contactBlocks, userBlocks, chatMessages, chatReports, sanctions, sosReports, problemReports, notifications, participations,
      meetingReviews, noShowReports, reports, kankaInvites, kankaLinks, referrals, referralRewards, weeklySelections, winbackOffer,
      waitlist, adminActions, locks, exports, agreements, loginLogs,
    ] = await Promise.all([
      p.payment.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      p.subscription.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      p.consentLog.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      p.refreshToken.findMany({ where: { userId }, select: { id: true, createdAt: true, expiresAt: true, revoked: true, rotatedAt: true }, orderBy: { createdAt: "asc" } }),
      p.accountDeletionRequest.findMany({ where: { userId } }),
      p.profile.findUnique({ where: { userId } }),
      p.oceanScore.findUnique({ where: { userId } }),
      p.oceanAnswer.findMany({ where: { userId } }),
      p.kycSubmission.findUnique({ where: { userId } }),
      p.profilePhoto.findMany({ where: { userId } }),
      p.contactBlock.findMany({ where: { userId } }),
      p.userBlock.findMany({ where: or2("blockerId", "blockedId") }),
      p.chatMessage.findMany({ where: { senderId: userId }, orderBy: { createdAt: "asc" } }),
      p.chatReport.findMany({ where: { reporterId: userId } }),
      p.userSanction.findMany({ where: { userId } }),
      p.sosReport.findMany({ where: { userId }, include: { locationUpdates: true } }),
      p.problemReport.findMany({ where: { userId } }),
      p.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      p.meetingParticipant.findMany({ where: { userId } }),
      p.meetingReview.findMany({ where: { reviewerId: userId } }),
      p.noShowReport.findMany({ where: or2("reporterId", "reportedId") }),
      p.report.findMany({ where: or2("reporterId", "reportedId") }),
      p.kankaInvite.findMany({ where: { OR: [{ inviterId: userId }, { acceptedById: userId }] }, omit: { token: true } }),
      p.kankaLink.findMany({ where: or2("userAId", "userBId") }),
      p.referral.findMany({ where: or2("referrerId", "referredId") }),
      p.referralReward.findMany({ where: { userId } }),
      p.weeklySelection.findMany({ where: { userId } }),
      p.winbackOffer.findUnique({ where: { userId } }),
      p.matchingWaitlist.findMany({ where: { userId } }),
      p.adminActionLog.findMany({ where: { targetUserId: userId }, orderBy: { createdAt: "asc" } }),
      p.retentionLock.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      p.dataExportLog.findMany({ where: { targetUserId: userId }, orderBy: { createdAt: "desc" } }),
      p.agreementConsent.findMany({ where: { userId }, orderBy: { acceptedAt: "asc" } }),
      p.loginLog.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    ]);
    return {
      userId,
      categories: {
        PAYMENT: { payments, subscriptions },
        DISTANCE_SALES_CONSENT: { agreements: agreements.filter((a) => a.documentType !== "acik_riza_biyometrik") },
        COMMERCIAL_MESSAGE_CONSENT: { consents: consents.filter((c) => c.type === "MARKETING_SMS") },
        TRAFFIC_LOG: { logins: loginLogs, sessions: refreshTokens },
        KVKK_CONSENT: { consents: consents.filter((c) => c.type === "PRIVACY_POLICY"), biometricConsents: agreements.filter((a) => a.documentType === "acik_riza_biyometrik") },
        INCIDENT_IDENTITY: { retainedIdentity: deletionRequests.map((d) => d.retainedIdentity).filter((r) => r && typeof r === "object") },
        BANNED_PHONE_HASH: { phoneHash: phoneHash ?? null },
        EXISTING_RULES: {
          user: userRow, profile, oceanScore, oceanAnswers,
          kyc: kyc ? { id: kyc.id, idType: kyc.idType, status: kyc.status, submittedAt: kyc.submittedAt, reviewedAt: kyc.reviewedAt, rejectReason: kyc.rejectReason, adminNote: kyc.adminNote, files: [kyc.idFrontKey, kyc.idBackKey, kyc.livenessKey].filter(Boolean).map((f) => path.basename(f as string)) } : null,
          profilePhotos, contactBlocks, userBlocks, chatMessages, chatReports, sanctions, sosReports, problemReports, notifications,
          participations, meetingReviews, noShowReports, reports, kankaInvites, kankaLinks, referrals, referralRewards, weeklySelections,
          winbackOffer, waitlist, deletionRequests: deletionRequests.map(({ retainedIdentity: _r, ...d }) => d), adminActions,
          termsConsents: consents.filter((c) => c.type === "TERMS_OF_SERVICE"),
        },
      },
      locks,
      exports,
      _files: {
        kyc: kyc ? [kyc.idFrontKey, kyc.idBackKey, kyc.livenessKey].filter((f): f is string => !!f) : [],
        problemReportIds: problemReports.map((r) => r.id),
      },
    };
  }

  async person(userId: string) {
    const { _files: _f, ...data } = await this.personData(userId);
    return data;
  }

  // ─── Dışa aktarma: tek ZIP (JSON + dosyalar, KYC .enc dosyaları çözülmüş) ─

  async exportZip(userId: string, adminId: string, reason: string) {
    const why = (reason ?? "").trim();
    if (why.length < 3) throw new BadRequestException("Gerekçe zorunlu");
    const { _files, ...data } = await this.personData(userId);
    const entries: { name: string; data: Buffer }[] = [{ name: "veri.json", data: Buffer.from(JSON.stringify(data, null, 2), "utf8") }];
    for (const f of _files.kyc) {
      if (!fs.existsSync(f)) continue;
      const enc = f.endsWith(KYC_ENC_SUFFIX);
      const name = path.basename(enc ? f.slice(0, -KYC_ENC_SUFFIX.length) : f);
      entries.push({ name: `kyc/${name}`, data: enc ? decryptKyc(fs.readFileSync(f)) : fs.readFileSync(f) });
    }
    const addDir = (dir: string, prefix: string) => {
      if (!fs.existsSync(dir)) return;
      for (const n of fs.readdirSync(dir)) {
        const fp = path.join(dir, n);
        if (fs.statSync(fp).isFile()) entries.push({ name: `${prefix}/${n}`, data: fs.readFileSync(fp) });
      }
    };
    addDir(path.join(PROFILE_PHOTO_DIR, userId), "profil-fotograflari");
    for (const id of _files.problemReportIds) addDir(path.join(PROBLEM_REPORT_DIR, id), `sorun-bildirimleri/${id}`);
    const zip = buildZip(entries);
    await this.prisma.dataExportLog.create({ data: { adminId, targetUserId: userId, reason: why } });
    return { fileName: `ahenk-veri-${userId}-${new Date().toISOString().slice(0, 10)}.zip`, base64: zip.toString("base64") };
  }

  async exportHistory() {
    const rows = await this.prisma.dataExportLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return this.withNames(rows, (r) => [r.adminId, r.targetUserId]);
  }

  // ─── Saklama kilidi ───────────────────────────────────────────────────────

  async lock(input: { userId?: string; category?: string; recordId?: string; reason: string }, adminId: string) {
    const reason = (input.reason ?? "").trim();
    if (reason.length < 3) throw new BadRequestException("Gerekçe zorunlu");
    if (!input.userId && !(input.category && input.recordId)) throw new BadRequestException("Kişi ya da kayıt seçilmeli");
    if (input.category && !RETENTION_POLICY.some((c) => c.id === input.category)) throw new BadRequestException("Geçersiz kategori");
    return this.prisma.retentionLock.create({
      data: { userId: input.userId ?? null, category: input.category ?? null, recordId: input.recordId ?? null, reason, createdById: adminId },
    });
  }

  async unlock(id: string, reason: string, adminId: string) {
    const why = (reason ?? "").trim();
    if (why.length < 3) throw new BadRequestException("Gerekçe zorunlu");
    const lock = await this.prisma.retentionLock.findUnique({ where: { id } });
    if (!lock) throw new NotFoundException("Kilit bulunamadı");
    if (lock.releasedAt) throw new BadRequestException("Kilit zaten kaldırılmış");
    return this.prisma.retentionLock.update({ where: { id }, data: { releasedAt: new Date(), releasedById: adminId, releaseReason: why } });
  }

  async locks() {
    const rows = await this.prisma.retentionLock.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return this.withNames(rows, (r) => [r.createdById, r.userId, r.releasedById]);
  }

  // ─── Silme geçmişi ────────────────────────────────────────────────────────

  runs() {
    return this.prisma.retentionRun.findMany({ orderBy: { ranAt: "desc" }, take: 300 });
  }

  // Kayıtlardaki kullanıcı kimliklerine ad ekler (silinmiş hesapta saklanan kimlikten)
  private async withNames<T>(rows: T[], ids: (r: T) => (string | null)[]) {
    const all = [...new Set(rows.flatMap((r) => ids(r)).filter((x): x is string => !!x))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: all } },
      select: { id: true, profile: { select: { firstName: true, lastName: true } }, deletionRequests: { where: { status: "APPROVED" }, select: { retainedIdentity: true } } },
    });
    const names: Record<string, string> = {};
    for (const u of users) {
      const ri = u.deletionRequests[0]?.retainedIdentity as { firstName?: string; lastName?: string } | null | undefined;
      names[u.id] = u.profile ? `${u.profile.firstName} ${u.profile.lastName}`.trim() : ri && typeof ri === "object" ? `${ri.firstName ?? ""} ${ri.lastName ?? ""}`.trim() : "";
    }
    return { rows, names };
  }
}
