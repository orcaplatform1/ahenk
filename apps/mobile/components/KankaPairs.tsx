// packages/ui/src/components/tables/KankaPairs.tsx karşılığı
import { Pressable, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { DetayAvatar } from './DetayAvatar';
import { T } from './ui';
import i18n from '@/lib/i18n';

export interface KankaPerson { initials: string; gender?: string | null; isSelf?: boolean; photoUrl?: string | null; displayName?: string | null }
const OPPOSITE = (g?: string | null) => (g === 'FEMALE' ? 'MALE' : g === 'MALE' ? 'FEMALE' : null);

// onPhoto verilirse (masa detay kartı) onaylı profil fotoğrafı gösterilir ve basınca tam ekran açılır; diğer yerlerde fotoğraf gösterilmez
function Slot({ person, emptyGender, delay, onPhoto }: { person?: KankaPerson; emptyGender?: string | null; delay: number; onPhoto?: (p: KankaPerson) => void }) {
  const p = person ? { ...person, photoUrl: onPhoto ? person.photoUrl : null } : { initials: '?', gender: emptyGender };
  const av = <DetayAvatar participant={p} delay={delay} />;
  const slot = person?.photoUrl && onPhoto
    ? <Pressable onPress={() => onPhoto(person)} accessibilityRole="imagebutton" accessibilityLabel={i18n.t('masa.enlargePhoto')} hitSlop={4}>{av}</Pressable>
    : av;
  // Masa detay kartında görünen ad ("Ahmet Y."): çift yerleşimi yan yana olduğu için dairenin altında (web ile aynı)
  if (!onPhoto || !person?.displayName) return slot;
  return (
    <View style={{ alignItems: 'center', gap: 4, minWidth: 0 }}>
      {slot}
      <T w={600} numberOfLines={1} style={{ fontSize: 11, color: '#f4f1ec', maxWidth: 72 }}>{person.displayName}</T>
    </View>
  );
}

export function KankaPairs({ mine, other, onPhoto }: { mine: KankaPerson[]; other: KankaPerson[]; onPhoto?: (p: KankaPerson) => void }) {
  const left = [...mine].sort((a, b) => Number(!!b.isSelf) - Number(!!a.isSelf)).slice(0, 2);
  const right = other.slice(0, 2);
  const own = left[0]?.gender ?? null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Slot person={left[0]} emptyGender={own} delay={0.52} onPhoto={onPhoto} />
      <Slot person={left[1]} emptyGender={own} delay={0.62} onPhoto={onPhoto} />
      <Svg width={26} height={14} viewBox="0 0 26 14" fill="none" stroke="rgba(232,162,122,0.7)" strokeWidth={1.1} style={{ marginHorizontal: 2 }}>
        <Rect x={1} y={3} width={14} height={8} rx={4} />
        <Rect x={11} y={3} width={14} height={8} rx={4} />
      </Svg>
      <Slot person={right[0]} emptyGender={OPPOSITE(own)} delay={0.72} onPhoto={onPhoto} />
      <Slot person={right[1]} emptyGender={OPPOSITE(own)} delay={0.82} onPhoto={onPhoto} />
    </View>
  );
}
