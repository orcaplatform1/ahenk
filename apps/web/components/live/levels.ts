// İlçe yoğunluk seviyeleri: sonar baloncukları, lejant ve ısı haritası bu tanımı kullanır
// label: çeviri anahtarı (t(label))
export const LEVELS = {
  1: { label: 'common.levelVeryBusy', color: '#ff3b30', r: 9, band: 50, opacity: 1 },
  2: { label: 'common.levelBusy', color: '#ff8c42', r: 7, band: 86, opacity: 0.92 },
  3: { label: 'common.levelMedium', color: '#f2c14e', r: 5.5, band: 118, opacity: 0.8 },
  4: { label: 'common.levelLow', color: '#8a8178', r: 4, band: 136, opacity: 0.6 },
} as const;
