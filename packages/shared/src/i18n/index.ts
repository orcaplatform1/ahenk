// Ahenk çeviri altyapısı — web (next-intl) ve mobil (i18next) aynı anahtarları kullanır: tr.json + en.json tek kaynak.
// Metinlerde değişken {ad} biçimindedir (iki kütüphanede de aynı). Admin ve mekân paneli Türkçe kalır, çevrilmez.
import { parsePhoneNumberFromString, isValidPhoneNumber, type CountryCode } from "libphonenumber-js/mobile";
import { COUNTRIES, type Country } from "./countries";

export { COUNTRIES };

// İngilizce seçeneği bu bayrakla açılır; false iken her durumda Türkçe (dil seçici ve Dil satırı gizli)
export const ENGLISH_ENABLED: boolean = true;

export type Lang = "tr" | "en";
export const LANGS: Lang[] = ["tr", "en"];
export const isLang = (v: unknown): v is Lang => v === "tr" || v === "en";

// Dil belirleme sırası: 1) giriş yapmış kullanıcının hesabındaki dil, 2) cihazda / tarayıcıda kayıtlı seçim,
// 3) cihaz / tarayıcı dili Türkçe ise Türkçe, değilse English. ENGLISH_ENABLED = false iken her durumda Türkçe.
export function resolveLanguage(opts: { account?: string | null; stored?: string | null; device?: string | null }): Lang {
  if (!ENGLISH_ENABLED) return "tr";
  if (isLang(opts.account)) return opts.account;
  if (isLang(opts.stored)) return opts.stored;
  const d = (opts.device ?? "").toLowerCase();
  return d.startsWith("tr") ? "tr" : "en";
}

// Web: o anki arayüz dili <html lang>'tan (kök layout locale'i yazar); tarayıcı dışında tr. API isteklerinde Accept-Language.
export function documentLang(): Lang {
  const doc = (globalThis as { document?: { documentElement?: { lang?: string } } }).document;
  return doc?.documentElement?.lang === "en" ? "en" : "tr";
}

// Yasal sayfa adresi: İngilizce sayfalar /en önekli (web: next-intl "as-needed")
export function localizedPath(path: string, lang: Lang): string {
  if (lang !== "en") return path;
  return path === "/" ? "/en" : `/en${path.startsWith("/") ? path : `/${path}`}`;
}

// ─── Tarih / saat ────────────────────────────────────────────────────────────
// Bütün tarih ve saatler buluşmanın yapıldığı bölgenin saat diliminde. Sayısal biçim iki dilde de gg.aa.yyyy ve 24 saat SS:dd;
// ay ve gün adları arayüz dilinde.
const DEFAULT_TIMEZONE = "Europe/Istanbul";
const intlLocale = (lang: Lang) => (lang === "en" ? "en-GB" : "tr-TR");

function parts(date: Date | string | number, timeZone: string) {
  const d = date instanceof Date ? date : new Date(date);
  const p = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { d, day: get("day"), month: get("month"), year: get("year"), hour: get("hour") === "24" ? "00" : get("hour"), minute: get("minute") };
}

// gg.aa.yyyy
export function formatDate(date: Date | string | number | null | undefined, timeZone: string = DEFAULT_TIMEZONE): string {
  if (date === null || date === undefined) return "—";
  const p = parts(date, timeZone);
  if (Number.isNaN(p.d.getTime())) return "—";
  return `${p.day}.${p.month}.${p.year}`;
}

// SS:dd (24 saat)
export function formatTime(date: Date | string | number | null | undefined, timeZone: string = DEFAULT_TIMEZONE): string {
  if (date === null || date === undefined) return "—";
  const p = parts(date, timeZone);
  if (Number.isNaN(p.d.getTime())) return "—";
  return `${p.hour}:${p.minute}`;
}

// gg.aa.yyyy SS:dd
export function formatDateTime(date: Date | string | number | null | undefined, timeZone: string = DEFAULT_TIMEZONE): string {
  if (date === null || date === undefined) return "—";
  return `${formatDate(date, timeZone)} ${formatTime(date, timeZone)}`;
}

// Ay / gün adlı biçimler (ör. "15 Kasım Cuma", "Friday 15 November"): adlar arayüz dilinde, saat bölgenin saat diliminde
export function formatNamed(date: Date | string | number, lang: Lang, options: Intl.DateTimeFormatOptions, timeZone: string = DEFAULT_TIMEZONE): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(intlLocale(lang), { ...options, ...(options.hour ? { hourCycle: "h23" as const } : {}), timeZone });
}

// Masa detay kartı tarih satırı (gg.aa.yyyy kuralının istisnası): TR "18 Kasım, Çarşamba 20:00", EN "Wednesday, 18 November 20:00"
export function formatCardDate(date: Date | string | number, lang: Lang, timeZone: string = DEFAULT_TIMEZONE): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const dm = d.toLocaleDateString(intlLocale(lang), { day: "numeric", month: "long", timeZone });
  const wd = d.toLocaleDateString(intlLocale(lang), { weekday: "long", timeZone });
  const time = formatTime(d, timeZone);
  return lang === "en" ? `${wd}, ${dm} ${time}` : `${dm}, ${wd} ${time}`;
}

// Geçmiş Masalarım masa detay kartı tarih satırı (tarih kartın başlığında): yalnız gün adı ve saat, TR "Çarşamba 20:00", EN "Wednesday 20:00"
export function formatWeekdayTime(date: Date | string | number, lang: Lang, timeZone: string = DEFAULT_TIMEZONE): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString(intlLocale(lang), { weekday: "long", timeZone })} ${formatTime(d, timeZone)}`;
}

// Masalarım tarih sekmesi: TR "18 Kasım Çarşamba", EN "Wednesday, 18 November"
export function formatDayTab(date: Date | string | number, lang: Lang, timeZone: string = DEFAULT_TIMEZONE): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const dm = d.toLocaleDateString(intlLocale(lang), { day: "numeric", month: "long", timeZone });
  const wd = d.toLocaleDateString(intlLocale(lang), { weekday: "long", timeZone });
  return lang === "en" ? `${wd}, ${dm}` : `${dm} ${wd}`;
}

// Gün + ay adı: TR "19 Kasım", EN "19 November"
export function formatDayMonth(date: Date | string | number, lang: Lang, timeZone: string = DEFAULT_TIMEZONE): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(intlLocale(lang), { day: "numeric", month: "long", timeZone });
}

// Değerlendirmenin açıldığı an: buluşma günü 23:59'dan sonra, ertesi gün 00:00 (TR, UTC+3) — backend meeting-windows reviewWindow ile aynı
export function reviewOpensAt(scheduledAt: Date | string | number): Date {
  const tr = new Date(new Date(scheduledAt).getTime() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() + 1, 0 - 3, 0, 0, 0));
}

// Değerlendirme açılıştan tam 7 gün sonra kapanır (backend REVIEW_WINDOW_MS)
export const REVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export function reviewClosesAt(scheduledAt: Date | string | number): Date {
  return new Date(reviewOpensAt(scheduledAt).getTime() + REVIEW_WINDOW_MS);
}

// Gün adı (0 = Pazar) arayüz dilinde
export function weekdayName(day: number, lang: Lang): string {
  const base = new Date(Date.UTC(2024, 0, 7 + day, 12)); // 7 Ocak 2024 Pazar
  return base.toLocaleDateString(intlLocale(lang), { weekday: "long", timeZone: "UTC" });
}

// ─── Kişisel davet linki ─────────────────────────────────────────────────────
// Arayüz diline göre: TR https://ahenk.co/davet/X (önek yok), EN https://ahenk.co/en/davet/X (web /en öneki)
export function localizedInviteLink(link: string, lang: Lang): string {
  if (lang !== "en") return link;
  const m = link.match(/^(https?:\/\/[^/]+)(\/.*)?$/);
  if (!m || (m[2] ?? "").startsWith("/en/")) return link;
  return `${m[1]}/en${m[2] ?? ""}`;
}

// ─── Telefon (E.164) ─────────────────────────────────────────────────────────
export const DEFAULT_PHONE_COUNTRY = "TR";

export function flagEmoji(code: string): string {
  return code.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
}

export function countryByCode(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES.find((c) => c.code === DEFAULT_PHONE_COUNTRY)!;
}

export function countryName(c: Country, lang: Lang): string {
  return lang === "en" ? c.en : c.tr;
}

// Seçilen ülkeye göre (libphonenumber-js, yalnız mobil numaralar — WhatsApp) doğrulanmış E.164 numara; geçersizse null
export function toE164(countryCode: string, national: string): string | null {
  const digits = national.replace(/[^\d+]/g, "");
  if (!digits) return null;
  const parsed = parsePhoneNumberFromString(digits, countryCode as CountryCode);
  if (!parsed || !isValidPhoneNumber(parsed.number)) return null;
  return parsed.number;
}

// E.164 numarayı ülke + ulusal kısma ayırır (telefon alanını önceden doldurmak için)
export function splitE164(e164: string | null | undefined): { country: string; national: string } {
  const parsed = e164 ? parsePhoneNumberFromString(e164) : undefined;
  if (!parsed?.country) return { country: DEFAULT_PHONE_COUNTRY, national: (e164 ?? "").replace(/^\+90/, "") };
  // Ortak listede olmayan ülke → varsayılan +90 Türkiye
  if (!COUNTRIES.some((c) => c.code === parsed.country)) return { country: DEFAULT_PHONE_COUNTRY, national: parsed.nationalNumber };
  return { country: parsed.country, national: parsed.nationalNumber };
}

// Ülke listesini ada / koda göre ara (seçili dilde ad); sıra COUNTRIES sırasıdır (alfabetik sıralama yok)
export function searchCountries(query: string, lang: Lang): Country[] {
  const q = query.trim().toLocaleLowerCase(lang === "en" ? "en" : "tr");
  const list = COUNTRIES;
  if (!q) return list;
  const qd = q.replace(/^\+/, "");
  return list.filter((c) => countryName(c, lang).toLocaleLowerCase(lang === "en" ? "en" : "tr").includes(q) || c.code.toLowerCase() === q || c.dial.slice(1).startsWith(qd));
}

// ─── KYC belge türleri (kimlik doğrulama; iyzico kimlik türünden ayrı) ─────────
// Seçilebilenler bu sırayla; bölge ayarı (City.idTypes) filtreler. Pasaport'ta yalnız fotoğraflı sayfa, diğerlerinde ön + arka yüz
export type KycDocType = "ID_CARD" | "DRIVER_LICENSE" | "PASSPORT" | "RESIDENCE_PERMIT";
export const KYC_DOC_TYPES: KycDocType[] = ["ID_CARD", "DRIVER_LICENSE", "PASSPORT", "RESIDENCE_PERMIT"];

// ─── Kimlik türleri ──────────────────────────────────────────────────────────
export type IdType = "TC" | "YKN" | "PASSPORT";
export const ID_TYPES: IdType[] = ["TC", "YKN", "PASSPORT"];

// iyzico satın alımındaki kimlik numarası (numara saklanmaz, yalnız iyzico'ya iletilir). TC: mevcut kural (11 hane rakam)
const isValidTckn = (v: string) => /^\d{11}$/.test(v);
const isValidYkn = (v: string) => /^99\d{9}$/.test(v);
const isValidPassportNo = (v: string) => /^[A-Za-z0-9]{6,9}$/.test(v);
export function isValidIdNumber(type: IdType, v: string): boolean {
  return type === "TC" ? isValidTckn(v) : type === "YKN" ? isValidYkn(v) : isValidPassportNo(v);
}

// ─── Meslek alanları ─────────────────────────────────────────────────────────
// Veritabanında Türkçe değer saklanır (eşleştirme bunu karşılaştırır); ekranda çeviri anahtarı "occ.<anahtar>" ile gösterilir
const OCCUPATION_KEYS: Record<string, string> = {
  "Teknoloji & Yazılım": "tech", "Finans & Bankacılık": "finance", "Sağlık & Tıp": "health", "Hukuk": "law",
  "Eğitim & Akademi": "education", "Mühendislik": "engineering", "Pazarlama & Reklam": "marketing", "Medya & İletişim": "media",
  "Sanat & Tasarım": "art", "Girişimcilik & İş Dünyası": "business", "Kamu & Devlet": "public", "Turizm & Hizmet": "tourism",
  "Öğrenci": "student", "Diğer": "other",
};
// Çeviri fonksiyonuyla meslek adı (bilinmeyen değer olduğu gibi)
export function occupationLabel(value: string | null | undefined, t: (key: string) => string): string {
  if (!value) return "";
  const k = OCCUPATION_KEYS[value];
  return k ? t(`occ.${k}`) : value;
}
