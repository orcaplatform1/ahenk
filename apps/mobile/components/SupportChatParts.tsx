// Canlı Destek ortak parçaları: kullanıcı / mekân ekranı (app/canli-destek.tsx) ve temsilci ekranı (app/admin/canli-destek.tsx) aynı
// mesaj kutusunu, ikonları ve durum etiketini kullanır (web components/support/SupportChatScreen.tsx AttachIcon / EmojiIcon / SendIcon /
// AutoTextarea / StatusPill karşılığı). HIG: ikon butonları 44×44 pt dokunma alanı.
import { Pressable, TextInput, View, Text } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { btnGhost, c, sans } from '@/theme/theme';
import { upper } from '@/lib/i18n';

export const SUPPORT_EMOJIS = ['😀', '😂', '😊', '😍', '🥰', '😎', '🤔', '😅', '😉', '🙏', '👍', '👏', '🙌', '💪', '🎉', '❤️', '🔥', '✨', '☕', '😮', '😢', '👋', '🤝', '😇', '🤗'];

// Küçük ghost buton (Ahenk paleti: hap, ince çerçeve, nokta, harf aralıklı büyük yazı; yazı 9, iç boşluk 4 / 10): sohbet başlığındaki
// SONLANDIR ve Breakout "Oyunu kapat". HIG: hitSlop ile dokunma alanı ~44 pt
export function SmallGhostButton({ label, onPress, style }: { label: string; onPress: () => void; style?: { marginLeft?: 'auto' } }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
      style={({ pressed }) => ({ ...style, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: btnGhost.radius, borderWidth: 1, borderColor: btnGhost.border, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: pressed ? 'rgba(255,255,255,0.05)' : 'transparent' })}>
      <View style={{ width: btnGhost.dot, height: btnGhost.dot, borderRadius: btnGhost.dot / 2, backgroundColor: btnGhost.dotColor }} />
      <Text numberOfLines={1} style={{ fontSize: 9, lineHeight: 13.5, letterSpacing: 9 * btnGhost.letterSpacing, color: btnGhost.color, fontFamily: sans(500) }}>{upper(label)}</Text>
    </Pressable>
  );
}

const ICON = { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' } as const;
const LINE = 20; // yazı alanı satır yüksekliği; en fazla 5 satır büyür

// Durum etiketi: Çevrimiçi yeşil, Çevrimdışı gri, yazıyor Ahenk kırmızısı
const PILL = {
  online: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.45)' },
  offline: { color: '#a39c93', bg: 'rgba(163,156,147,0.12)', border: 'rgba(163,156,147,0.4)' },
  typing: { color: '#f4f1ec', bg: 'rgba(192,57,43,0.22)', border: 'rgba(192,57,43,0.6)' },
} as const;
export type PillStatus = keyof typeof PILL;
// small: üye / mekân sohbet başlığı (küçük boy ve iç boşluk)
export function StatusPill({ status, label, small = false }: { status: PillStatus; label: string; small?: boolean }) {
  const p = PILL[status];
  return (
    <View style={{ alignSelf: small ? 'center' : 'flex-start', paddingHorizontal: small ? 6 : 8, paddingVertical: small ? 1 : 2, borderRadius: 9999, borderWidth: 1, borderColor: p.border, backgroundColor: p.bg }}>
      <Text numberOfLines={1} style={{ fontSize: small ? 9 : 11, lineHeight: small ? 13 : 16, color: p.color, fontFamily: sans(600) }}>{label}</Text>
    </View>
  );
}

export function ChatComposer({ value, onChangeText, textColor, onAttach, onEmoji, onSend, sendDisabled, onFocus, labels, boxBg = 'rgba(255,255,255,0.04)', boxBorder = 'rgba(255,255,255,0.1)' }: {
  value: string; onChangeText: (v: string) => void; textColor: string;
  onAttach: () => void; onEmoji: () => void; onSend: () => void; sendDisabled: boolean; onFocus?: () => void;
  labels: { attach: string; emoji: string; send: string }; boxBg?: string; boxBorder?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: boxBorder, backgroundColor: boxBg, padding: 1 }}>
      <Pressable onPress={onAttach} accessibilityRole="button" accessibilityLabel={labels.attach} style={ICON}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c.red} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Rect x={3} y={3} width={18} height={18} rx={3} /><Circle cx={8.5} cy={8.5} r={1.5} /><Path d="m21 15-5-5L5 21" /></Svg>
      </Pressable>
      <Pressable onPress={onEmoji} accessibilityRole="button" accessibilityLabel={labels.emoji} style={ICON}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c.red} strokeWidth={1.8} strokeLinecap="round"><Circle cx={12} cy={12} r={9.5} /><Path d="M8 14.5s1.5 2 4 2 4-2 4-2" /><Path d="M9 9.5h.01M15 9.5h.01" strokeWidth={2.4} /></Svg>
      </Pressable>
      <TextInput value={value} onChangeText={onChangeText} multiline keyboardAppearance="dark" onFocus={onFocus}
        style={{ flex: 1, minWidth: 0, minHeight: 44, maxHeight: LINE * 5 + 24, paddingTop: 12, paddingBottom: 12, paddingHorizontal: 6, lineHeight: LINE, color: textColor, fontSize: 14, fontFamily: sans(400) }} />
      <Pressable onPress={onSend} disabled={sendDisabled} accessibilityRole="button" accessibilityLabel={labels.send} style={ICON}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.red, alignItems: 'center', justifyContent: 'center', opacity: sendDisabled ? 0.5 : 1 }}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M22 2 11 13" /><Path d="M22 2 15 22l-4-9-9-4 20-7z" /></Svg>
        </View>
      </Pressable>
    </View>
  );
}
