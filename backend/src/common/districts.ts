// Şehir → ilçe listesi. Web bu listeyi GET /auth/districts ile alır (tek kaynak).
export const DISTRICTS: Record<string, string[]> = {
  "İstanbul": ["Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beykoz", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", "Çekmeköy", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kadıköy", "Kağıthane", "Kartal", "Küçükçekmece", "Maltepe", "Pendik", "Sancaktepe", "Sarıyer", "Silivri", "Sultanbeyli", "Sultangazi", "Şile", "Şişli", "Tuzla", "Ümraniye", "Üsküdar", "Zeytinburnu"],
  "Ankara": ["Akyurt", "Altındağ", "Ayaş", "Bala", "Beypazarı", "Çamlıdere", "Çankaya", "Çubuk", "Elmadağ", "Etimesgut", "Evren", "Gölbaşı", "Güdül", "Haymana", "Kahramankazan", "Kalecik", "Keçiören", "Kızılcahamam", "Mamak", "Nallıhan", "Polatlı", "Pursaklar", "Sincan", "Şereflikoçhisar", "Yenimahalle"],
  "İzmir": ["Aliağa", "Balçova", "Bayındır", "Bayraklı", "Bergama", "Beydağ", "Bornova", "Buca", "Çeşme", "Çiğli", "Dikili", "Foça", "Gaziemir", "Güzelbahçe", "Karabağlar", "Karaburun", "Karşıyaka", "Kemalpaşa", "Kınık", "Kiraz", "Konak", "Menderes", "Menemen", "Narlıdere", "Ödemiş", "Seferihisar", "Selçuk", "Tire", "Torbalı", "Urla"],
  "Antalya": ["Akseki", "Aksu", "Alanya", "Demre", "Döşemealtı", "Elmalı", "Finike", "Gazipaşa", "Gündoğmuş", "İbradı", "Kaş", "Kemer", "Kepez", "Konyaaltı", "Korkuteli", "Kumluca", "Manavgat", "Muratpaşa", "Serik"],
  "Muğla": ["Bodrum", "Dalaman", "Datça", "Fethiye", "Kavaklıdere", "Köyceğiz", "Marmaris", "Menteşe", "Milas", "Ortaca", "Seydikemer", "Ula", "Yatağan"],
  "Aydın": ["Bozdoğan", "Buharkent", "Çine", "Didim", "Efeler", "Germencik", "İncirliova", "Karacasu", "Karpuzlu", "Koçarlı", "Köşk", "Kuşadası", "Kuyucak", "Nazilli", "Söke", "Sultanhisar", "Yenipazar"],
  "Balıkesir": ["Altıeylül", "Ayvalık", "Balya", "Bandırma", "Bigadiç", "Burhaniye", "Dursunbey", "Edremit", "Erdek", "Gömeç", "Gönen", "Havran", "İvrindi", "Karesi", "Kepsut", "Manyas", "Marmara", "Savaştepe", "Sındırgı", "Susurluk"],
};

const ANATOLIAN_SIDE = new Set(["Adalar", "Ataşehir", "Beykoz", "Çekmeköy", "Kadıköy", "Kartal", "Maltepe", "Pendik", "Sancaktepe", "Sultanbeyli", "Şile", "Tuzla", "Ümraniye", "Üsküdar"]);

// Başvurudaki "Balıkesir (Ayvalık-Akçay)" gibi adlar şehir adına indirilir
export function districtsOf(cityName: string): string[] | null {
  return DISTRICTS[cityName.split(" (")[0].trim()] ?? null;
}

// Sadece İstanbul için yaka bilgisi var
export function sideOf(cityName: string, district: string | null | undefined): "AVRUPA" | "ANADOLU" | null {
  if (cityName !== "İstanbul" || !district) return null;
  return ANATOLIAN_SIDE.has(district) ? "ANADOLU" : "AVRUPA";
}

export function isValidDistrict(cityName: string, district: string): boolean {
  const list = districtsOf(cityName);
  return list ? list.includes(district) : district.trim().length > 0;
}

export type DensityRow = { name: string; level: 1 | 2 | 3 | 4 };

// Seviye sırasıyla ilçeler (1: en yoğun, 4: en düşük)
const densityList = (...levels: [string[], string[], string[], string[]]): DensityRow[] =>
  levels.flatMap((names, i) => names.map((name) => ({ name, level: (i + 1) as DensityRow["level"] })));

// Sonar ve ısı haritasının sabit ilçe listeleri. Listede olmayan kayıt ilçeleri eşleşmeye girer, burada gösterilmez/sayılmaz.
export const CITY_DENSITY: Record<string, DensityRow[]> = {
  "İstanbul": densityList(
    ["Beşiktaş", "Şişli", "Kadıköy", "Üsküdar"],
    ["Bakırköy", "Sarıyer", "Ataşehir", "Maltepe", "Ümraniye"],
    ["Başakşehir", "Kartal"],
    ["Beylikdüzü", "Avcılar", "Pendik", "Beykoz"],
  ),
  "Ankara": densityList(["Çankaya", "Yenimahalle"], ["Etimesgut", "Gölbaşı"], ["Altındağ", "Keçiören"], ["Mamak", "Polatlı"]),
  "İzmir": densityList(
    ["Karşıyaka", "Buca", "Bornova"],
    ["Konak", "Gaziemir"],
    ["Bayraklı", "Karabağlar", "Çiğli"],
    ["Güzelbahçe", "Urla", "Çeşme"],
  ),
  "Antalya": densityList(["Muratpaşa", "Konyaaltı", "Kepez"], ["Döşemealtı", "Aksu"], ["Serik", "Kemer"], ["Manavgat", "Alanya"]),
};

export function densityListOf(cityName: string): DensityRow[] | null {
  return CITY_DENSITY[cityName.split(" (")[0].trim()] ?? null;
}
