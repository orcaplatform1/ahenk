// Mobil giriş akışının ortak parçaları: tam ekran arka plan, sol üst geri ok, yasal metin, tam genişlikte yuvarlak butonlar.
// Renkler Ahenk paletinden (theme). HIG: güvenli alan, en az 44 pt dokunma alanı.
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { openLegal } from '@/lib/links';
import { T } from './ui';
import { ll, tw } from '@/theme/theme';

// Tam ekran arka plan: ekranı tamamen kaplar, oran farkında kenarlardan kırpılır (esnetilmez), ortadan hizalı
export function AuthBackground() {
  return <Image source={require('@/assets/mobilappscreen.webp')} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />;
}

export function BackArrow({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Geri" hitSlop={8}
      style={{ position: 'absolute', top: insets.top + 6, left: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={ll.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 18l-6-6 6-6" />
      </Svg>
    </Pressable>
  );
}

// "Devam ederek Kullanım Koşulları'nı kabul edersin. ..." — sayfa adları mevcut yasal sayfalara bağlı (uygulama içi tarayıcı)
export function LegalNote() {
  const link = (label: string, path: string) => (
    <T style={{ fontSize: 12, lineHeight: 18, color: ll.text, textDecorationLine: 'underline' }} onPress={() => openLegal(path)} accessibilityRole="link">{label}</T>
  );
  return (
    <T style={{ fontSize: 12, lineHeight: 18, color: ll.text2, textAlign: 'center' }}>
      Devam ederek {link('Kullanım Koşulları', '/kullanim-kosullari')}'nı kabul edersin. Verilerini nasıl işlediğimizi öğrenmek için {link('Gizlilik Politikası', '/gizlilik-politikasi')} ve {link('Çerez Politikası', '/cerez-politikasi')}'nı inceleyebilirsin.
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
