// Şehir listesi gösterimi: sezon (gün + ay, yıl yok) ve ülke bayrağı (ISO 3166-1 alpha-2 koddan emoji; Türkiye'de bayrak yok).
// TR "(15 Mayıs-15 Eylül)", EN "(May 15-September 15)"; ay adları arayüz dilinde. Web ve mobil şehir listeleri aynı fonksiyonu kullanır.
import { flagEmoji, formatNamed, type Lang } from "./i18n";

export interface CitySeasonFields {
  seasonStartDay?: number | null;
  seasonStartMonth?: number | null;
  seasonEndDay?: number | null;
  seasonEndMonth?: number | null;
  country?: string | null;
}

export const monthName = (month: number, lang: Lang) => formatNamed(new Date(Date.UTC(2024, month - 1, 15, 12)), lang, { month: "long" }, "UTC");

export function citySeason(c: CitySeasonFields, lang: Lang): string {
  const { seasonStartDay: sd, seasonStartMonth: sm, seasonEndDay: ed, seasonEndMonth: em } = c;
  if (!sd || !sm || !ed || !em) return "";
  return lang === "en"
    ? `(${monthName(sm, lang)} ${sd}-${monthName(em, lang)} ${ed})`
    : `(${sd} ${monthName(sm, lang)}-${ed} ${monthName(em, lang)})`;
}

export function cityFlag(c: CitySeasonFields): string {
  return c.country && c.country !== "TR" ? flagEmoji(c.country) : "";
}

// Şehir adının sağındaki ek: bayrak (TR dışı) ve sezon; ikisi de boşsa ""
export function cityExtras(c: CitySeasonFields, lang: Lang): string {
  return [cityFlag(c), citySeason(c, lang)].filter(Boolean).join(" ");
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
