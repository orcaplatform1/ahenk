import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappNotifyService } from "../notification/whatsapp-notify.service";
import { FcmService } from "../notification/fcm/fcm.service";
import { NotificationService } from "../notification/notification.service";
import { Logger } from "@nestjs/common";
import { AdminAlertType, MeetingStatus, Prisma, UserRole } from "../generated/prisma/client";
import { sosWindowEnd } from "../meetings/meeting-windows";

type Viewer = { id: string; role: UserRole };
type SnapshotPerson = { userId: string; [key: string]: unknown };

const INACTIVE = ["CANCELLED", "DECLINED", "NO_SHOW"];

export const THREAT_LABELS: Record<string, string> = {
  LIFE_DANGER:      "Hayatım tehlikede",
  PHYSICAL_VIOLENCE:"Fiziksel şiddet gördüm",
  ABDUCTION:        "Zorla alıkoyuluyorum",
  HARASSMENT:       "Taciz veya istismara uğradım",
};

// ─── Açık adres (Nominatim ters adres çözümleme) ───────────────────────────
// Yalnızca backend sorgular; sunucu genelinde Nominatim'e saniyede en fazla 1 istek (global sıra).
// Her açık talep için adres en fazla 15 sn'de bir yenilenir; koordinat değişmediyse tekrar sorulmaz.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_UA = "Ahenk/1.0 (https://ahenk.co)";
const NOMINATIM_GAP_MS = 1000;
const NOMINATIM_TIMEOUT_MS = 5000;
const ADDRESS_REFRESH_MS = 15_000;
const HISTORY_CACHE_MAX = 1000; // konum geçmişi adresleri: koordinat bazlı önbellek üst sınırı

export interface SosAddress {
  il: string | null; ilce: string | null; mahalle: string | null; caddeSokak: string | null;
  binaNo: string | null; postaKodu: string | null; tamAdres: string | null; guncelleme: Date;
  kisaAdres: string; // katılımcı koordinat satırındaki tek satırlık adres (cadde, mahalle, ilçe, şehir)
}
interface AddressCacheEntry { lat: number; lng: number; checkedAt: number; inFlight: boolean; address: SosAddress | null }

@Injectable()
export class SosService {
  private readonly logger = new Logger(SosService.name);
  // Talep bazında bellek içi adres önbelleği (talep çözülünce silinir)
  private readonly addressCache = new Map<string, AddressCacheEntry>();
  // Global Nominatim sırası: tek işçi, iki istek arası en az 1 sn. Güncel adres (öncelikli) konum geçmişinden önce işlenir.
  private readonly nominatimQueue: { priority: boolean; run: () => Promise<void> }[] = [];
  private nominatimBusy = false;
  private lastNominatimAt = 0;
  // Konum geçmişi adresleri: koordinat (5 hane) bazlı önbellek + sırada bekleyenler
  private readonly historyAddressCache = new Map<string, SosAddress>();
  private readonly historyPending = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappNotifyService,
    private fcm: FcmService,
    private notifications: NotificationService,
  ) {}

  private inSosWindow(scheduledAt: Date): boolean {
    const now = new Date();
    return now >= scheduledAt && now < sosWindowEnd(scheduledAt);
  }

  // ─── Rapor oluştur ────────────────────────────────────────────────────────

  async createReport(
    userId: string,
    meetingId: string,
    threats: string[],
    lat?: number,
    lng?: number,
    accuracy?: number,
  ) {
    // Kullanıcı bu masanın aktif katılımcısı mı?
    const participation = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId } },
    });
    if (!participation || INACTIVE.includes(participation.status)) {
      throw new ForbiddenException("Bu masanın aktif katılımcısı değilsiniz");
    }

    // Masa + tüm katılımcıların tam bilgisi (snapshot)
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });
    if (!meeting) throw new NotFoundException("Masa bulunamadı");
    if (meeting.status === MeetingStatus.CANCELLED) {
      throw new ForbiddenException("İptal edilmiş masada acil yardım kullanılamaz");
    }

    // SOS süresi: masa saatinden (scheduledAt) ertesi gün 08:00 TR'ye kadar (web aynı anı sosEndsAt ile alır)
    if (!this.inSosWindow(meeting.scheduledAt)) {
      throw new ForbiddenException("Acil yardım bu masa için şu an kullanılamaz");
    }

    // Açık talebi varsa (ör. "Tekrar dene") yeni talep açılmaz, aynı talep döner
    const open = await this.prisma.sosReport.findFirst({
      where: { userId, meetingId, resolvedAt: null },
      select: { id: true },
    });
    if (open) return { reportId: open.id };

    const participantSnapshot = meeting.participants.map((p) => {
      const u = p.user;
      const prof = u.profile;
      const birthDate = prof?.birthDate;
      const age = birthDate
        ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : null;
      return {
        userId:     u.id,
        firstName:  prof?.firstName ?? null,
        lastName:   prof?.lastName ?? null,
        email:      u.email,
        phone:      u.phone ?? null,
        age,
        gender:     prof?.gender ?? null,
        occupation: u.occupationSector,
        city:       prof?.city ?? null,
        isRequester: u.id === userId,
        isBot:      u.isBot,
      };
    });

    // Benzersiz openKey: eşzamanlı isteklerden yalnız biri rapor açar (uyarı da tek olur), diğerleri aynı raporu alır
    const openKey = `${userId}:${meetingId}`;
    let report: { id: string };
    try {
      report = await this.prisma.sosReport.create({
        data: {
          userId,
          meetingId,
          threats,
          lat: lat ?? null,
          lng: lng ?? null,
          accuracy: accuracy ?? null,
          participantSnapshot,
          openKey,
        },
        select: { id: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await this.prisma.sosReport.findUnique({ where: { openKey }, select: { id: true } });
        if (existing) return { reportId: existing.id };
      }
      throw err;
    }

    // WhatsApp: tüm admin ve superadmin kullanıcılarına gönder
    this.notifyAdmins(report.id, userId, meetingId, threats, lat, lng).catch(() =>
      this.logger.error(`Admin bildirimi gönderilemedi (rapor: ${report.id}, masa: ${meetingId}, tehdit: ${threats.join(",")})`),
    );

    return { reportId: report.id };
  }

  // ─── Canlı konum güncelle ─────────────────────────────────────────────────

  // Talep eden: talep sonuçlanana kadar saat sınırı olmadan canlı konum; sonra { active: false } → takip durur
  async updateLocation(reportId: string, userId: string, lat: number, lng: number, accuracy?: number) {
    const report = await this.prisma.sosReport.findUnique({ where: { id: reportId } });
    if (!report || report.userId !== userId) throw new ForbiddenException();
    if (report.resolvedAt) return { active: false };

    await this.prisma.sosLocationUpdate.create({
      data: { reportId, lat, lng, accuracy: accuracy ?? null },
    });

    // En son konumu raporda da güncelle
    await this.prisma.sosReport.update({
      where: { id: reportId },
      data: { lat, lng, accuracy: accuracy ?? null },
    });

    return { active: true };
  }

  // Sayfa yenilenince kullanıcının o masadaki açık talebi geri yüklenir (canlı konum devam eder)
  async myOpenReport(userId: string, meetingId: string) {
    const report = await this.prisma.sosReport.findFirst({
      where: { userId, meetingId, resolvedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return { reportId: report?.id ?? null };
  }

  // Kullanıcının açık talebi (masa kartı kalksa da): site genelindeki talep ekranı buradan beslenir
  async myAnyOpenReport(userId: string) {
    const report = await this.prisma.sosReport.findFirst({
      where: { userId, resolvedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return { reportId: report?.id ?? null };
  }

  // ─── Admin: görünürlük ────────────────────────────────────────────────────
  // Talebi "İlgileniyorum" ile üstlenen admin + SUPERADMIN tüm veriyi görür; diğer adminler sadece kimin ilgilendiğini.
  // Bot bilgisi sadece SUPERADMIN'e (ADMIN listesinde bot hiç yer almaz); e-posta HideEmail interceptor ile gizlenir.

  private canSee(report: { claimedById: string | null }, viewer: Viewer): boolean {
    return viewer.role === UserRole.SUPERADMIN || !report.claimedById || report.claimedById === viewer.id;
  }

  private async botIds(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const bots = await this.prisma.user.findMany({ where: { id: { in: userIds }, isBot: true }, select: { id: true } });
    return new Set(bots.map((b) => b.id));
  }

  // Hesabı silinmiş kişiler: kimlik bilgisi kayıtta kalır, sadece SUPERADMIN görür
  private async deletedIds(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const rows = await this.prisma.user.findMany({ where: { id: { in: userIds }, status: "DELETED" }, select: { id: true } });
    return new Set(rows.map((r) => r.id));
  }

  private shapeSnapshot(snapshot: unknown, bots: Set<string>, viewer: Viewer, deleted: Set<string>) {
    const people = (Array.isArray(snapshot) ? snapshot : []) as SnapshotPerson[];
    if (viewer.role === UserRole.SUPERADMIN) return people.map((p) => ({ ...p, isBot: bots.has(p.userId) }));
    return people.filter((p) => !bots.has(p.userId) && !deleted.has(p.userId)).map(({ isBot: _isBot, ...p }) => p);
  }

  private adminName = { select: { id: true, profile: { select: { firstName: true, lastName: true } } } } as const;

  // ─── Admin: tüm raporlar ──────────────────────────────────────────────────

  async adminListReports(viewer: Viewer) {
    const reports = await this.prisma.sosReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: {
          select: {
            id: true, email: true, phone: true,
            profile: { select: { firstName: true, lastName: true, gender: true, birthDate: true, city: true } },
          },
        },
        meeting: {
          select: { id: true, type: true, scheduledAt: true, locationText: true, venueAddress: true },
        },
        locationUpdates: { orderBy: { timestamp: "desc" }, take: 1 },
        claimedBy: this.adminName,
        resolvedBy: this.adminName,
      },
    });
    const bots = await this.botIds(
      reports.flatMap((r) => ((Array.isArray(r.participantSnapshot) ? r.participantSnapshot : []) as SnapshotPerson[]).map((p) => p.userId)),
    );
    const deleted = await this.deletedIds(
      reports.flatMap((r) => ((Array.isArray(r.participantSnapshot) ? r.participantSnapshot : []) as SnapshotPerson[]).map((p) => p.userId)),
    );
    return reports.map((r) =>
      this.canSee(r, viewer)
        ? { ...r, restricted: false, participantSnapshot: this.shapeSnapshot(r.participantSnapshot, bots, viewer, deleted) }
        : { id: r.id, createdAt: r.createdAt, resolvedAt: r.resolvedAt, claimedAt: r.claimedAt, claimedBy: r.claimedBy, restricted: true },
    );
  }

  // ─── Admin: rapor detayı (+ tüm katılımcı konumları) ────────────────────

  async adminGetReport(id: string, viewer: Viewer) {
    const report = await this.prisma.sosReport.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true, email: true, phone: true,
            profile: { select: { firstName: true, lastName: true, gender: true, birthDate: true, city: true } },
          },
        },
        meeting: true,
        locationUpdates: { orderBy: { timestamp: "asc" } },
        claimedBy: this.adminName,
        resolvedBy: this.adminName,
      },
    });
    if (!report) throw new NotFoundException();
    if (!this.canSee(report, viewer)) throw new ForbiddenException("Bu talep başka bir admin tarafından takip ediliyor");

    // Aynı masadaki tüm katılımcıların konumları (kayıtlar talep çözülse de durur)
    // Masa silindiyse (meetingId null) katılımcı konumu yoktur
    const participantLocations = !report.meetingId ? [] : await this.prisma.participantLocation.findMany({
      where: { meetingId: report.meetingId },
      orderBy: { timestamp: "desc" },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    // Her kullanıcı için en son konum
    const latestByUser = new Map<string, typeof participantLocations[0]>();
    for (const loc of participantLocations) {
      if (!latestByUser.has(loc.userId)) latestByUser.set(loc.userId, loc);
    }

    const snapshot = (Array.isArray(report.participantSnapshot) ? report.participantSnapshot : []) as SnapshotPerson[];
    const bots = await this.botIds(snapshot.map((p) => p.userId));
    const deleted = await this.deletedIds(snapshot.map((p) => p.userId));
    return {
      ...report,
      // Konum geçmişi: her satıra açık adres (backend önbelleği; yoksa sıraya eklenir, null döner)
      locationUpdates: report.locationUpdates.map((lu) => ({ ...lu, address: this.historyAddress(lu.lat, lu.lng) })),
      restricted: false,
      participantSnapshot: this.shapeSnapshot(report.participantSnapshot, bots, viewer, deleted),
      // Katılımcı koordinat satırları: açık adres aynı koordinat önbelleği + global kuyruktan (düşük öncelik)
      allParticipantLocations: Array.from(latestByUser.values()).map((l) => ({ ...l, address: this.historyAddress(l.lat, l.lng) })),
      participantLocationHistory: participantLocations,
    };
  }

  // Canlı harita: çözülmemiş tüm açık taleplerin talep eden konumu, sabit 2 sorguda.
  // Konum: talep konum güncellemesi ile katılımcı konumundan zamanı yeni olanı. Yetki canSee ile aynı:
  // başka adminin üstlendiği talep dönmez, SUPERADMIN hepsini görür.
  async adminOpenLocations(viewer: Viewer) {
    // 1) Açık talepler + her birinin son konum güncellemesi (Prisma ilişki take:1)
    const reports = await this.prisma.sosReport.findMany({
      where: {
        resolvedAt: null,
        ...(viewer.role === UserRole.SUPERADMIN ? {} : { OR: [{ claimedById: null }, { claimedById: viewer.id }] }),
      },
      select: {
        id: true, userId: true, meetingId: true,
        locationUpdates: { orderBy: { timestamp: "desc" }, take: 1, select: { lat: true, lng: true, timestamp: true } },
      },
    });
    // 2) Talep edenlerin masadaki son katılımcı konumu: tüm (masa, kişi) çiftleri tek sorguda
    const pairs = reports
      .filter((r) => r.meetingId && r.userId)
      .map((r) => ({ meetingId: r.meetingId as string, userId: r.userId as string }));
    const partRows = pairs.length === 0 ? [] : await this.prisma.participantLocation.findMany({
      where: { OR: pairs },
      orderBy: { timestamp: "desc" },
      distinct: ["meetingId", "userId"],
      select: { meetingId: true, userId: true, lat: true, lng: true, timestamp: true },
    });
    const partBy = new Map(partRows.map((p) => [`${p.meetingId}:${p.userId}`, p]));
    // SUPERADMIN listesi tüm açık talepleri içerir: listede olmayan (çözülmüş/silinmiş) taleplerin adresi önbellekten silinir
    if (viewer.role === UserRole.SUPERADMIN) {
      const openIds = new Set(reports.map((r) => r.id));
      for (const id of this.addressCache.keys()) if (!openIds.has(id)) this.addressCache.delete(id);
    }
    return reports.map((r) => {
      const update = r.locationUpdates[0] ?? null;
      const p = r.meetingId && r.userId ? partBy.get(`${r.meetingId}:${r.userId}`) : undefined;
      const part = p ? { lat: p.lat, lng: p.lng, timestamp: p.timestamp } : null;
      const location = part && (!update || part.timestamp >= update.timestamp) ? part : update;
      // Uç her saniye çağrılır ama Nominatim'e gitmez: yenileme gerekiyorsa arka planda sıraya eklenir, önbellek döner
      if (location) this.refreshAddress(r.id, location.lat, location.lng);
      return { reportId: r.id, location, address: this.addressCache.get(r.id)?.address ?? null };
    });
  }

  // 15 sn kuralı: son kontrolden 15 sn geçmediyse ya da istek sürüyorsa hiçbir şey yapılmaz.
  // Koordinat bir önceki sorgudakiyle aynıysa ve adres varsa Nominatim'e tekrar sorulmaz.
  private refreshAddress(reportId: string, lat: number, lng: number) {
    const now = Date.now();
    const entry = this.addressCache.get(reportId);
    if (entry && (entry.inFlight || now - entry.checkedAt < ADDRESS_REFRESH_MS)) return;
    if (entry && entry.address && entry.lat === lat && entry.lng === lng) { entry.checkedAt = now; return; }
    const e: AddressCacheEntry = entry ?? { lat, lng, checkedAt: now, inFlight: false, address: null };
    e.lat = lat; e.lng = lng; e.checkedAt = now; e.inFlight = true;
    this.addressCache.set(reportId, e);
    this.enqueueNominatim(true, async () => {
      try {
        if (!this.addressCache.has(reportId)) return; // sırada beklerken talep çözüldü
        const address = await this.reverseGeocode(lat, lng);
        const cur = this.addressCache.get(reportId);
        if (cur && address) cur.address = address; // hata/zaman aşımında son bilinen adres korunur
      } finally {
        const cur = this.addressCache.get(reportId);
        if (cur) cur.inFlight = false;
      }
    });
  }

  // Konum geçmişi ve katılımcı koordinat satırlarının adresi: önbellekte varsa döner; yoksa (sırada değilse) sıraya eklenir ve null döner.
  // Aynı koordinat bir kez çözülür; sonraki 15 sn detay yenilemelerinde önbellekten gelir.
  private historyAddress(lat: number, lng: number): SosAddress | null {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const hit = this.historyAddressCache.get(key);
    if (hit) return hit;
    if (!this.historyPending.has(key)) {
      this.historyPending.add(key);
      this.enqueueNominatim(false, async () => {
        try {
          const address = await this.reverseGeocode(lat, lng);
          if (address) {
            if (this.historyAddressCache.size >= HISTORY_CACHE_MAX) {
              const oldest = this.historyAddressCache.keys().next().value;
              if (oldest !== undefined) this.historyAddressCache.delete(oldest);
            }
            this.historyAddressCache.set(key, address);
          }
        } finally {
          this.historyPending.delete(key);
        }
      });
    }
    return null;
  }

  // Global sıra: öncelikli iş sıranın önüne girer; işçi her istekten önce son istekten bu yana 1 sn geçmesini bekler
  private enqueueNominatim(priority: boolean, run: () => Promise<void>) {
    const job = { priority, run };
    if (priority) {
      const i = this.nominatimQueue.findIndex((j) => !j.priority);
      if (i === -1) this.nominatimQueue.push(job); else this.nominatimQueue.splice(i, 0, job);
    } else {
      this.nominatimQueue.push(job);
    }
    void this.drainNominatim();
  }

  private async drainNominatim() {
    if (this.nominatimBusy) return;
    this.nominatimBusy = true;
    try {
      for (let job = this.nominatimQueue.shift(); job; job = this.nominatimQueue.shift()) {
        const wait = this.lastNominatimAt + NOMINATIM_GAP_MS - Date.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        this.lastNominatimAt = Date.now();
        await job.run().catch(() => undefined);
      }
    } finally {
      this.nominatimBusy = false;
    }
  }

  private async reverseGeocode(lat: number, lng: number): Promise<SosAddress | null> {
    const url = `${NOMINATIM_URL}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=tr`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": NOMINATIM_UA }, signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS) });
      if (!res.ok) { this.logger.warn(`Nominatim adres çözümleme hatası: HTTP ${res.status}`); return null; }
      const d = (await res.json()) as { display_name?: string; address?: Record<string, string> };
      const a = d.address ?? {};
      return {
        il: a.province ?? a.state ?? null,
        ilce: a.town ?? a.county ?? a.district ?? null,
        mahalle: a.suburb ?? a.neighbourhood ?? a.quarter ?? null,
        caddeSokak: a.road ?? null,
        binaNo: a.house_number ?? null,
        postaKodu: a.postcode ?? null,
        tamAdres: d.display_name ?? null,
        guncelleme: new Date(),
        kisaAdres: [
          a.road ?? a.pedestrian ?? a.path,
          a.neighbourhood ?? a.suburb ?? a.quarter,
          a.district ?? a.county,
          a.city ?? a.town ?? a.village ?? a.state,
        ].filter(Boolean).join(", ") || d.display_name?.split(",").slice(0, 3).join(",").trim() || "",
      };
    } catch (err) {
      this.logger.warn(`Nominatim adres çözümleme yanıt vermedi: ${(err as Error).message}`);
      return null;
    }
  }

  // ─── Admin: üstlen / çöz ─────────────────────────────────────────────────

  async claimReport(id: string, viewer: Viewer) {
    const report = await this.prisma.sosReport.findUnique({ where: { id }, select: { claimedById: true, resolvedAt: true } });
    if (!report) throw new NotFoundException();
    if (report.resolvedAt) throw new BadRequestException("Talep zaten çözülmüş");
    // Atomik: boş talebi yalnız bir admin üstlenir; üstlenilmiş talep başkasına geçmez
    const { count } = await this.prisma.sosReport.updateMany({
      where: { id, resolvedAt: null, OR: [{ claimedById: null }, { claimedById: viewer.id }] },
      data: { claimedById: viewer.id, claimedAt: new Date() },
    });
    if (count === 0) throw new ForbiddenException("Bu talep başka bir admin tarafından takip ediliyor");
    return { claimed: true };
  }

  // Çözülünce o masada konum alınması durur; tüm kayıtlar saklanır
  async resolveReport(id: string, viewer: Viewer) {
    const report = await this.prisma.sosReport.findUnique({ where: { id }, select: { claimedById: true, resolvedAt: true } });
    if (!report) throw new NotFoundException();
    if (report.resolvedAt) throw new BadRequestException("Talep zaten çözülmüş");
    if (viewer.role !== UserRole.SUPERADMIN && report.claimedById !== viewer.id) {
      throw new ForbiddenException("Önce 'İlgileniyorum' ile talebi üstlenin");
    }
    await this.prisma.sosReport.update({ where: { id }, data: { resolvedAt: new Date(), resolvedById: viewer.id, openKey: null } });
    this.addressCache.delete(id); // açık adres önbelleği talep çözülünce silinir
    return { resolved: true };
  }

  // ─── Tüm masa üyeleri konum güncelle ────────────────────────────────────
  // Sadece acil yardım süresinde ve aktif katılımcıdan (iptal eden / gelmedi sayılan alınmaz).
  // Masadaki talep çözüldüyse (açık talep kalmadıysa) konum alınmaz. Kabul edilmezse { active: false } → takip durur.
  // Katılımcıya masa başına bir kez bilgilendirme gider.

  async updateParticipantLocation(
    meetingId: string,
    userId: string,
    lat: number,
    lng: number,
    accuracy?: number,
  ) {
    const participation = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId } },
      select: { status: true, meeting: { select: { status: true, scheduledAt: true } } },
    });
    if (!participation) throw new ForbiddenException("Bu masanın katılımcısı değilsiniz");
    if (
      INACTIVE.includes(participation.status) ||
      participation.meeting.status === MeetingStatus.CANCELLED ||
      !this.inSosWindow(participation.meeting.scheduledAt)
    ) {
      return { active: false };
    }
    const [resolved, open] = await Promise.all([
      this.prisma.sosReport.count({ where: { meetingId, resolvedAt: { not: null } } }),
      this.prisma.sosReport.count({ where: { meetingId, resolvedAt: null } }),
    ]);
    if (resolved > 0 && open === 0) return { active: false };

    const first = (await this.prisma.participantLocation.count({ where: { meetingId, userId } })) === 0;
    await this.prisma.participantLocation.create({
      data: { meetingId, userId, lat, lng, accuracy: accuracy ?? null },
    });
    if (first) {
      await this.notifications.sendToUser(userId, {
        title: "Güvenliğin için",
        body: "Masa süresince konumun, acil bir durumda kullanılmak üzere güvenlik ekibimizle paylaşılır.",
        data: { type: "LOCATION_NOTICE", meetingId },
      }).catch(() => undefined);
    }
    return { active: true };
  }

  // ─── İç: admin bildirim ───────────────────────────────────────────────────

  private async notifyAdmins(
    reportId: string,
    userId: string,
    meetingId: string,
    threats: string[],
    lat?: number,
    lng?: number,
  ) {
    // Loglarda yalnızca rapor, masa ve tehdit kodu yer alır
    const logCtx = `rapor: ${reportId}, masa: ${meetingId}, tehdit: ${threats.join(",")}`;

    // AdminAlert: talep başına tek kayıt, bildirimlerden önce yazılır (uyarılar sayfası tüm adminlere ortak)
    try {
      await this.prisma.adminAlert.create({ data: { userId, alertType: AdminAlertType.SOS_ALERT } });
    } catch {
      this.logger.error(`AdminAlert oluşturulamadı (${logCtx})`);
    }

    this.logger.error(`[ACİL YARDIM] ${logCtx}`);

    const admins = await this.prisma.user.findMany({
      where: { role: { in: [UserRole.ADMIN, UserRole.SUPERADMIN] } },
      select: { id: true, phone: true, fcmToken: true, profile: { select: { firstName: true, lastName: true } } },
    });

    const reporter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, profile: { select: { firstName: true, lastName: true } } },
    });

    const name     = reporter?.profile ? `${reporter.profile.firstName} ${reporter.profile.lastName}` : reporter?.email ?? userId;
    const threatTx = threats.map((t) => THREAT_LABELS[t] ?? t).join(", ");
    const locTx    = lat && lng ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Konum alınamadı";

    // Her kanal ve admin bağımsız ilerler: biri hata verirse veya zaman aşımına uğrarsa diğerleri beklemez
    const deliveries = admins.flatMap((adm) => {
      const channels: { channel: string; send: Promise<unknown> }[] = [];
      if (adm.phone) {
        channels.push({ channel: "WhatsApp", send: this.whatsapp.send(adm.phone, "ahenk_sos_alert", [name, threatTx, locTx]) });
      }
      if (adm.fcmToken) {
        channels.push({
          channel: "FCM",
          send: this.fcm.sendToToken({
            token: adm.fcmToken,
            title: "🚨 ACİL YARDIM TALEBİ",
            body:  `${name}: ${threatTx}`,
            data:  { reportId, meetingId, type: "SOS_ALERT" },
          }),
        });
      }
      return channels;
    });

    const results = await Promise.allSettled(deliveries.map((d) => d.send));
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        this.logger.warn(`${deliveries[i].channel} bildirimi başarısız (${logCtx})`);
      }
    });
  }
}
