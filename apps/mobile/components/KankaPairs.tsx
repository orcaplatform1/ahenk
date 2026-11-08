// packages/ui/src/components/tables/KankaPairs.tsx karşılığı
import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { DetayAvatar } from './DetayAvatar';

export interface KankaPerson { initials: string; gender?: string | null; isSelf?: boolean }
const OPPOSITE = (g?: string | null) => (g === 'FEMALE' ? 'MALE' : g === 'MALE' ? 'FEMALE' : null);

function Slot({ person, emptyGender, delay }: { person?: KankaPerson; emptyGender?: string | null; delay: number }) {
  return <DetayAvatar participant={person ?? { initials: '?', gender: emptyGender }} delay={delay} />;
}

export function KankaPairs({ mine, other }: { mine: KankaPerson[]; other: KankaPerson[] }) {
  const left = [...mine].sort((a, b) => Number(!!b.isSelf) - Number(!!a.isSelf)).slice(0, 2);
  const right = other.slice(0, 2);
  const own = left[0]?.gender ?? null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Slot person={left[0]} emptyGender={own} delay={0.52} />
      <Slot person={left[1]} emptyGender={own} delay={0.62} />
      <Svg width={26} height={14} viewBox="0 0 26 14" fill="none" stroke="rgba(232,162,122,0.7)" strokeWidth={1.1} style={{ marginHorizontal: 2 }}>
        <Rect x={1} y={3} width={14} height={8} rx={4} />
        <Rect x={11} y={3} width={14} height={8} rx={4} />
      </Svg>
      <Slot person={right[0]} emptyGender={OPPOSITE(own)} delay={0.72} />
      <Slot person={right[1]} emptyGender={OPPOSITE(own)} delay={0.82} />
    </View>
  );
}
