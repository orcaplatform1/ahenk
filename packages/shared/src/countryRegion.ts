// Ülke kodu → bölge alanları (City.timezone, City.currency, City.phoneCountryCode). Tek kaynak: admin Yeni Şehir / şehir düzenleme
// (web + mobil admin/cities) ve Bölgeler formlarında ülke seçilince bu alanlar otomatik dolar, sonra elle değiştirilebilir.
// Listede olmayan ülke seçilince alanlar değişmez.
export interface CountryRegion { timezone: string; currency: string; phoneCountryCode: string }

export const COUNTRY_REGION: Record<string, CountryRegion> = {
  TR: { timezone: "Europe/Istanbul", currency: "TRY", phoneCountryCode: "+90" },
  AE: { timezone: "Asia/Dubai", currency: "AED", phoneCountryCode: "+971" },
  TH: { timezone: "Asia/Bangkok", currency: "THB", phoneCountryCode: "+66" },
  HK: { timezone: "Asia/Hong_Kong", currency: "HKD", phoneCountryCode: "+852" },
  SG: { timezone: "Asia/Singapore", currency: "SGD", phoneCountryCode: "+65" },
  JP: { timezone: "Asia/Tokyo", currency: "JPY", phoneCountryCode: "+81" },
};

// Admin para birimi seçenekleri (USD mevcut kayıtlar için durur)
export const REGION_CURRENCIES = ["TRY", "USD", "AED", "THB", "HKD", "SGD", "JPY"] as const;

export const countryRegion = (countryCode: string): CountryRegion | null => COUNTRY_REGION[countryCode] ?? null;
