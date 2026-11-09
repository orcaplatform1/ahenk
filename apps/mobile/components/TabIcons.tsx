// Alt menü ikonları. Profilim: DetayAvatar'ın 28 pt kopyası, animasyonsuz (S-08…S-11).
// Diğer sekmeler: ince çizgi ikonlar (S-26), web ikon çizgi kalınlığı 1.5 (Navbar ikonları).
import React from 'react';
import { Image, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { DetayAvatar } from './DetayAvatar';
import { mono, tabBadge, tabIcon } from '@/theme/theme';

// Sekme ikonunun sağ üstünde sayı rozeti; sayı 0 iken görünmez
export function TabBadge({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <View>
      {children}
      {count > 0 && (
        <LinearGradient colors={[...tabBadge.colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} accessibilityLabel={`${count}`}
          style={{ position: 'absolute', top: tabBadge.top, right: tabBadge.right, minWidth: tabBadge.size, height: tabBadge.size, borderRadius: tabBadge.size / 2, paddingHorizontal: tabBadge.padH, borderWidth: tabBadge.borderWidth, borderColor: tabBadge.border, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: mono(600), fontSize: tabBadge.fontSize, color: tabBadge.text, includeFontPadding: false }}>{count > 99 ? '99+' : count}</Text>
        </LinearGradient>
      )}
    </View>
  );
}

export function ProfileTabIcon({ initials, gender, focused }: { initials: string; gender?: string | null; focused: boolean }) {
  return (
    <View style={{ opacity: focused ? 1 : tabIcon.inactiveOpacity }}>
      <DetayAvatar participant={{ initials, gender }} size={tabIcon.size} animated={false} />
    </View>
  );
}

// Eşleşme Paneli / Masalarım / Bildirimler / Paketim: metal PNG ikon (kenar boşluğu kırpılmış, kare), renk boyama yok;
// aktif tam görünür, pasif tabIcon.inactiveOpacity (Profilim rozetiyle aynı)
const TAB_PNG = {
  radar: require('../assets/tabs/tarama.png'),
  table: require('../assets/tabs/masalarim.png'),
  bell: require('../assets/tabs/bildirimlerim.png'),
  package: require('../assets/tabs/paketlerim.png'),
} as const;
export function PngTabIcon({ name, focused }: { name: keyof typeof TAB_PNG; focused: boolean }) {
  return <Image source={TAB_PNG[name]} resizeMode="contain" style={{ width: tabIcon.size, height: tabIcon.size, opacity: focused ? 1 : tabIcon.inactiveOpacity }} />;
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
