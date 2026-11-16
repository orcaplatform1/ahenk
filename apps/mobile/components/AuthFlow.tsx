// Mobil giriş akışının ortak parçaları: tam ekran arka plan, sol üst geri ok, yasal metin, tam genişlikte yuvarlak butonlar.
// Renkler Ahenk paletinden (theme). HIG: güvenli alan, en az 44 pt dokunma alanı.
import React, { useEffect, useState } from 'react';
import { Image, Pressable, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { openLegal } from '@/lib/links';
import { T } from './ui';
import { ll, tw } from '@/theme/theme';
import { useTranslation } from 'react-i18next';

// Dönüşümlü giriş arka planları: giriş ve "Tekrar hoş geldin" ekranı her açıldığında sıradaki görsel
// (1 → 2 → 3 → 1 …). En son gösterilen sıra cihazda (AsyncStorage) saklanır; uygulama kapatılıp açılınca kaldığı yerden sürer.
export const AUTH_BACKGROUNDS = [
  require('@/assets/mobilappscreen.webp'),
  require('@/assets/mobilappscreen2.webp'),
  require('@/assets/mobilappscreen3.webp'),
];
const AUTH_BG_KEY = 'ahenk_auth_bg_index';
let lastShownBg: number | null = null;

// Ekran açılışında (bileşen bağlanınca) bir kez sıradaki görselin sırasını verir; okuma bitene kadar null (arka plan siyah)
export function useAuthBackgroundIndex(): number | null {
  const [index, setIndex] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      let last = lastShownBg;
      if (last === null) {
        const saved = await AsyncStorage.getItem(AUTH_BG_KEY).catch(() => null);
        const n = Number(saved);
        last = saved !== null && Number.isInteger(n) && n >= 0 && n < AUTH_BACKGROUNDS.length ? n : AUTH_BACKGROUNDS.length - 1;
      }
      const next = (last + 1) % AUTH_BACKGROUNDS.length;
      lastShownBg = next;
      AsyncStorage.setItem(AUTH_BG_KEY, String(next)).catch(() => {});
      if (alive) setIndex(next);
    })();
    return () => { alive = false; };
  }, []);
  return index;
}

// Giriş ekranı (Telefon / E-posta / Kayıt Ol) ve "Tekrar hoş geldin" ekranı katmanları: fotoğrafın üstünde, içeriğin altında; sıra karartma → üst gradyan → alt gradyan.
// AUTH_BACKGROUNDS sırasıyla: mobilappscreen.webp FOTO-4, mobilappscreen2.webp FOTO-ÇİFT, mobilappscreen3.webp FOTO-6.
// top / bottomFrom: ekran yüksekliğine oran; gradyanlar 3 duraklı, orta durak uç opaklığın %60'ı.
const AUTH_OVERLAYS = [
  { dim: 0.20, top: 0.32, topStart: 0.85, bottomFrom: 0.48, bottomEnd: 0.97 }, // FOTO-4
  { dim: 0.10, top: 0.30, topStart: 0.90, bottomFrom: 0.55, bottomEnd: 0.95 }, // FOTO-ÇİFT
  { dim: 0.20, top: 0.28, topStart: 0.85, bottomFrom: 0.50, bottomEnd: 0.95 }, // FOTO-6
];
const black = (a: number) => `rgba(0,0,0,${a})`;

// Tam ekran arka plan: görseli içeren alan tam olarak ekran genişliği ve yüksekliği kadar; ekstra büyütme / ölçekleme yok,
// "cover" modunda, ortalı, esnetilmeden (oran farkında kenarlardan kırpılır). Üç görsel de aynı şekilde yerleşir.
// overlay: giriş ve "Tekrar hoş geldin" ekranlarında; değerler gösterilen fotoğrafla birlikte değişir (fotoğraf geçişinde animasyon yok)
export function AuthBackground({ index, overlay }: { index: number | null; overlay?: boolean }) {
  const { width, height } = useWindowDimensions();
  const o = overlay && index !== null ? AUTH_OVERLAYS[index] : null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden', backgroundColor: '#000000' }}>
      {index !== null && <Image source={AUTH_BACKGROUNDS[index]} resizeMode="cover" style={{ width, height }} accessibilityIgnoresInvertColors />}
      {o && (
        <>
          <View style={{ position: 'absolute', top: 0, left: 0, width, height, backgroundColor: black(o.dim) }} />
          <LinearGradient colors={[black(o.topStart), black(o.topStart * 0.6), black(0)]} locations={[0, 0.5, 1]}
            style={{ position: 'absolute', top: 0, left: 0, width, height: height * o.top }} />
          <LinearGradient colors={[black(0), black(o.bottomEnd * 0.6), black(o.bottomEnd)]} locations={[0, 0.5, 1]}
            style={{ position: 'absolute', top: height * o.bottomFrom, left: 0, width, height: height * (1 - o.bottomFrom) }} />
        </>
      )}
    </View>
  );
}

// Giriş ekranı başlığı: güvenli alanın 24 px altında, ortalı "AHENK" (web header ile aynı: Inter 600, harf aralığı 0.12em);
// başlık olarak yalnız AHENK (alt açıklama yok). Konum üç fotoğrafta aynı.
export function AuthHeading() {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 24, left: 24, right: 24, alignItems: 'center' }}>
      <T w={600} style={{ fontSize: 36, lineHeight: 44, letterSpacing: 36 * 0.12, color: '#FFFFFF', textAlign: 'center' }}>AHENK</T>
    </View>
  );
}

export function BackArrow({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8}
      style={{ position: 'absolute', top: insets.top + 6, left: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={ll.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 18l-6-6 6-6" />
      </Svg>
    </Pressable>
  );
}

// "Devam ederek Kullanım Koşulları'nı kabul edersin. ..." — sayfa adları mevcut yasal sayfalara bağlı (uygulama içi tarayıcı)
export function LegalNote() {
  const { t } = useTranslation();
  const link = (label: string, path: string) => (
    <T style={{ fontSize: 12, lineHeight: 18, color: ll.text, textDecorationLine: 'underline' }} onPress={() => openLegal(path)} accessibilityRole="link">{label}</T>
  );
  return (
    <T style={{ fontSize: 12, lineHeight: 18, color: ll.text2, textAlign: 'center' }}>
      {t('login.legal1')}{link(t('login.legalTerms'), '/kullanim-kosullari')}{t('login.legal2')}{link(t('login.legalPrivacy'), '/gizlilik-politikasi')}{t('login.legal3')}{link(t('login.legalCookies'), '/cerez-politikasi')}{t('login.legal4')}
    </T>
  );
}

export function PhoneIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={6} y={2} width={12} height={20} rx={2.5} /><Path d="M11 18h2" />
    </Svg>
  );
}

export function MailIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={5} width={18} height={14} rx={2} /><Path d="M3 7l9 6 9-6" />
    </Svg>
  );
}

// Tam genişlikte, yuvarlak köşeli buton. primary: palet kırmızısı dolgu; diğerleri koyu yarı saydam dolgu + ince çerçeve
export function PillButton({ label, onPress, icon, primary, disabled }: { label: string; onPress: () => void; icon?: (color: string) => React.ReactNode; primary?: boolean; disabled?: boolean }) {
  const color = primary ? '#ffffff' : ll.text;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        width: '100%', minHeight: 52, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20,
        backgroundColor: primary ? (pressed ? tw.primaryHover : tw.primary) : pressed ? 'rgba(20,20,20,0.85)' : 'rgba(10,10,10,0.7)',
        borderWidth: primary ? 0 : 1, borderColor: 'rgba(255,255,255,0.18)', opacity: disabled ? 0.5 : 1,
      })}>
      {icon?.(color)}
      <T w={600} style={{ fontSize: 15, color }}>{label}</T>
    </Pressable>
  );
}

// Alt adım ekranı çerçevesi (Numaranı alabilir miyiz? / E-postan nedir? / Şifreni gir / kod): geri ok, başlık, içerik, altta buton
export function StepScreen({ title, subtitle, onBack, children, footer }: { title: string; subtitle?: string; onBack: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top + 64, paddingBottom: insets.bottom + 16, paddingHorizontal: 24 }}>
      <BackArrow onPress={onBack} />
      <View style={{ flex: 1 }}>
        <T w={700} style={{ fontSize: 26, lineHeight: 32, color: ll.text, marginBottom: subtitle ? 8 : 24 }}>{title}</T>
        {!!subtitle && <T style={{ fontSize: 13, lineHeight: 19, color: ll.label, marginBottom: 24 }}>{subtitle}</T>}
        {children}
      </View>
      <View style={{ gap: 12 }}>{footer}</View>
    </View>
  );
}
