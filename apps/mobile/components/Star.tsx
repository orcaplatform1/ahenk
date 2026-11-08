// Değerlendir ekranı yıldızı (kırmızı geçişli dolu / boş). Değerlendir ekranı ve Geçmiş Masalarım değerlendirme alanı kullanır.
import React from 'react';
import Svg, { Defs, LinearGradient as SG, Path, Stop } from 'react-native-svg';

export function Star({ filled, size = 40 }: { filled: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs><SG id="st" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#c0392b" /><Stop offset="1" stopColor="#ff6b6b" /></SG></Defs>
      <Path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.45 6.2 20.5l1.1-6.47L2.6 9.45l6.5-.95L12 2.6z" fill={filled ? 'url(#st)' : 'rgba(255,255,255,0.04)'} stroke={filled ? 'none' : 'rgba(255,255,255,0.18)'} strokeWidth={1.2} strokeLinejoin="round" />
    </Svg>
  );
}
