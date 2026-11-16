// Alt menü ikonları. Profilim: ortadaki büyük yuvarlak buton (ProfileCenterButton).
// Diğer sekmeler: ince çizgi ikonlar (S-26), web ikon çizgi kalınlığı 1.5 (Navbar ikonları).
import React, { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, Text, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

// Sekme butonuna alt menünün verdiği özellikler (yalnız kullanılanlar)
type TabButtonProps = { onPress?: ((e: GestureResponderEvent) => void) | null; onLongPress?: ((e: GestureResponderEvent) => void) | null; accessibilityState?: { selected?: boolean }; style?: StyleProp<ViewStyle> };
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { sans, tabBadge, tabBar, tabCenter, tabIcon, tabPill } from '@/theme/theme';
import { smallPhotoUrl } from '@/lib/photo';
import { gBg, initialsLabel } from '@/lib/masa';
import i18n from '@/lib/i18n';

// Bildirimler ikonunun sağ üstünde rozet: count > 0 → sayı (99'dan büyükse "99+"); count 0 ve dot → 8×8 nokta; ikisi de yoksa görünmez
export function TabBadge({ count, dot, children }: { count: number; dot?: boolean; children: React.ReactNode }) {
  const b = tabBadge;
  const label = count > 99 ? '99+' : String(count);
  return (
    <View>
      {children}
      {count > 0 ? (
        <View accessibilityLabel={label} style={{ position: 'absolute', top: b.top, right: b.right, minWidth: b.size + b.ringWidth * 2, height: b.size + b.ringWidth * 2,
          borderRadius: b.size / 2 + b.ringWidth, borderWidth: b.ringWidth, borderColor: b.ring, backgroundColor: b.bg, paddingHorizontal: label.length > 1 ? b.padH : 0,
          alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: sans(700), fontSize: b.fontSize, color: b.text, includeFontPadding: false, textAlignVertical: 'center' }}>{label}</Text>
        </View>
      ) : dot ? (
        <View style={{ position: 'absolute', top: b.top + (b.size - b.dot) / 2, right: b.right + (b.size - b.dot) / 2, width: b.dot, height: b.dot, borderRadius: b.dot / 2, backgroundColor: b.bg }} />
      ) : null}
    </View>
  );
}

// Seçili sekmede ikonun arkasında hap zemin (Profil sekmesi hariç); seçilince 150 ms'de belirir
export function TabPill({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  const p = tabPill;
  const op = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    if (focused) Animated.timing(op, { toValue: 1, duration: p.fadeMs, useNativeDriver: true }).start();
    else { op.stopAnimation(); op.setValue(0); }
  }, [focused, op, p.fadeMs]);
  return (
    <View style={{ width: tabIcon.size, height: tabIcon.size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: (tabIcon.size - p.w) / 2, top: (tabIcon.size - p.h) / 2, width: p.w, height: p.h, borderRadius: p.r, backgroundColor: p.bg, opacity: op }} />
      {children}
    </View>
  );
}

// Eşleşme Paneli / Masalarım / Bildirimler / Paketim: tek renk PNG ikon (kenar boşluğu kırpılmış, kare);
// aktif/pasif sekme rengi tintColor ile (tabBar.active / tabBar.inactive)
const TAB_PNG = {
  ahenk: require('../assets/tabs/ahenk.webp'),
  calendar: require('../assets/tabs/takvim.webp'),
  radar: require('../assets/tabs/tarama.webp'),
  table: require('../assets/tabs/masalarim.webp'),
  bell: require('../assets/tabs/bildirimlerim.webp'),
  package: require('../assets/tabs/paketlerim.webp'),
} as const;
export function PngTabIcon({ name, color }: { name: keyof typeof TAB_PNG; color: string }) {
  return <Image source={TAB_PNG[name]} resizeMode="contain" style={{ width: tabIcon.size, height: tabIcon.size, tintColor: color }} />;
}

const SW = 1.5;
export function LineIcon({ name, color, size = tabIcon.line }: { name: 'radar' | 'table' | 'bell' | 'package'; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {name === 'radar' && (<>
        <Circle cx={12} cy={12} r={9} />
        <Circle cx={12} cy={12} r={5} />
        <Path d="M12 12 L18.4 5.6" />
        <Circle cx={12} cy={12} r={1} />
      </>)}
      {name === 'table' && (<>
        <Circle cx={12} cy={12} r={4.5} />
        <Circle cx={12} cy={3.5} r={1.5} />
        <Circle cx={12} cy={20.5} r={1.5} />
        <Circle cx={4} cy={8} r={1.5} />
        <Circle cx={20} cy={8} r={1.5} />
        <Circle cx={4} cy={16} r={1.5} />
        <Circle cx={20} cy={16} r={1.5} />
      </>)}
      {name === 'bell' && (<>
        <Path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15L6 16z" />
        <Path d="M10 20.5a2 2 0 004 0" />
      </>)}
      {name === 'package' && (<>
        <Rect x={3.5} y={7.5} width={17} height={13} rx={2} />
        <Path d="M3.5 11.5h17M12 7.5v13M8.5 7.5c-2-3 1.5-5 3.5-1.5C14 2.5 17.5 4.5 15.5 7.5" />
      </>)}
    </Svg>
  );
}

// Üye alt menüsünün ortasındaki Profil butonu (Getir orta butonu gibi): sekme hücresi diğer 4 sekmeyle aynı genişlikte kalır (eşit
// dağılım bozulmaz); daire hücrenin üstünden tabCenter.rise kadar yukarı taşar. Avatar fotoğrafı daireyi doldurur; fotoğraf yoksa
// cinsiyet zemini üzerinde baş harfler. HIG: dokunma alanı 64 pt, sekme rolü ve seçili durumu erişilebilirlikte bildirilir.
export function ProfileCenterButton({ props, initials, gender, photoUrl }: { props: TabButtonProps; initials: string; gender?: string | null; photoUrl?: string | null }) {
  const c = tabCenter;
  const selected = !!props.accessibilityState?.selected;
  const inner = c.d - c.ring * 2;
  const photo = inner - c.frame * 2;
  return (
    <View style={[props.style, { flex: 1, alignItems: 'center' }]} pointerEvents="box-none">
      <Pressable onPress={props.onPress ?? undefined} onLongPress={props.onLongPress ?? undefined} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel="Profilim"
        style={{ position: 'absolute', top: -c.rise, width: c.d, height: c.d, borderRadius: c.d / 2, borderWidth: c.ring, borderColor: tabBar.bg, backgroundColor: tabBar.bg,
          shadowColor: '#000', shadowOpacity: c.shadowOpacity, shadowRadius: c.shadowRadius, shadowOffset: { width: 0, height: c.shadowY }, elevation: c.elevation }}>
        <View style={{ width: inner, height: inner, borderRadius: inner / 2, borderWidth: c.frame, borderColor: selected ? c.frameOn : c.frameOff, overflow: 'hidden', backgroundColor: gBg(gender), alignItems: 'center', justifyContent: 'center' }}>
          {photoUrl
            ? <Image source={{ uri: smallPhotoUrl(photoUrl) }} accessibilityLabel={i18n.t('photo.alt')} style={{ width: photo, height: photo, borderRadius: photo / 2 }} />
            : <Text numberOfLines={1} style={{ fontFamily: sans(700), fontSize: 15, color: '#FFFFFF' }}>{initialsLabel(initials)}</Text>}
        </View>
      </Pressable>
    </View>
  );
}
