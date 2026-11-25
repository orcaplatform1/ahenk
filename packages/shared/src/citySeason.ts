// Şehir listesi gösterimi (web + mobil, kayıt ve Profilim şehir listeleri aynı fonksiyonları kullanır):
// - Yakında şehirler iki grupta: countryCode TR olanlar ("Sezon Masaları 🇹🇷") ve TR olmayanlar ("Sezon Masaları 🌐"); grup içinde
//   sortOrder (yoksa gelen sıra) ile sıralanır.
// - Sezon: parantezsiz, TR "1 Haziran >< 15 Eylül", EN "June 1 >< September 15"; ay adları arayüz dilinde.
// - Bayrak: countryCode TR değilse ülke kodundan emoji.
import { flagEmoji, formatNamed, type Lang } from "./i18n";

export interface CitySeasonFields {
  seasonStartDay?: number | null;
  seasonStartMonth?: number | null;
  seasonEndDay?: number | null;
  seasonEndMonth?: number | null;
  countryCode?: string | null;
  sortOrder?: number | null;
}

export const monthName = (month: number, lang: Lang) => formatNamed(new Date(Date.UTC(2024, month - 1, 15, 12)), lang, { month: "long" }, "UTC");

export function citySeason(c: CitySeasonFields, lang: Lang): string {
  const { seasonStartDay: sd, seasonStartMonth: sm, seasonEndDay: ed, seasonEndMonth: em } = c;
  if (!sd || !sm || !ed || !em) return "";
  return lang === "en"
    ? `${monthName(sm, lang)} ${sd} >< ${monthName(em, lang)} ${ed}`
    : `${sd} ${monthName(sm, lang)} >< ${ed} ${monthName(em, lang)}`;
}

export function cityFlag(c: CitySeasonFields): string {
  return c.countryCode && c.countryCode !== "TR" ? flagEmoji(c.countryCode) : "";
}

// Şehir adının sağındaki ekler: bayrak (TR dışı) ve sezon metni; yoksa boş metin
export function cityExtras(c: CitySeasonFields, lang: Lang): { flag: string; season: string } {
  return { flag: cityFlag(c), season: citySeason(c, lang) };
}

// Yakında şehirleri iki gruba ayırır: tr (countryCode TR) ve intl (TR dışı); grup içinde sortOrder'a göre (eşitse gelen sıra)
export function soonCityGroups<T extends CitySeasonFields>(soon: T[]): { tr: T[]; intl: T[] } {
  const sorted = soon.map((c, i) => ({ c, i })).sort((a, b) => (a.c.sortOrder ?? 0) - (b.c.sortOrder ?? 0) || a.i - b.i).map((x) => x.c);
  return { tr: sorted.filter((c) => (c.countryCode ?? "TR") === "TR"), intl: sorted.filter((c) => (c.countryCode ?? "TR") !== "TR") };
}

// Admin "Ülke" seçimi: ISO 3166-1 alpha-2 kodları
export const ISO_COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI " +
  "CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ " +
  "GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS " +
  "LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG " +
  "PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK " +
  "TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");
