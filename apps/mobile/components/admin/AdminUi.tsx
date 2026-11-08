// Yönetim Paneli ortak parçaları (web mobil görünümü): .adm-page, .admin-shell .ll-card, .ll-title, mobil .adm-table (satır = kart)
import React from 'react';
import { Pressable, ScrollView, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { adm, fonts, llCard, llTitle, mono, sans } from '@/theme/theme';

export function AT({ style, w = 400, children, numberOfLines, onPress }: { style?: StyleProp<TextStyle>; w?: 400 | 500 | 600 | 700 | 800; children: React.ReactNode; numberOfLines?: number; onPress?: () => void }) {
  return <Text onPress={onPress} numberOfLines={numberOfLines} style={[{ fontFamily: sans(w), color: adm.text }, style]}>{children}</Text>;
}
export function AMono({ style, w = 400, children }: { style?: StyleProp<TextStyle>; w?: 400 | 500 | 600; children: React.ReactNode }) {
  return <Text style={[{ fontFamily: mono(w), color: adm.muted }, style]}>{children}</Text>;
}
export function ALabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[adm.label, { color: adm.muted }, style]}>{children}</Text>;
}
export function ATitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  // Mobil: .adm-topbar-title .ll-title 18px; sayfa başlığı .ll-title 23px
  return <Text style={[{ fontFamily: fonts.serif, fontSize: llTitle.size, lineHeight: llTitle.size * llTitle.lineHeight, color: adm.text }, style]}>{children}</Text>;
}
export function ACard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ borderRadius: llCard.radius, borderWidth: 1, borderColor: adm.border, backgroundColor: adm.card, padding: llCard.padding }, style]}>{children}</View>;
}
export function APage({ children, maxWidth }: { children: React.ReactNode; maxWidth?: number }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: adm.bg }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentContainerStyle={{ padding: adm.pagePad, maxWidth, width: '100%', alignSelf: 'center', paddingBottom: 48 }}>
      {children}
    </ScrollView>
  );
}
export function AError({ children }: { children?: string }) {
  if (!children) return null;
  return <AT style={{ fontSize: 13, color: adm.red, marginBottom: 16 }}>{children}</AT>;
}
// Mobil .adm-table: thead gizli; her satır blok, td[data-label] → "ETİKET .... değer" (etiket mono 11 #64748b, değer sağa yaslı, dolgu 4/14)
export function ATableRow({ cells, onPress, last }: { cells: [string, React.ReactNode][]; onPress?: () => void; last?: boolean }) {
  const Row = (
    <View style={{ paddingVertical: 8, borderBottomWidth: last ? 0 : 1, borderBottomColor: adm.border }}>
      {cells.map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 4, paddingHorizontal: 14 }}>
          <Text style={adm.tableLabel}>{k}</Text>
          <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>{typeof v === 'string' || typeof v === 'number' ? <AT style={{ fontSize: 12, textAlign: 'right' }}>{v}</AT> : v}</View>
        </View>
      ))}
    </View>
  );
  if (!onPress) return Row;
  return <Pressable onPress={onPress} accessibilityRole="button">{Row}</Pressable>;
}
export function ATable({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: adm.surface, borderWidth: 1, borderColor: adm.border, borderRadius: 12, overflow: 'hidden' }}>{children}</View>;
}

// Web grid (≤640 px kuralı: repeat(2|3|4, …) → repeat(2, minmax(0, 1fr))): eşit genişlikte sütunlar, satır arası ve sütun arası gap
export function AGrid({ columns = 2, gap, children, style }: { columns?: number; gap: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const [w, setW] = React.useState(0);
  const colW = w ? (w - gap * (columns - 1)) / columns : 0;
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, style]}>
      {React.Children.map(children, c => (c == null || c === false ? null : <View style={{ width: colW || `${100 / columns - 2}%` }}>{c}</View>))}
    </View>
  );
}
