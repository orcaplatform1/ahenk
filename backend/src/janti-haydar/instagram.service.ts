import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

// @jantihaydar istatistikleri: "Instagram API with Instagram Login" (graph.instagram.com) — Facebook sayfası gerekmez.
// Değerler .env: INSTAGRAM_ACCESS_TOKEN (uzun süreli token), INSTAGRAM_USER_ID. Yoksa istatistik dönmez (sayfada gizlenir).
const GRAPH = 'https://graph.instagram.com';
const API_VERSION = 'v23.0';
const CACHE_MS = 60 * 60 * 1000; // 1 saat
const TIMEOUT_MS = 8000;
// Yenilenen token DB'de (AppConfig) tutulur; .env'deki ilk token ondan eskiyse DB'deki kullanılır
const TOKEN_KEY = 'INSTAGRAM_ACCESS_TOKEN';
const TOKEN_REFRESHED_KEY = 'INSTAGRAM_TOKEN_REFRESHED_AT';
// Uzun süreli token 60 gün geçerli; 24 saatten eski olunca yenilenebilir. 30 günde bir yenilenir.
const REFRESH_EVERY_MS = 30 * 24 * 60 * 60 * 1000;

export interface InstagramStats {
  username: string | null;
  followers: number | null;
  posts: number | null;
  reach: number | null; // erişim (son 28 gün)
  views: number | null; // gösterim (son 28 gün)
  interactions: number | null; // etkileşim (son 28 gün)
  accountsEngaged: number | null; // etkileşime giren hesap (son 28 gün)
  updatedAt: string;
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);
  private cache: { at: number; data: InstagramStats | null } | null = null;

  constructor(private prisma: PrismaService) {}

  private configured(): boolean {
    return !!process.env.INSTAGRAM_ACCESS_TOKEN?.trim() && !!process.env.INSTAGRAM_USER_ID?.trim();
  }

  private async token(): Promise<string> {
    const row = await this.prisma.appConfig.findUnique({ where: { key: TOKEN_KEY } });
    return row?.value || (process.env.INSTAGRAM_ACCESS_TOKEN ?? '').trim();
  }

  private async getJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json() as Promise<T>;
  }

  // Sayfa her açılışta çağırır; Instagram'a en fazla saatte bir gidilir
  async stats(): Promise<InstagramStats | null> {
    if (!this.configured()) return null;
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.data;
    const data = await this.fetchStats().catch((err: Error) => {
      this.logger.warn(`Instagram istatistikleri alınamadı: ${err.message}`);
      return this.cache?.data ?? null; // hata olursa son bilinen veri
    });
    this.cache = { at: Date.now(), data };
    return data;
  }

  private async fetchStats(): Promise<InstagramStats> {
    const token = encodeURIComponent(await this.token());
    const userId = encodeURIComponent((process.env.INSTAGRAM_USER_ID ?? '').trim());
    const profile = await this.getJson<{ username?: string; followers_count?: number; media_count?: number }>(
      `${GRAPH}/${API_VERSION}/${userId}?fields=username,followers_count,media_count&access_token=${token}`,
    );
    // Hesap içgörüleri: son 28 gün toplamı. İçgörü izni yoksa profil verisi yine gösterilir.
    const insights: Record<string, number> = {};
    try {
      const until = Math.floor(Date.now() / 1000);
      const since = until - 28 * 24 * 60 * 60;
      const r = await this.getJson<{ data?: { name: string; total_value?: { value?: number } }[] }>(
        `${GRAPH}/${API_VERSION}/${userId}/insights?metric=reach,views,total_interactions,accounts_engaged&period=day&metric_type=total_value&since=${since}&until=${until}&access_token=${token}`,
      );
      for (const m of r.data ?? []) if (typeof m.total_value?.value === 'number') insights[m.name] = m.total_value.value;
    } catch (err) {
      this.logger.warn(`Instagram içgörüleri alınamadı: ${(err as Error).message}`);
    }
    return {
      username: profile.username ?? null,
      followers: profile.followers_count ?? null,
      posts: profile.media_count ?? null,
      reach: insights.reach ?? null,
      views: insights.views ?? null,
      interactions: insights.total_interactions ?? null,
      accountsEngaged: insights.accounts_engaged ?? null,
      updatedAt: new Date().toISOString(),
    };
  }

  // Uzun süreli token süresi dolmadan yenilenir: her gün 05:00 kontrol, son yenilemeden 30 gün geçtiyse yenile
  @Cron('0 5 * * *', { timeZone: 'Europe/Istanbul' })
  async refreshToken() {
    if (!this.configured()) return;
    const last = await this.prisma.appConfig.findUnique({ where: { key: TOKEN_REFRESHED_KEY } });
    if (last && Date.now() - new Date(last.value).getTime() < REFRESH_EVERY_MS) return;
    try {
      const current = encodeURIComponent(await this.token());
      const r = await this.getJson<{ access_token?: string; expires_in?: number }>(
        `${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${current}`,
      );
      if (!r.access_token) throw new Error('yanıtta access_token yok');
      const now = new Date().toISOString();
      await this.prisma.$transaction([
        this.prisma.appConfig.upsert({ where: { key: TOKEN_KEY }, create: { key: TOKEN_KEY, value: r.access_token }, update: { value: r.access_token } }),
        this.prisma.appConfig.upsert({ where: { key: TOKEN_REFRESHED_KEY }, create: { key: TOKEN_REFRESHED_KEY, value: now }, update: { value: now } }),
      ]);
      this.logger.log(`Instagram token yenilendi (geçerlilik ${Math.round((r.expires_in ?? 0) / 86400)} gün)`);
    } catch (err) {
      this.logger.warn(`Instagram token yenilenemedi: ${(err as Error).message}`);
    }
  }
}
