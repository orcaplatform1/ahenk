// İlçe yoğunluk seviyeleri: sonar baloncukları, lejant ve ısı haritası bu tanımı kullanır
export const LEVELS = {
  1: { label: 'Çok yoğun', color: '#ff3b30', r: 9, band: 50, opacity: 1, start: 45 },
  2: { label: 'Yoğun', color: '#ff8c42', r: 7, band: 86, opacity: 0.92, start: 0 },
  3: { label: 'Orta', color: '#f2c14e', r: 5.5, band: 118, opacity: 0.8, start: 90 },
  4: { label: 'Düşük', color: '#8a8178', r: 4, band: 136, opacity: 0.6, start: 25 },
} as const;
