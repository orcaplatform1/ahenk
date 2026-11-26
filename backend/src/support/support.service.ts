// Canlı destek: sıra, otomatik atama, mesajlaşma, devir, hareketsizlik, değerlendirme, kısıtlama ve raporlar.
// Anlık iletişim Masa Sohbeti ile aynı altyapı: istemci kısa aralıkla yoklar (polling); yeni teknoloji yok.
// Yazıyor göstergesi ve gönderilmemiş yazı önizlemesi yalnız süreç belleğinde, 5 sn ömürlü (hiçbir yere yazılmaz).
// Sohbet başlatan hesabın ID'sine bağlıdır (üye userId, mekân venueAccountId); hiçbir eşleştirme isimle yapılmaz.
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { randomInt } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as bcrypt from "bcryptjs";
import { createId } from "./support-id";
import { closeOpenBreak } from "./support-break";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { FcmService } from "../notification/fcm/fcm.service";
import {
  Prisma, SupportAgentStatus, SupportChatStatus, SupportCloseReason, SupportSender, SupportTopic, UserRole, UserStatus,
} from "../generated/prisma/client";
import { detectImageKind, toWebp, UPLOAD_WEBP_QUALITY } from "../common/image-webp";
import { approvedPhotoMap } from "../profile-photo/profile-photo.util";
import { initialsOf } from "../meetings/cancellation-notice";
import { isE164Mobile, normalizePhone } from "../common/phone";
import {
  AWAY_MS, DEFAULT_MAX_CHATS, DEFAULT_SHIFT_DAY, DEFAULT_SHIFT_NIGHT, FIRST_REPLY_TIMEOUT_MS, IDLE_CLOSE_MS, IDLE_WARN_MS,
  PENDING_RATING_MS, QUEUE_ALERT_MS, RATING_TAGS, RATING_TAG_TR, RESTRICT_DAYS, SUPPORT_DIR, SUPPORT_MAX_IMAGES, SUPPORT_MESSAGE_MAX,
  SYS, SYS_TR, TAKEOVER_NOTE, TICK_MS, TOPIC_TR, TYPING_TTL_MS,
} from "./support.constants";

export type Requester = { kind: "user"; id: string } | { kind: "venue"; id: string };
export type Staff = { id: string; role: UserRole };

const STAFF_ROLES: UserRole[] = [UserRole.SUPPORT, UserRole.ADMIN, UserRole.SUPERADMIN];
const OPEN: SupportChatStatus[] = [SupportChatStatus.QUEUED, SupportChatStatus.ACTIVE];
const TR_MS = 3 * 3600_000;
const trHour = (d: Date) => new Date(d.getTime() + TR_MS).getUTCHours();
const trMinute = (d: Date) => { const x = new Date(d.getTime() + TR_MS); return x.getUTCHours() * 60 + x.getUTCMinutes(); };
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const reqWhere = (r: Requester): Prisma.SupportChatWhereInput => (r.kind === "user" ? { userId: r.id } : { venueAccountId: r.id });
const reasonOk = (s: string | undefined) => (s ?? "").replace(/\s/g, "").length >= 5;
export const NO_REASON = "Sebep girilmemiş";
const restrictWhere = (r: Requester): Prisma.SupportRestrictionWhereInput => (r.kind === "user" ? { userId: r.id } : { venueAccountId: r.id });

type Upload = { buffer: Buffer; size: number; originalname?: string };

@Injectable()
export class SupportService implements OnModuleInit {
  private readonly logger = new Logger(SupportService.name);
  // Bellekte: yazıyor göstergesi / yazı önizlemesi ve son yoklama anları
  private typing = new Map<string, { userText?: string; userAt?: number; agentAt?: number }>();
  private seen = new Map<string, number>(); // "c:<chatId>" kullanıcı tarafı, "a:<userId>" temsilci
  private ticking = false;
  private startedAt = Date.now(); // süreç başlangıcı: yeniden başlatmadan sonra temsilci yoklaması yokken 20 sn kuralı buradan sayılır

  constructor(private prisma: PrismaService, private notify: NotificationService, private fcm: FcmService) {}

  onModuleInit() { fs.mkdirSync(SUPPORT_DIR, { recursive: true }); }

  // ─── Ayarlar (AppConfig) ──────────────────────────────────────────────────

  async settings() {
    const rows = await this.prisma.appConfig.findMany({ where: { key: { in: ["SUPPORT_MAX_CHATS", "SUPPORT_SHIFT_DAY", "SUPPORT_SHIFT_NIGHT"] } } });
    const v = (k: string) => rows.find((r) => r.key === k)?.value;
    const n = Number(v("SUPPORT_MAX_CHATS"));
    return {
      maxChats: Number.isInteger(n) && n > 0 ? n : DEFAULT_MAX_CHATS,
      shiftDay: v("SUPPORT_SHIFT_DAY") || DEFAULT_SHIFT_DAY,
      shiftNight: v("SUPPORT_SHIFT_NIGHT") || DEFAULT_SHIFT_NIGHT,
    };
  }

  async updateSettings(input: { maxChats?: number; shiftDay?: string; shiftNight?: string }) {
    const re = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;
    const set = async (key: string, value: string) => this.prisma.appConfig.upsert({ where: { key }, update: { value }, create: { key, value } });
    if (input.maxChats !== undefined) {
      if (!Number.isInteger(input.maxChats) || input.maxChats < 1 || input.maxChats > 50) throw new BadRequestException("Eşzamanlı sohbet sınırı 1 ile 50 arasında olmalı");
      await set("SUPPORT_MAX_CHATS", String(input.maxChats));
    }
    for (const [k, val] of [["SUPPORT_SHIFT_DAY", input.shiftDay], ["SUPPORT_SHIFT_NIGHT", input.shiftNight]] as const) {
      if (val === undefined) continue;
      if (!re.test(val)) throw new BadRequestException("Vardiya saati SS:dd-SS:dd biçiminde olmalı");
      await set(k, val);
    }
    return this.settings();
  }

  private shiftOf(d: Date, s: { shiftDay: string }): "DAY" | "NIGHT" {
    const [a, b] = s.shiftDay.split("-").map((t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; });
    const m = trMinute(d);
    const inDay = a <= b ? m >= a && m < b : m >= a || m < b;
    return inDay ? "DAY" : "NIGHT";
  }

  // ─── Temsilci kaydı ve Temsilci No ────────────────────────────────────────

  // Benzersiz, rastgele, 5 haneli, değişmeyen numara (ilk ihtiyaçta atanır; SUPPORT hesabında hesap açılışında)
  async ensureAgent(userId: string) {
    const found = await this.prisma.supportAgent.findUnique({ where: { userId } });
    if (found) return found;
    for (let i = 0; i < 20; i++) {
      const agentNo = String(randomInt(10000, 100000));
      try {
        return await this.prisma.supportAgent.create({ data: { userId, agentNo, idleSince: new Date() } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const again = await this.prisma.supportAgent.findUnique({ where: { userId } });
          if (again) return again;
          continue;
        }
        throw e;
      }
    }
    throw new ConflictException("Temsilci No atanamadı, tekrar dene");
  }

  private async staffUser(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true, fcmToken: true } });
    if (!u || !STAFF_ROLES.includes(u.role) || u.status !== UserStatus.ACTIVE) throw new ForbiddenException("Bu işlem için yetkin yok");
    return u;
  }

  // ─── Kimlik ve ad ─────────────────────────────────────────────────────────

  private async requesterName(r: Requester): Promise<string> {
    if (r.kind === "user") {
      const p = await this.prisma.profile.findUnique({ where: { userId: r.id }, select: { firstName: true, lastName: true } });
      return p ? `${p.firstName} ${p.lastName}`.trim() : "—";
    }
    const a = await this.prisma.venueAccount.findUnique({ where: { id: r.id }, select: { venue: { select: { name: true } }, application: { select: { businessName: true, contactName: true } } } });
    return `${a?.venue?.name ?? a?.application.businessName ?? "—"} · ${a?.application.contactName ?? "—"}`;
  }

  async restriction(r: Requester) {
    return this.prisma.supportRestriction.findFirst({
      where: { ...restrictWhere(r), liftedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: "desc" },
      select: { expiresAt: true },
    });
  }

  private async ownChat(r: Requester, chatId: string) {
    const chat = await this.prisma.supportChat.findFirst({ where: { id: chatId, ...reqWhere(r) } });
    if (!chat) throw new NotFoundException("Sohbet bulunamadı");
    return chat;
  }

  // ─── Kullanıcı tarafı ─────────────────────────────────────────────────────

  private queuePosition(chat: { queuedAt: Date }) {
    return this.prisma.supportChat.count({ where: { status: SupportChatStatus.QUEUED, queuedAt: { lte: chat.queuedAt } } });
  }

  private async queueInfo(chat: { queuedAt: Date }) {
    const [position, online, recent] = await Promise.all([
      this.queuePosition(chat),
      this.onlineAgents(),
      this.prisma.supportChat.findMany({
        where: { status: SupportChatStatus.CLOSED, firstAssignedAt: { not: null }, closedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
        select: { firstAssignedAt: true, closedAt: true },
      }),
    ]);
    // Tahmini bekleme = önündeki kişi sayısı × son 7 günün ortalama sohbet süresi ÷ çevrimiçi temsilci sayısı; tam dakikaya yukarı,
    // en az 1 dk. Çevrimiçi temsilci yoksa ya da son 7 günde kapanan sohbet yoksa tahmin yok (yalnız sıra)
    const ahead = Math.max(0, position - 1);
    const mean = avg(recent.map((c) => (c.closedAt!.getTime() - c.firstAssignedAt!.getTime()) / 60_000));
    const etaMin = mean === null || online.length === 0 ? null : Math.max(1, Math.ceil((ahead * mean) / online.length));
    return { position, ahead, etaMin, online: online.length > 0 };
  }

  // Karşı tarafın çevrimiçi bilgisi (bellekte, son yoklama 20 sn içinde)
  private isSeen(key: string) { return Date.now() - (this.seen.get(key) ?? 0) <= AWAY_MS; }

  // Baloncuk / mekân paneli menü rozeti: açık sohbetin durumu, sıra numarası ve okunmamış mesaj sayısı. Okundu yazmaz;
  // kullanıcı uygulamadaysa çevrimiçi sayılır (temsilci cevabı push yerine baloncuk rozetiyle görünür)
  async summary(r: Requester) {
    const chat = await this.prisma.supportChat.findFirst({ where: { ...reqWhere(r), status: { in: OPEN } }, orderBy: { createdAt: "desc" } });
    if (!chat) return { chat: null };
    this.seen.set(`c:${chat.id}`, Date.now());
    const unread = await this.prisma.supportMessage.count({
      where: { chatId: chat.id, sender: { not: SupportSender.USER }, ...(chat.userReadAt ? { createdAt: { gt: chat.userReadAt } } : {}) },
    });
    return { chat: { id: chat.id, status: chat.status, position: chat.status === SupportChatStatus.QUEUED ? await this.queuePosition(chat) : null, unread } };
  }

  private messageView(m: { id: string; sender: SupportSender; agentNo: string | null; content: string; images: string[]; createdAt: Date }) {
    return { id: m.id, sender: m.sender, agentNo: m.agentNo, content: m.content, images: m.images, createdAt: m.createdAt.toISOString() };
  }

  // Ekran durumu (yoklama): kısıtlama, açık sohbet, değerlendirme bekleyen sohbet. Kullanıcı tarafı okundu bilgisi yazılır.
  async state(r: Requester) {
    const restriction = await this.restriction(r);
    const chat = await this.prisma.supportChat.findFirst({ where: { ...reqWhere(r), status: { in: OPEN } }, orderBy: { createdAt: "desc" } });
    let pendingRating: string | null = null;
    if (!chat) {
      const last = await this.prisma.supportChat.findFirst({ where: reqWhere(r), orderBy: { createdAt: "desc" }, select: { id: true, status: true, closedAt: true, closedBy: true, rating: { select: { id: true } } } });
      if (last && last.status === SupportChatStatus.CLOSED && !last.rating && last.closedBy !== SupportCloseReason.ABUSE && last.closedAt && Date.now() - last.closedAt.getTime() < PENDING_RATING_MS) pendingRating = last.id;
      return { restriction: restriction ? { expiresAt: restriction.expiresAt.toISOString() } : null, chat: null, pendingRating };
    }
    this.seen.set(`c:${chat.id}`, Date.now());
    const messages = await this.prisma.supportMessage.findMany({ where: { chatId: chat.id }, orderBy: { createdAt: "asc" } });
    const lastAgentMsg = [...messages].reverse().find((m) => m.sender !== SupportSender.USER);
    if (lastAgentMsg && (!chat.userReadAt || chat.userReadAt < lastAgentMsg.createdAt)) {
      await this.prisma.supportChat.update({ where: { id: chat.id }, data: { userReadAt: new Date() } });
    }
    const agent = chat.agentId ? await this.prisma.supportAgent.findUnique({ where: { userId: chat.agentId }, select: { agentNo: true } }) : null;
    const t = this.typing.get(chat.id);
    return {
      restriction: restriction ? { expiresAt: restriction.expiresAt.toISOString() } : null,
      pendingRating: null,
      chat: {
        id: chat.id,
        status: chat.status,
        topic: chat.topic,
        agentNo: chat.status === SupportChatStatus.ACTIVE ? agent?.agentNo ?? null : null,
        queue: chat.status === SupportChatStatus.QUEUED ? await this.queueInfo(chat) : null,
        agentTyping: !!t?.agentAt && Date.now() - t.agentAt < TYPING_TTL_MS,
        agentOnline: chat.status === SupportChatStatus.ACTIVE && !!chat.agentId && this.isSeen(`a:${chat.agentId}`),
        agentReadAt: chat.agentReadAt?.toISOString() ?? null,
        messages: messages.map((m) => this.messageView(m)),
      },
    };
  }

  async start(r: Requester, topic: SupportTopic) {
    if (await this.restriction(r)) throw new ForbiddenException("Canlı destek erişimin geçici olarak kısıtlandı.");
    const open = await this.prisma.supportChat.findFirst({ where: { ...reqWhere(r), status: { in: OPEN } }, select: { id: true } });
    if (open) return { id: open.id };
    const chat = await this.prisma.supportChat.create({
      data: { ...(r.kind === "user" ? { userId: r.id } : { venueAccountId: r.id }), requesterName: await this.requesterName(r), topic },
      select: { id: true },
    });
    void this.tick();
    return chat;
  }

  // Görseller: yalnız JPG / PNG / WebP (imzaya göre), dosya başına 5 MB, mesaj başına 3; WebP'ye çevrilirken EXIF silinir
  private async saveImages(chatId: string, files: Upload[]): Promise<string[]> {
    if (files.length > SUPPORT_MAX_IMAGES) throw new BadRequestException("Bir mesajda en fazla 3 görsel gönderebilirsin.");
    const out: { name: string; data: Buffer }[] = [];
    for (const f of files) {
      const kind = detectImageKind(f.buffer);
      if (kind !== "jpg" && kind !== "png" && kind !== "webp") throw new BadRequestException("Yalnız JPG, PNG ve WebP görseller gönderebilirsin.");
      out.push({ name: `${createId()}.webp`, data: await toWebp(f.buffer, kind, UPLOAD_WEBP_QUALITY) });
    }
    if (!out.length) return [];
    const dir = path.join(SUPPORT_DIR, chatId);
    fs.mkdirSync(dir, { recursive: true });
    for (const o of out) fs.writeFileSync(path.join(dir, o.name), o.data);
    return out.map((o) => o.name);
  }

  private cleanText(content: string | undefined): string {
    const text = (content ?? "").trim();
    if (text.length > SUPPORT_MESSAGE_MAX) throw new BadRequestException("Mesaj en fazla 2000 karakter olabilir.");
    return text;
  }

  async userMessage(r: Requester, chatId: string, content: string | undefined, files: Upload[]) {
    const chat = await this.ownChat(r, chatId);
    if (!OPEN.includes(chat.status)) throw new ForbiddenException("Bu sohbet sona erdi.");
    const text = this.cleanText(content);
    if (!text && !files.length) throw new BadRequestException("Mesaj boş olamaz");
    const images = await this.saveImages(chat.id, files);
    const msg = await this.prisma.supportMessage.create({ data: { chatId: chat.id, sender: SupportSender.USER, content: text, images } });
    await this.prisma.supportChat.update({ where: { id: chat.id }, data: { lastUserMessageAt: msg.createdAt } });
    const t = this.typing.get(chat.id);
    if (t) { t.userText = undefined; t.userAt = undefined; }
    this.seen.set(`c:${chat.id}`, Date.now());
    if (chat.agentId) void this.pushAgentIfAway(chat.agentId, "Canlı Destek: yeni mesaj", text || "Görsel gönderildi", chat.id);
    return this.messageView(msg);
  }

  userTyping(r: Requester, chatId: string, text: string) {
    return this.ownChat(r, chatId).then(() => {
      // Yazı önizlemesi yalnız bellekte (DB'ye / loga yazılmaz); çubuk tamamen silinince önizleme ve yazıyor hemen kalkar
      const t = this.typing.get(chatId) ?? {};
      const v = (text ?? "").slice(0, SUPPORT_MESSAGE_MAX);
      if (v.trim()) { t.userText = v; t.userAt = Date.now(); } else { t.userText = undefined; t.userAt = undefined; }
      this.typing.set(chatId, t);
      return { ok: true };
    });
  }

  async userClose(r: Requester, chatId: string) {
    const chat = await this.ownChat(r, chatId);
    if (OPEN.includes(chat.status)) await this.close(chat.id, SupportCloseReason.USER);
    return { id: chat.id };
  }

  async rate(r: Requester, chatId: string, input: { helped: boolean; stars: number; tags?: string[]; comment?: string }) {
    const chat = await this.ownChat(r, chatId);
    if (chat.status !== SupportChatStatus.CLOSED || chat.closedBy === SupportCloseReason.ABUSE) throw new BadRequestException("Sohbet henüz sona ermedi.");
    if (await this.prisma.supportRating.findUnique({ where: { chatId } })) throw new ConflictException("Bu sohbeti zaten değerlendirdin.");
    if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) throw new BadRequestException("Yıldız puanı seçmelisin.");
    const group = input.stars >= 4 ? "good" : input.stars >= 2 ? "mid" : "bad";
    const tags = [...new Set(input.tags ?? [])];
    if (tags.some((t) => !RATING_TAGS[group].includes(t))) throw new BadRequestException("Geçersiz değerlendirme etiketi");
    const comment = (input.comment ?? "").trim().slice(0, 1000) || null;
    await this.prisma.supportRating.create({ data: { chatId, helped: !!input.helped, stars: input.stars, tags, comment } });
    return { ok: true };
  }

  async userImage(r: Requester, chatId: string, file: string) {
    await this.ownChat(r, chatId);
    return this.imagePath(chatId, file);
  }

  private async imagePath(chatId: string, file: string) {
    if (!/^[a-z0-9]+\.webp$/i.test(file)) throw new NotFoundException("Görsel bulunamadı");
    const has = await this.prisma.supportMessage.count({ where: { chatId, images: { has: file } } });
    const p = path.join(SUPPORT_DIR, chatId, file);
    if (!has || !fs.existsSync(p)) throw new NotFoundException("Görsel bulunamadı");
    return p;
  }

  // ─── Sohbet kapanışı ──────────────────────────────────────────────────────

  async close(chatId: string, by: SupportCloseReason) {
    const chat = await this.prisma.supportChat.findUnique({ where: { id: chatId } });
    if (!chat || !OPEN.includes(chat.status)) return;
    await this.prisma.supportChat.update({ where: { id: chatId }, data: { status: SupportChatStatus.CLOSED, closedAt: new Date(), closedBy: by } });
    this.typing.delete(chatId);
    if (chat.agentId) await this.markIdleIfFree(chat.agentId);
    // Otomatik sonlanan sohbette değerlendirme push ile gider (üye); mekân panelinde push altyapısı yok
    if (by === SupportCloseReason.AUTO && chat.userId) {
      await this.notify.sendToUser(chat.userId, {
        title: "Ahenk Canlı Destek",
        body: "Sohbetin sona erdi. Görüşmeni değerlendirmek için Canlı Destek'e dokun.",
        data: { type: "SUPPORT_RATING", chatId },
        en: { title: "Ahenk Live Support", body: "Your chat has ended. Tap Live Support to rate your conversation." },
      });
    }
    void this.tick();
  }

  private async markIdleIfFree(agentId: string) {
    const n = await this.prisma.supportChat.count({ where: { agentId, status: SupportChatStatus.ACTIVE } });
    if (n === 0) await this.prisma.supportAgent.updateMany({ where: { userId: agentId }, data: { idleSince: new Date() } });
  }

  // ─── Atama ───────────────────────────────────────────────────────────────

  // Atama alabilen temsilciler: yalnız SUPPORT rolü (ADMIN ve SUPERADMIN'e hiçbir yolla sohbet atanmaz; SUPERADMIN yalnız Devral ile alır).
  // FIFO atama, 2 dk yeniden atama, devir hedefi ve sıra tahmini bu listeyi kullanır
  private async onlineAgents() {
    const agents = await this.prisma.supportAgent.findMany({ where: { status: SupportAgentStatus.ONLINE } });
    if (!agents.length) return [];
    const users = await this.prisma.user.findMany({ where: { id: { in: agents.map((a) => a.userId) }, role: UserRole.SUPPORT, status: UserStatus.ACTIVE }, select: { id: true } });
    const ok = new Set(users.map((u) => u.id));
    return agents.filter((a) => ok.has(a.userId));
  }

  // Çevrimiçi ve sınırı dolmamış temsilciler arasında en az açık sohbeti olan; eşitse en uzun süredir boşta olan
  private async pickAgent(exclude: string[] = []) {
    const [agents, settings] = await Promise.all([this.onlineAgents(), this.settings()]);
    const pool = agents.filter((a) => !exclude.includes(a.userId));
    if (!pool.length) return null;
    const counts = await this.prisma.supportChat.groupBy({ by: ["agentId"], where: { status: SupportChatStatus.ACTIVE, agentId: { in: pool.map((a) => a.userId) } }, _count: { _all: true } });
    const load = new Map(counts.map((c) => [c.agentId as string, c._count._all]));
    const free = pool.filter((a) => (load.get(a.userId) ?? 0) < settings.maxChats);
    if (!free.length) return null;
    free.sort((a, b) => {
      const d = (load.get(a.userId) ?? 0) - (load.get(b.userId) ?? 0);
      if (d) return d;
      return (a.idleSince ?? a.statusChangedAt).getTime() - (b.idleSince ?? b.statusChangedAt).getTime();
    });
    return free[0];
  }

  private async assign(chatId: string, agent: { userId: string; agentNo: string }, first: boolean) {
    const now = new Date();
    const res = await this.prisma.supportChat.updateMany({
      where: { id: chatId, status: SupportChatStatus.QUEUED },
      data: { status: SupportChatStatus.ACTIVE, agentId: agent.userId, assignedAt: now, agentRepliedAt: null, ...(first ? { firstAssignedAt: now } : {}) },
    });
    if (!res.count) return;
    await this.prisma.supportAgent.update({ where: { userId: agent.userId }, data: { idleSince: null } });
    if (first) {
      // Temsilci atanınca otomatik 2 mesaj: kayıt / Aydınlatma Metni bildirimi ve karşılama
      await this.prisma.supportMessage.create({ data: { chatId, sender: SupportSender.SYSTEM, content: SYS.NOTICE, images: [], createdAt: now } });
      await this.prisma.supportMessage.create({ data: { chatId, sender: SupportSender.SYSTEM, agentNo: agent.agentNo, content: SYS.GREETING, images: [], createdAt: new Date(now.getTime() + 1) } });
    }
    await this.pushAgent(agent.userId, "Canlı Destek: yeni sohbet atandı", "Sana yeni bir destek sohbeti atandı.", chatId);
  }

  private async pushAgent(agentId: string, title: string, body: string, chatId: string) {
    try {
      const u = await this.prisma.user.findUnique({ where: { id: agentId }, select: { fcmToken: true } });
      if (u?.fcmToken) await this.fcm.sendToToken({ token: u.fcmToken, title, body: body.slice(0, 180), data: { type: "SUPPORT_AGENT", chatId } });
    } catch (e) { this.logger.error(`Temsilci push gönderilemedi (${agentId}): ${e}`); }
  }

  private async pushAgentIfAway(agentId: string, title: string, body: string, chatId: string) {
    const at = this.seen.get(`a:${agentId}`) ?? 0;
    if (Date.now() - at > AWAY_MS) await this.pushAgent(agentId, title, body, chatId);
  }

  // Zamanlanmış iş (10 sn): ilk cevap süresi, sıra ataması, hareketsizlik, 90 sn sıra uyarısı
  @Interval(TICK_MS)
  async interval() { await this.tick(); }

  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = Date.now();
      // 1) Atanan temsilci 2 dk içinde ilk cevabı vermezse uygun başka temsilciye; yoksa sıranın başına (queuedAt korunur)
      const late = await this.prisma.supportChat.findMany({ where: { status: SupportChatStatus.ACTIVE, agentRepliedAt: null, assignedAt: { lt: new Date(now - FIRST_REPLY_TIMEOUT_MS) } } });
      for (const c of late) {
        const prev = c.agentId;
        const next = await this.pickAgent(prev ? [prev] : []);
        await this.prisma.supportChat.update({ where: { id: c.id }, data: { status: SupportChatStatus.QUEUED, agentId: null, assignedAt: null } });
        if (prev) await this.markIdleIfFree(prev);
        if (next) await this.assign(c.id, next, false);
      }
      // 2) Sıradakiler: ilk gelen ilk alınır
      const queued = await this.prisma.supportChat.findMany({ where: { status: SupportChatStatus.QUEUED }, orderBy: { queuedAt: "asc" }, select: { id: true, firstAssignedAt: true } });
      for (const q of queued) {
        const agent = await this.pickAgent();
        if (!agent) break;
        await this.assign(q.id, agent, !q.firstAssignedAt);
      }
      // 3) Kullanıcı hareketsizliği: temsilcinin son mesajından sonra 2 dk cevap yoksa uyarı, 3. dakikada otomatik sonlanır
      const active = await this.prisma.supportChat.findMany({ where: { status: SupportChatStatus.ACTIVE, lastAgentMessageAt: { not: null } } });
      for (const c of active) {
        const la = c.lastAgentMessageAt!.getTime();
        if (c.lastUserMessageAt && c.lastUserMessageAt.getTime() > la) continue;
        if (now - la >= IDLE_CLOSE_MS) { await this.close(c.id, SupportCloseReason.AUTO); continue; }
        if (now - la >= IDLE_WARN_MS && (!c.idleWarnedAt || c.idleWarnedAt.getTime() < la)) {
          await this.prisma.supportMessage.create({ data: { chatId: c.id, sender: SupportSender.SYSTEM, content: SYS.IDLE_WARNING, images: [] } });
          await this.prisma.supportChat.update({ where: { id: c.id }, data: { idleWarnedAt: new Date() } });
          if (c.userId) await this.pushUserIfAway(c, SYS_TR.IDLE_WARNING, "If you don't reply within 1 minute, the chat will end.");
        }
      }
      // 4) Sırada 90 sn'yi geçen sohbet: bütün ADMIN ve SUPERADMIN'e uygulama içi bildirim + push (sohbet başına bir kez)
      const waiting = await this.prisma.supportChat.findMany({ where: { status: SupportChatStatus.QUEUED, queueAlertedAt: null, queuedAt: { lt: new Date(now - QUEUE_ALERT_MS) } }, select: { id: true, topic: true } });
      if (waiting.length) {
        // Moladaki ADMIN / SUPERADMIN bu uyarıyı almaz
        const resting = new Set((await this.prisma.supportAgent.findMany({ where: { status: SupportAgentStatus.BREAK }, select: { userId: true } })).map((a) => a.userId));
        const admins = (await this.prisma.user.findMany({ where: { role: { in: [UserRole.ADMIN, UserRole.SUPERADMIN] }, status: UserStatus.ACTIVE }, select: { id: true } })).filter((a) => !resting.has(a.id));
        for (const w of waiting) {
          await this.prisma.supportChat.update({ where: { id: w.id }, data: { queueAlertedAt: new Date() } });
          for (const a of admins) {
            await this.notify.sendToUser(a.id, { title: "Canlı Destek: sırada bekleyen sohbet", body: `Bir destek sohbeti (${TOPIC_TR[w.topic]}) 90 saniyedir sırada bekliyor.`, data: { type: "SUPPORT_QUEUE", chatId: w.id } });
          }
        }
      }
      // 5) Çevrimiçi ya da moladaki temsilcinin bağlantısı 20 sn'den uzun koptuysa çevrimdışı sayılır, açık mola kaydı o anki saatle kapanır.
      // Açık sohbetleri temsilcide kalır (sıraya dönmez)
      const present = await this.prisma.supportAgent.findMany({ where: { status: { in: [SupportAgentStatus.ONLINE, SupportAgentStatus.BREAK] } }, select: { userId: true } });
      for (const a of present) {
        if (now - (this.seen.get(`a:${a.userId}`) ?? this.startedAt) <= AWAY_MS) continue;
        const at = new Date();
        await this.prisma.supportAgent.update({ where: { userId: a.userId }, data: { status: SupportAgentStatus.OFFLINE, statusChangedAt: at } });
        await closeOpenBreak(this.prisma, a.userId, at);
      }
      // 6) ADMIN / SUPERADMIN (SUPPORT dışı) hesapların temsilci durumu hiçbir yoldan ONLINE / BREAK kalmaz (ör. rol değişikliği):
      // çevrimdışı yapılır, açık mola kaydı o anki saatle kapanır
      const live = await this.prisma.supportAgent.findMany({ where: { status: { in: [SupportAgentStatus.ONLINE, SupportAgentStatus.BREAK] } }, select: { userId: true } });
      if (live.length) {
        const nonSupport = await this.prisma.user.findMany({ where: { id: { in: live.map((a) => a.userId) }, role: { not: UserRole.SUPPORT } }, select: { id: true } });
        for (const u of nonSupport) {
          const at = new Date();
          await this.prisma.supportAgent.update({ where: { userId: u.id }, data: { status: SupportAgentStatus.OFFLINE, statusChangedAt: at } });
          await closeOpenBreak(this.prisma, u.id, at);
        }
      }
      // Süresi geçen yazıyor kayıtları
      for (const [k, t] of this.typing) {
        if ((!t.userAt || now - t.userAt > TYPING_TTL_MS) && (!t.agentAt || now - t.agentAt > TYPING_TTL_MS)) this.typing.delete(k);
      }
    } catch (e) {
      this.logger.error(`Canlı destek zamanlanmış iş hatası: ${e}`);
    } finally {
      this.ticking = false;
    }
  }

  private async pushUserIfAway(chat: { id: string; userId: string | null }, tr: string, en: string) {
    if (!chat.userId) return;
    const at = this.seen.get(`c:${chat.id}`) ?? 0;
    if (Date.now() - at <= AWAY_MS) return;
    await this.notify.sendToUser(chat.userId, {
      title: "Ahenk Müşteri Temsilcisi", body: tr.slice(0, 180), data: { type: "SUPPORT_MESSAGE", chatId: chat.id },
      en: { title: "Ahenk Support Agent", body: en.slice(0, 180) },
    });
  }

  // ─── Temsilci tarafı ──────────────────────────────────────────────────────

  // Temsilci ekranı avatarı (Masa Kuruldu DetayAvatar): üyede ad soyad baş harfleri, cinsiyet ve onaylı profil fotoğrafı;
  // mekân hesabında cinsiyet ve profil fotoğrafı yoktur: yalnız yetkili ad soyadının baş harfleri (requesterName "mekân · yetkili")
  private async avatars(chats: { id: string; userId: string | null; venueAccountId: string | null; requesterName: string }[]) {
    const userIds = [...new Set(chats.map((c) => c.userId).filter((x): x is string => !!x))];
    const [profiles, photos] = await Promise.all([
      userIds.length ? this.prisma.profile.findMany({ where: { userId: { in: userIds } }, select: { userId: true, firstName: true, lastName: true, gender: true } }) : Promise.resolve([]),
      approvedPhotoMap(this.prisma, userIds),
    ]);
    const prof = new Map(profiles.map((p) => [p.userId, p]));
    const out = new Map<string, { initials: string; gender: string | null; photoUrl: string | null }>();
    for (const c of chats) {
      if (c.venueAccountId) {
        const i = c.requesterName.lastIndexOf(" · ");
        const words = (i > 0 ? c.requesterName.slice(i + 3) : "").trim().split(/\s+/).filter((w) => w && w !== "—");
        out.set(c.id, { initials: initialsOf({ firstName: words[0], lastName: words.length > 1 ? words[words.length - 1] : undefined }), gender: null, photoUrl: null });
      } else {
        const p = c.userId ? prof.get(c.userId) : undefined;
        out.set(c.id, { initials: initialsOf(p), gender: p?.gender ?? null, photoUrl: c.userId ? photos.get(c.userId) ?? null : null });
      }
    }
    return out;
  }

  async agentState(staff: Staff) {
    const me = await this.staffUser(staff.id);
    const agent = await this.ensureAgent(me.id);
    this.seen.set(`a:${me.id}`, Date.now());
    const superadmin = me.role === UserRole.SUPERADMIN;
    // ADMIN ve SUPERADMIN diğer açık sohbetleri görür (ADMIN salt okunur, SUPERADMIN devralabilir)
    const seesAll = superadmin || me.role === UserRole.ADMIN;
    const [queued, mine, all, online, settings] = await Promise.all([
      this.prisma.supportChat.findMany({ where: { status: SupportChatStatus.QUEUED }, orderBy: { queuedAt: "asc" } }),
      this.prisma.supportChat.findMany({ where: { status: SupportChatStatus.ACTIVE, agentId: me.id }, orderBy: { assignedAt: "asc" } }),
      seesAll ? this.prisma.supportChat.findMany({ where: { status: SupportChatStatus.ACTIVE, NOT: { agentId: me.id } }, orderBy: { assignedAt: "asc" } }) : Promise.resolve([]),
      this.onlineAgents(),
      this.settings(),
    ]);
    const agentNos = new Map((await this.prisma.supportAgent.findMany({ select: { userId: true, agentNo: true } })).map((a) => [a.userId, a.agentNo]));
    const unread = new Map<string, number>();
    for (const c of mine) {
      unread.set(c.id, await this.prisma.supportMessage.count({ where: { chatId: c.id, sender: SupportSender.USER, ...(c.agentReadAt ? { createdAt: { gt: c.agentReadAt } } : {}) } }));
    }
    const avatar = await this.avatars([...queued, ...mine, ...all]);
    const row = (c: (typeof queued)[number]) => ({
      id: c.id, status: c.status, topic: c.topic, requesterName: c.requesterName, kind: c.venueAccountId ? "venue" : "user",
      queuedAt: c.queuedAt.toISOString(), assignedAt: c.assignedAt?.toISOString() ?? null, agentNo: c.agentId ? agentNos.get(c.agentId) ?? null : null,
      lastUserMessageAt: c.lastUserMessageAt?.toISOString() ?? null, unread: unread.get(c.id) ?? 0, avatar: avatar.get(c.id) ?? null,
      userTyping: this.userTypingLive(c.id),
    });
    const openBreak = agent.status === SupportAgentStatus.BREAK
      ? await this.prisma.supportBreak.findFirst({ where: { agentId: me.id, endedAt: null }, orderBy: { startedAt: "desc" }, select: { startedAt: true } })
      : null;
    return {
      // assignable: yalnız SUPPORT atama alır; ADMIN / SUPERADMIN ekranında durum seçimi ve mola şeridi yok
      me: { userId: me.id, role: me.role, agentNo: agent.agentNo, status: agent.status, breakStartedAt: openBreak?.startedAt.toISOString() ?? null, assignable: me.role === UserRole.SUPPORT },
      maxChats: settings.maxChats,
      queue: queued.map(row),
      mine: mine.map(row),
      others: all.map(row),
      onlineAgents: online.filter((a) => a.userId !== me.id).map((a) => ({ userId: a.userId, agentNo: a.agentNo })),
    };
  }

  async setStatus(staff: Staff, status: SupportAgentStatus) {
    const me = await this.staffUser(staff.id);
    // ADMIN ve SUPERADMIN atama almaz: çevrimiçi / çevrimdışı / mola durumu yalnız temsilcide (SUPPORT)
    if (me.role !== UserRole.SUPPORT) throw new ForbiddenException("Bu işlem için yetkin yok");
    const agent = await this.ensureAgent(staff.id);
    const busy = await this.prisma.supportChat.count({ where: { agentId: staff.id, status: SupportChatStatus.ACTIVE } });
    const now = new Date();
    await this.prisma.supportAgent.update({ where: { userId: agent.userId }, data: { status, statusChangedAt: now, ...(busy === 0 ? { idleSince: now } : {}) } });
    // Mola kaydı: molaya çıkışta başlangıç, moladan dönüşte (ya da başka duruma geçişte) bitiş saati
    if (status === SupportAgentStatus.BREAK && agent.status !== SupportAgentStatus.BREAK) {
      await closeOpenBreak(this.prisma, agent.userId, now);
      await this.prisma.supportBreak.create({ data: { agentId: agent.userId, startedAt: now } });
    } else if (status !== SupportAgentStatus.BREAK) {
      await closeOpenBreak(this.prisma, agent.userId, now);
    }
    void this.tick();
    return { status };
  }

  // ADMIN bütün sohbetleri yalnız salt okunur görür: mesaj, görsel, iç not, yazıyor, devir, sonlandırma, kısıtlama ve devralma 403
  private denyAdmin(me: { role: UserRole }) {
    if (me.role === UserRole.ADMIN) throw new ForbiddenException("Bu işlem için yetkin yok");
  }

  // Kullanıcı tarafı yazıyor bilgisi (bellekte, 5 sn)
  private userTypingLive(chatId: string) {
    const t = this.typing.get(chatId);
    return !!t?.userAt && Date.now() - t.userAt < TYPING_TTL_MS;
  }

  // Erişim: atanmış temsilci; ADMIN bütün sohbetleri salt okunur görür; SUPERADMIN bütün sohbetleri izler (Devral ile alır)
  private async staffChat(staff: Staff, chatId: string) {
    const me = await this.staffUser(staff.id);
    const chat = await this.prisma.supportChat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException("Sohbet bulunamadı");
    if (me.role === UserRole.SUPPORT && chat.agentId !== me.id) throw new ForbiddenException("Bu sohbete erişim yetkin yok");
    return { me, chat };
  }

  // SUPERADMIN devraldıysa eski temsilci (son devri bu kayıt olan): sohbet salt okunur, ekranın altında "devralındı" notu.
  // SUPPORT rolüne yeni içerik dönmez (yalnız takenOver bayrağı); istemci elindeki son hâli salt okunur tutar, ekrandan çıkınca
  // sohbet hiçbir listede olmadığı için yeniden açılamaz.
  private async takenOverFrom(meId: string, chat: { id: string; agentId: string | null }) {
    if (chat.agentId === meId) return false;
    const last = await this.prisma.supportTransfer.findFirst({ where: { chatId: chat.id, fromAgentId: meId }, orderBy: { createdAt: "desc" }, select: { note: true } });
    return last?.note === TAKEOVER_NOTE;
  }

  async agentChat(staff: Staff, chatId: string) {
    const me = await this.staffUser(staff.id);
    const chat = await this.prisma.supportChat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException("Sohbet bulunamadı");
    const takenOver = await this.takenOverFrom(me.id, chat);
    if (me.role === UserRole.SUPPORT && chat.agentId !== me.id) {
      if (takenOver) return { id: chat.id, takenOver: true };
      throw new ForbiddenException("Bu sohbete erişim yetkin yok");
    }
    this.seen.set(`a:${me.id}`, Date.now());
    const [messages, notes, transfers, agents, avatar] = await Promise.all([
      this.prisma.supportMessage.findMany({ where: { chatId }, orderBy: { createdAt: "asc" } }),
      this.prisma.supportNote.findMany({ where: { chatId }, orderBy: { createdAt: "asc" } }),
      this.prisma.supportTransfer.findMany({ where: { chatId }, orderBy: { createdAt: "asc" } }),
      this.prisma.supportAgent.findMany({ select: { userId: true, agentNo: true } }),
      this.avatars([chat]),
    ]);
    const no = new Map(agents.map((a) => [a.userId, a.agentNo]));
    if (chat.agentId === me.id) {
      const lastUser = [...messages].reverse().find((m) => m.sender === SupportSender.USER);
      if (lastUser && (!chat.agentReadAt || chat.agentReadAt < lastUser.createdAt)) await this.prisma.supportChat.update({ where: { id: chatId }, data: { agentReadAt: new Date() } });
    }
    const t = this.typing.get(chatId);
    const userTypingLive = this.userTypingLive(chatId);
    return {
      id: chat.id, status: chat.status, topic: chat.topic, requesterName: chat.requesterName, kind: chat.venueAccountId ? "venue" : "user",
      avatar: avatar.get(chat.id) ?? null, queuedAt: chat.queuedAt.toISOString(), agentId: chat.agentId, agentNo: chat.agentId ? no.get(chat.agentId) ?? null : null,
      mine: chat.agentId === me.id, takenOver, closedAt: chat.closedAt?.toISOString() ?? null, closedBy: chat.closedBy,
      userReadAt: chat.userReadAt?.toISOString() ?? null,
      userTyping: userTypingLive,
      userOnline: OPEN.includes(chat.status) && this.isSeen(`c:${chat.id}`),
      // Yazı önizlemesi yalnız sohbete atanmış temsilciye (SUPERADMIN Devral ile aldıysa ona); salt okunur izleyen görmez
      userDraft: userTypingLive && chat.agentId === me.id ? t?.userText ?? "" : "",
      messages: messages.map((m) => this.messageView(m)),
      notes: notes.map((n) => ({ id: n.id, agentNo: n.agentNo, content: n.content, createdAt: n.createdAt.toISOString() })),
      transfers: transfers.map((x) => ({ id: x.id, from: no.get(x.fromAgentId) ?? null, to: no.get(x.toAgentId) ?? null, note: x.note, createdAt: x.createdAt.toISOString() })),
    };
  }

  async agentMessage(staff: Staff, chatId: string, content: string | undefined, files: Upload[]) {
    const { me, chat } = await this.staffChat(staff, chatId);
    this.denyAdmin(me);
    if (chat.status !== SupportChatStatus.ACTIVE || chat.agentId !== me.id) throw new ForbiddenException("Bu sohbete yalnız atanmış temsilci yazabilir.");
    const text = this.cleanText(content);
    if (!text && !files.length) throw new BadRequestException("Mesaj boş olamaz");
    const agent = await this.ensureAgent(me.id);
    const images = await this.saveImages(chatId, files);
    const msg = await this.prisma.supportMessage.create({ data: { chatId, sender: SupportSender.AGENT, senderId: me.id, agentNo: agent.agentNo, content: text, images } });
    await this.prisma.supportChat.update({
      where: { id: chatId },
      data: { lastAgentMessageAt: msg.createdAt, agentRepliedAt: chat.agentRepliedAt ?? msg.createdAt, firstResponseAt: chat.firstResponseAt ?? msg.createdAt },
    });
    const t = this.typing.get(chatId);
    if (t) t.agentAt = undefined;
    // Kullanıcı uygulamadan çıktıysa cevap push + uygulama içi bildirimle gider (üye)
    void this.pushUserIfAway(chat, text || "Görsel gönderildi", text || "Image sent");
    return this.messageView(msg);
  }

  async agentTyping(staff: Staff, chatId: string) {
    const { me, chat } = await this.staffChat(staff, chatId);
    this.denyAdmin(me);
    if (chat.agentId !== me.id) return { ok: false };
    const t = this.typing.get(chatId) ?? {};
    t.agentAt = Date.now();
    this.typing.set(chatId, t);
    return { ok: true };
  }

  async addNote(staff: Staff, chatId: string, content: string) {
    const { me, chat } = await this.staffChat(staff, chatId);
    this.denyAdmin(me);
    // İç not yalnız sohbete atanmış temsilci (SUPERADMIN yalnız Devral ettiği sohbette)
    if (chat.agentId !== me.id) throw new ForbiddenException("Bu sohbete yalnız atanmış temsilci yazabilir.");
    const text = (content ?? "").trim();
    if (!text) throw new BadRequestException("Not boş olamaz");
    const agent = await this.ensureAgent(me.id);
    const n = await this.prisma.supportNote.create({ data: { chatId, authorId: me.id, agentNo: agent.agentNo, content: text.slice(0, 2000) } });
    return { id: n.id, agentNo: n.agentNo, content: n.content, createdAt: n.createdAt.toISOString() };
  }

  // Devret: zorunlu not, hedef çevrimiçi temsilci; kullanıcıya sistem mesajı, başlıkta yeni Temsilci No
  async transfer(staff: Staff, chatId: string, toAgentId: string, note: string) {
    const { me, chat } = await this.staffChat(staff, chatId);
    this.denyAdmin(me);
    if (chat.status !== SupportChatStatus.ACTIVE || chat.agentId !== me.id) throw new ForbiddenException("Yalnız kendi açık sohbetini devredebilirsin.");
    const text = (note ?? "").trim();
    if (!text) throw new BadRequestException("Devir için açıklama notu zorunlu");
    if (toAgentId === me.id) throw new BadRequestException("Sohbeti kendine devredemezsin");
    const target = (await this.onlineAgents()).find((a) => a.userId === toAgentId);
    if (!target) throw new BadRequestException("Seçilen temsilci çevrimiçi değil");
    await this.handOver(chat.id, me.id, target, text);
    return { ok: true };
  }

  // SUPERADMIN istediği açık sohbeti devralır (aynı devir kaydı ve sistem mesajı)
  async takeOver(staff: Staff, chatId: string) {
    const { me, chat } = await this.staffChat(staff, chatId);
    if (me.role !== UserRole.SUPERADMIN) throw new ForbiddenException("Bu işlem için yetkin yok");
    if (!OPEN.includes(chat.status)) throw new BadRequestException("Sohbet açık değil");
    if (chat.agentId === me.id) return { ok: true };
    const agent = await this.ensureAgent(me.id);
    await this.handOver(chat.id, chat.agentId, agent, TAKEOVER_NOTE);
    return { ok: true };
  }

  private async handOver(chatId: string, fromId: string | null, to: { userId: string; agentNo: string }, note: string) {
    const now = new Date();
    const chat = await this.prisma.supportChat.findUnique({ where: { id: chatId } });
    if (!chat) return;
    await this.prisma.supportChat.update({
      where: { id: chatId },
      data: { status: SupportChatStatus.ACTIVE, agentId: to.userId, assignedAt: now, agentRepliedAt: now, agentReadAt: null, firstAssignedAt: chat.firstAssignedAt ?? now },
    });
    if (fromId) await this.prisma.supportTransfer.create({ data: { chatId, fromAgentId: fromId, toAgentId: to.userId, note } });
    await this.prisma.supportMessage.create({ data: { chatId, sender: SupportSender.SYSTEM, agentNo: to.agentNo, content: SYS.TRANSFERRED, images: [] } });
    await this.prisma.supportAgent.update({ where: { userId: to.userId }, data: { idleSince: null } });
    if (fromId) await this.markIdleIfFree(fromId);
    await this.pushAgent(to.userId, "Canlı Destek: sohbet devredildi", "Sana bir destek sohbeti devredildi.", chatId);
  }

  // Temsilci kapatır; "Kötüye kullanım" ile kullanıcının canlı destek erişimi 1 / 7 / 30 gün kısıtlanır (İşlem Kayıtları'na yazılır)
  async agentClose(staff: Staff, chatId: string, abuseDays?: number, abuseReason?: string) {
    const { me, chat } = await this.staffChat(staff, chatId);
    this.denyAdmin(me);
    if (!OPEN.includes(chat.status)) throw new BadRequestException("Sohbet açık değil");
    // Sonlandır ve Kötüye kullanım yalnız atanmış temsilci (SUPERADMIN yalnız Devral ettiği sohbette; izlediği sohbette 403)
    if (chat.agentId !== me.id) throw new ForbiddenException("Bu sohbeti kapatamazsın");
    if (abuseDays !== undefined) {
      if (!(RESTRICT_DAYS as readonly number[]).includes(abuseDays)) throw new BadRequestException("Kısıtlama süresi 1, 7 ya da 30 gün olmalı");
      if (!reasonOk(abuseReason)) throw new BadRequestException("Kısıtlama sebebi en az 5 karakter olmalı");
      const reason = abuseReason!.trim().slice(0, 1000);
      const agent = await this.ensureAgent(me.id);
      const expiresAt = new Date(Date.now() + abuseDays * 86_400_000);
      await this.prisma.supportRestriction.create({ data: { userId: chat.userId, venueAccountId: chat.venueAccountId, chatId, days: abuseDays, expiresAt, createdById: me.id, reason } });
      await this.close(chatId, SupportCloseReason.ABUSE);
      await this.prisma.adminActionLog.create({
        data: { adminId: me.id, action: "SUPPORT_RESTRICT", targetUserId: chat.userId, description: `Temsilci No ${agent.agentNo}, ${chat.requesterName} (${chat.venueAccountId ? "mekân" : "üye"}) canlı destek sohbetini kötüye kullanım olarak kapattı ve canlı destek erişimini ${abuseDays} gün kısıtladı. Sebep: ${reason}` },
      });
      return { ok: true };
    }
    await this.close(chatId, SupportCloseReason.AGENT);
    return { ok: true };
  }

  async agentImage(staff: Staff, chatId: string, file: string) {
    await this.staffChat(staff, chatId);
    return this.imagePath(chatId, file);
  }

  // ─── Hazır yanıtlar ──────────────────────────────────────────────────────

  async cannedList(staff: Staff) {
    await this.staffUser(staff.id);
    return this.prisma.supportCannedReply.findMany({ orderBy: { title: "asc" } });
  }
  cannedCreate(title: string, content: string) {
    if (!title?.trim() || !content?.trim()) throw new BadRequestException("Başlık ve metin zorunlu");
    return this.prisma.supportCannedReply.create({ data: { title: title.trim().slice(0, 120), content: content.trim().slice(0, SUPPORT_MESSAGE_MAX) } });
  }
  async cannedUpdate(id: string, title: string, content: string) {
    if (!title?.trim() || !content?.trim()) throw new BadRequestException("Başlık ve metin zorunlu");
    if (!(await this.prisma.supportCannedReply.findUnique({ where: { id } }))) throw new NotFoundException("Hazır yanıt bulunamadı");
    return this.prisma.supportCannedReply.update({ where: { id }, data: { title: title.trim().slice(0, 120), content: content.trim().slice(0, SUPPORT_MESSAGE_MAX) } });
  }
  async cannedDelete(id: string) {
    await this.prisma.supportCannedReply.deleteMany({ where: { id } });
    return { ok: true };
  }

  // ─── Temsilci hesapları (yalnız SUPERADMIN) ───────────────────────────────

  async agentAccounts() {
    // Temsilciler listesi yalnız SUPPORT rolü (ADMIN / SUPERADMIN gösterilmez; SupportAgent kayıtları ve numaraları durur)
    const users = await this.prisma.user.findMany({
      where: { role: UserRole.SUPPORT },
      select: { id: true, email: true, phone: true, role: true, status: true, createdAt: true, profile: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
    });
    const agents = new Map((await this.prisma.supportAgent.findMany()).map((a) => [a.userId, a]));
    const breaks = new Map((await this.prisma.supportBreak.findMany({ where: { endedAt: null }, select: { agentId: true, startedAt: true } })).map((b) => [b.agentId, b.startedAt]));
    return users.map((u) => ({
      userId: u.id, name: u.profile ? `${u.profile.firstName} ${u.profile.lastName}`.trim() : "—", email: u.email, phone: u.phone, role: u.role,
      active: u.status === UserStatus.ACTIVE, agentNo: agents.get(u.id)?.agentNo ?? null, status: agents.get(u.id)?.status ?? null, createdAt: u.createdAt.toISOString(),
      breakStartedAt: agents.get(u.id)?.status === SupportAgentStatus.BREAK ? breaks.get(u.id)?.toISOString() ?? null : null,
    }));
  }

  // Temsilci mola geçmişi (ADMIN, SUPERADMIN): tarih, başlangıç, bitiş, süre
  async agentBreaks(userId: string) {
    const rows = await this.prisma.supportBreak.findMany({ where: { agentId: userId }, orderBy: { startedAt: "desc" }, take: 200 });
    return rows.map((b) => ({ id: b.id, startedAt: b.startedAt.toISOString(), endedAt: b.endedAt?.toISOString() ?? null, durationMin: ((b.endedAt?.getTime() ?? Date.now()) - b.startedAt.getTime()) / 60_000 }));
  }

  async createAgentAccount(actorId: string, input: { firstName: string; lastName: string; email: string; phone: string; password: string }) {
    const email = (input.email ?? "").trim().toLowerCase();
    const phone = normalizePhone(input.phone ?? "");
    if (!input.firstName?.trim() || !input.lastName?.trim()) throw new BadRequestException("Ad ve soyad zorunlu");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException("Geçerli bir e-posta gir");
    if (!isE164Mobile(phone)) throw new BadRequestException("Geçerli bir telefon numarası gir");
    if ((input.password ?? "").length < 8) throw new BadRequestException("Şifre en az 8 karakter olmalı");
    if (await this.prisma.user.findFirst({ where: { OR: [{ email }, { phone }] }, select: { id: true } })) throw new ConflictException("Bu e-posta ya da telefonla kayıtlı bir hesap var");
    const user = await this.prisma.user.create({
      data: {
        email, phone, passwordHash: await bcrypt.hash(input.password, 12), role: UserRole.SUPPORT, emailVerified: true, phoneVerified: true,
        profile: { create: { firstName: input.firstName.trim(), lastName: input.lastName.trim() } },
      },
      select: { id: true },
    });
    const agent = await this.ensureAgent(user.id);
    await this.prisma.adminActionLog.create({ data: { adminId: actorId, action: "SUPPORT_AGENT_CREATE", targetUserId: user.id, description: `${input.firstName.trim()} ${input.lastName.trim()} için temsilci hesabı açtı (Temsilci No ${agent.agentNo})` } });
    return { userId: user.id, agentNo: agent.agentNo };
  }

  // Temsilci hesabını kapatır / yeniden açar (yalnız SUPPORT rolü). Kapanınca oturumlar düşer, açık sohbetleri sıraya döner.
  async setAgentAccountActive(actorId: string, userId: string, active: boolean) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true, profile: { select: { firstName: true, lastName: true } } } });
    if (!u || u.role !== UserRole.SUPPORT) throw new NotFoundException("Temsilci hesabı bulunamadı");
    await this.prisma.user.update({ where: { id: userId }, data: active ? { status: UserStatus.ACTIVE } : { status: UserStatus.DELETED, tokenVersion: { increment: 1 } } });
    if (!active) {
      await this.prisma.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true } });
      await this.prisma.supportAgent.updateMany({ where: { userId }, data: { status: SupportAgentStatus.OFFLINE, statusChangedAt: new Date() } });
      await closeOpenBreak(this.prisma, userId);
      await this.prisma.supportChat.updateMany({ where: { agentId: userId, status: SupportChatStatus.ACTIVE }, data: { status: SupportChatStatus.QUEUED, agentId: null, assignedAt: null } });
      void this.tick();
    }
    const name = u.profile ? `${u.profile.firstName} ${u.profile.lastName}`.trim() : "—";
    await this.prisma.adminActionLog.create({ data: { adminId: actorId, action: active ? "SUPPORT_AGENT_OPEN" : "SUPPORT_AGENT_CLOSE", targetUserId: userId, description: `${name} temsilci hesabını ${active ? "yeniden açtı" : "kapattı"}` } });
    return { ok: true };
  }

  // ─── Kısıtlamalar (SUPERADMIN kaldırır) ───────────────────────────────────

  async restrictions() {
    const rows = await this.prisma.supportRestriction.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    const chats = new Map((await this.prisma.supportChat.findMany({ where: { id: { in: rows.map((r) => r.chatId) } }, select: { id: true, requesterName: true } })).map((c) => [c.id, c.requesterName]));
    const agents = new Map((await this.prisma.supportAgent.findMany({ select: { userId: true, agentNo: true } })).map((a) => [a.userId, a.agentNo]));
    const now = Date.now();
    return rows.map((r) => ({
      id: r.id, requesterName: chats.get(r.chatId) ?? "—", kind: r.venueAccountId ? "venue" : "user", days: r.days,
      expiresAt: r.expiresAt.toISOString(), createdAt: r.createdAt.toISOString(), agentNo: agents.get(r.createdById) ?? null,
      liftedAt: r.liftedAt?.toISOString() ?? null, active: !r.liftedAt && r.expiresAt.getTime() > now, reason: r.reason ?? NO_REASON,
      liftReason: r.liftedAt ? r.liftReason ?? NO_REASON : null,
    }));
  }

  // Kullanıcı / mekân detayındaki "Canlı destek kısıtlamaları": o hesabın bütün kısıtları, en yeni en üstte
  async restrictionsOf(where: Prisma.SupportRestrictionWhereInput) {
    const rows = await this.prisma.supportRestriction.findMany({ where, orderBy: { createdAt: "desc" } });
    const agents = new Map((await this.prisma.supportAgent.findMany({ select: { userId: true, agentNo: true } })).map((a) => [a.userId, a.agentNo]));
    const lifterIds = [...new Set(rows.map((r) => r.liftedById).filter((x): x is string => !!x))];
    const lifters = new Map((lifterIds.length ? await this.prisma.user.findMany({ where: { id: { in: lifterIds } }, select: { id: true, role: true, profile: { select: { firstName: true, lastName: true } } } }) : [])
      .map((u) => [u.id, { name: u.profile ? `${u.profile.firstName} ${u.profile.lastName}`.trim() : "—", role: u.role, agentNo: agents.get(u.id) ?? null }]));
    const now = Date.now();
    return rows.map((r) => ({
      id: r.id, days: r.days, createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString(),
      status: r.liftedAt ? "LIFTED" : r.expiresAt.getTime() > now ? "ACTIVE" : "EXPIRED",
      agentNo: agents.get(r.createdById) ?? null, reason: r.reason ?? NO_REASON,
      liftedAt: r.liftedAt?.toISOString() ?? null, liftedBy: r.liftedById ? lifters.get(r.liftedById) ?? null : null,
      liftReason: r.liftedAt ? r.liftReason ?? NO_REASON : null,
    }));
  }

  restrictionsOfUser(userId: string) { return this.restrictionsOf({ userId }); }

  async restrictionsOfVenue(venueId: string) {
    const acc = await this.prisma.venueAccount.findUnique({ where: { venueId }, select: { id: true } });
    return acc ? this.restrictionsOf({ venueAccountId: acc.id }) : [];
  }

  // Temsilci ekranı yazı önizlemesi (300 ms yoklama): yalnız bellekten okur, hiçbir yere yazmaz
  async agentTypingState(staff: Staff, chatId: string) {
    const { me, chat } = await this.staffChat(staff, chatId);
    const typing = OPEN.includes(chat.status) && this.userTypingLive(chatId);
    return { userTyping: typing, userDraft: typing && chat.agentId === me.id ? this.typing.get(chatId)?.userText ?? "" : "" };
  }

  async liftRestriction(actorId: string, id: string, liftReason: string) {
    if (!reasonOk(liftReason)) throw new BadRequestException("Kaldırma sebebi en az 5 karakter olmalı");
    const r = await this.prisma.supportRestriction.findUnique({ where: { id } });
    if (!r) throw new NotFoundException("Kısıtlama bulunamadı");
    if (r.liftedAt) return { ok: true };
    const reason = liftReason.trim().slice(0, 1000);
    await this.prisma.supportRestriction.update({ where: { id }, data: { liftedAt: new Date(), liftedById: actorId, liftReason: reason } });
    const chat = await this.prisma.supportChat.findUnique({ where: { id: r.chatId }, select: { requesterName: true } });
    await this.prisma.adminActionLog.create({ data: { adminId: actorId, action: "SUPPORT_RESTRICT_LIFT", targetUserId: r.userId, description: `${chat?.requesterName ?? "—"} için canlı destek kısıtlamasını kaldırdı. Kısıtlama sebebi: ${r.reason ?? NO_REASON}. Kısıtlama kaldırma sebebi: ${reason}` } });
    return { ok: true };
  }

  // ─── Haiku sorgu kayıtları (SUPERADMIN) ───────────────────────────────────

  async aiLogs() {
    const rows = await this.prisma.supportAiLog.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
    return rows.map((r) => ({ id: r.id, agentNo: r.agentNo, chatId: r.chatId, question: r.question, tools: r.tools, requestType: r.requestType, success: r.success, errorType: r.errorType, createdAt: r.createdAt.toISOString() }));
  }

  // ─── Raporlar (ADMIN ve SUPERADMIN) ───────────────────────────────────────

  async reports(days: number) {
    const since = days > 0 ? new Date(Date.now() - days * 86_400_000) : undefined;
    const [chats, settings, agents] = await Promise.all([
      this.prisma.supportChat.findMany({ where: since ? { createdAt: { gte: since } } : {}, include: { rating: true } }),
      this.settings(),
      this.prisma.supportAgent.findMany({ select: { userId: true, agentNo: true } }),
    ]);
    const min = (a: Date | null, b: Date | null) => (a && b ? (b.getTime() - a.getTime()) / 60_000 : null);
    const per = new Map<string, typeof chats>();
    for (const c of chats) {
      if (!c.agentId || c.status !== SupportChatStatus.CLOSED) continue;
      per.set(c.agentId, [...(per.get(c.agentId) ?? []), c]);
    }
    const byAgent = agents.map((a) => {
      const list = per.get(a.userId) ?? [];
      const rated = list.filter((c) => c.rating);
      const tags: Record<string, number> = {};
      for (const c of rated) for (const t of c.rating!.tags) tags[RATING_TAG_TR[t] ?? t] = (tags[RATING_TAG_TR[t] ?? t] ?? 0) + 1;
      const fr = list.map((c) => min(c.firstAssignedAt, c.firstResponseAt)).filter((x): x is number => x !== null);
      const dur = list.map((c) => min(c.firstAssignedAt, c.closedAt)).filter((x): x is number => x !== null);
      return {
        agentNo: a.agentNo,
        closed: list.length,
        firstResponseMin: avg(fr),
        avgDurationMin: avg(dur),
        avgStars: avg(rated.map((c) => c.rating!.stars)),
        helpedYesRate: rated.length ? rated.filter((c) => c.rating!.helped).length / rated.length : null,
        ratings: rated.length,
        tags,
      };
    }).filter((r) => r.closed > 0);
    const topics: Record<string, number> = {};
    const hourly = Array.from({ length: 24 }, () => 0);
    const shift = { DAY: 0, NIGHT: 0 };
    for (const c of chats) {
      topics[TOPIC_TR[c.topic]] = (topics[TOPIC_TR[c.topic]] ?? 0) + 1;
      hourly[trHour(c.queuedAt)]++;
      shift[this.shiftOf(c.queuedAt, settings)]++;
    }
    const waits = chats.map((c) => min(c.queuedAt, c.firstAssignedAt)).filter((x): x is number => x !== null);
    return {
      total: chats.length,
      open: chats.filter((c) => OPEN.includes(c.status)).length,
      avgWaitMin: avg(waits),
      topics, hourly, shift, shiftDay: settings.shiftDay, shiftNight: settings.shiftNight, byAgent,
    };
  }

  // ─── Tüm Sohbetler (yalnız SUPERADMIN): açık, sıradaki ve kapanmış bütün sohbetler ───────────────

  // Satırdaki ad: üyede ad soyad, mekânda mekân adı (requesterName "mekân adı · yetkili ad soyad" biçiminde saklanır)
  private displayName(c: { requesterName: string; venueAccountId: string | null }) {
    if (!c.venueAccountId) return c.requesterName;
    const i = c.requesterName.lastIndexOf(" · ");
    return i > 0 ? c.requesterName.slice(0, i) : c.requesterName;
  }

  // Filtreler: tarih aralığı (başlangıç günü, TR), durum, konu, Temsilci No, hesap türü; ad soyad / mekân adıyla arama
  async allChats(f: { from?: string; to?: string; status?: string; topic?: string; agentNo?: string; kind?: string; q?: string; page?: string }) {
    const day = /^\d{4}-\d{2}-\d{2}$/;
    const where: Prisma.SupportChatWhereInput = {};
    const created: Prisma.DateTimeFilter = {};
    if (f.from && day.test(f.from)) created.gte = new Date(`${f.from}T00:00:00+03:00`);
    if (f.to && day.test(f.to)) created.lt = new Date(new Date(`${f.to}T00:00:00+03:00`).getTime() + 86_400_000);
    if (created.gte || created.lt) where.createdAt = created;
    if (f.status && (Object.values(SupportChatStatus) as string[]).includes(f.status)) where.status = f.status as SupportChatStatus;
    if (f.topic && (Object.values(SupportTopic) as string[]).includes(f.topic)) where.topic = f.topic as SupportTopic;
    if (f.kind === "user") where.venueAccountId = null;
    if (f.kind === "venue") where.venueAccountId = { not: null };
    const q = (f.q ?? "").trim();
    if (q) where.requesterName = { contains: q.slice(0, 100), mode: "insensitive" };
    const agents = await this.prisma.supportAgent.findMany({ select: { userId: true, agentNo: true } });
    const no = new Map(agents.map((a) => [a.userId, a.agentNo]));
    const agentNo = (f.agentNo ?? "").trim();
    if (agentNo) where.agentId = agents.find((a) => a.agentNo === agentNo)?.userId ?? "__none__";
    const size = 50;
    const page = Math.max(1, Math.floor(Number(f.page) || 1));
    const [total, rows] = await Promise.all([
      this.prisma.supportChat.count({ where }),
      this.prisma.supportChat.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size, include: { rating: { select: { stars: true } } } }),
    ]);
    const now = Date.now();
    const avatar = await this.avatars(rows);
    return {
      total, page, pages: Math.max(1, Math.ceil(total / size)),
      rows: rows.map((c) => ({
        id: c.id, name: this.displayName(c), kind: c.venueAccountId ? "venue" : "user", avatar: avatar.get(c.id) ?? null, topic: c.topic, status: c.status,
        agentNo: c.agentId ? no.get(c.agentId) ?? null : null, startedAt: c.createdAt.toISOString(),
        durationMin: ((c.closedAt?.getTime() ?? now) - c.createdAt.getTime()) / 60_000, stars: c.rating?.stars ?? null,
      })),
    };
  }

  // Sohbetin tamamı: mesajlar, görseller, iç notlar, devirler, değerlendirme ve yorum, Haiku sorgu kayıtları
  async allChatDetail(chatId: string) {
    const chat = await this.prisma.supportChat.findUnique({ where: { id: chatId }, include: { rating: true } });
    if (!chat) throw new NotFoundException("Sohbet bulunamadı");
    const [messages, notes, transfers, aiLogs, agents, avatar, restriction] = await Promise.all([
      this.prisma.supportMessage.findMany({ where: { chatId }, orderBy: { createdAt: "asc" } }),
      this.prisma.supportNote.findMany({ where: { chatId }, orderBy: { createdAt: "asc" } }),
      this.prisma.supportTransfer.findMany({ where: { chatId }, orderBy: { createdAt: "asc" } }),
      this.prisma.supportAiLog.findMany({ where: { chatId }, orderBy: { createdAt: "asc" } }),
      this.prisma.supportAgent.findMany({ select: { userId: true, agentNo: true } }),
      this.avatars([chat]),
      this.prisma.supportRestriction.findFirst({ where: { chatId }, orderBy: { createdAt: "desc" } }),
    ]);
    const no = new Map(agents.map((a) => [a.userId, a.agentNo]));
    const r = chat.rating;
    return {
      id: chat.id, name: this.displayName(chat), requesterName: chat.requesterName, kind: chat.venueAccountId ? "venue" : "user",
      avatar: avatar.get(chat.id) ?? null, topic: chat.topic, status: chat.status, agentNo: chat.agentId ? no.get(chat.agentId) ?? null : null,
      startedAt: chat.createdAt.toISOString(), closedAt: chat.closedAt?.toISOString() ?? null, closedBy: chat.closedBy,
      durationMin: ((chat.closedAt?.getTime() ?? Date.now()) - chat.createdAt.getTime()) / 60_000,
      messages: messages.map((m) => this.messageView(m)),
      notes: notes.map((n) => ({ id: n.id, agentNo: n.agentNo, content: n.content, createdAt: n.createdAt.toISOString() })),
      transfers: transfers.map((x) => ({ id: x.id, from: no.get(x.fromAgentId) ?? null, to: no.get(x.toAgentId) ?? null, note: x.note, createdAt: x.createdAt.toISOString() })),
      rating: r ? { helped: r.helped, stars: r.stars, tags: r.tags.map((t) => RATING_TAG_TR[t] ?? t), comment: r.comment, createdAt: r.createdAt.toISOString() } : null,
      aiLogs: aiLogs.map((l) => ({ id: l.id, agentNo: l.agentNo, question: l.question, tools: l.tools, requestType: l.requestType, success: l.success, errorType: l.errorType, createdAt: l.createdAt.toISOString() })),
      // Kötüye kullanım kısıtlaması (bu sohbetten verildiyse); sebep kullanıcıya hiçbir yerde gösterilmez
      restriction: restriction ? {
        days: restriction.days, reason: restriction.reason ?? NO_REASON, createdAt: restriction.createdAt.toISOString(), expiresAt: restriction.expiresAt.toISOString(),
        liftedAt: restriction.liftedAt?.toISOString() ?? null, agentNo: no.get(restriction.createdById) ?? null,
        liftReason: restriction.liftedAt ? restriction.liftReason ?? NO_REASON : null,
      } : null,
    };
  }

  // ─── Menü baloncuğu: sıradaki sohbet sayısı ──────────────────────────────

  queueCount() { return this.prisma.supportChat.count({ where: { status: SupportChatStatus.QUEUED } }); }

  // Haiku için sohbet kaydı (ID sunucudan)
  async chatForAi(staff: Staff, chatId: string) {
    const { me, chat } = await this.staffChat(staff, chatId);
    // SUPERADMIN izlediği (Devral etmediği) sohbette Haiku asistanını kullanamaz
    if (me.role === UserRole.SUPERADMIN && chat.agentId !== me.id) throw new ForbiddenException("Bu işlem için yetkin yok");
    const agent = await this.ensureAgent(me.id);
    const messages = await this.prisma.supportMessage.findMany({ where: { chatId }, orderBy: { createdAt: "asc" } });
    return { chat, agent, messages };
  }
}
