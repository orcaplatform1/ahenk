import React from 'react';
import { ALabel } from './AdminUi';
import { adm } from '@/theme/theme';

// Admin durum etiketi (LABEL + hap): renk / zemin / kenar sayfa tablosundan
export function StatusPill({ text, color, bg, border, pad = [2, 7] }: { text: string; color?: string; bg?: string; border?: string; pad?: [number, number] }) {
  return <ALabel style={{ paddingVertical: pad[0], paddingHorizontal: pad[1], borderRadius: 99, overflow: 'hidden', borderWidth: 1, backgroundColor: bg ?? 'transparent', borderColor: border ?? adm.border, color: color ?? adm.muted }}>{text}</ALabel>;
}
