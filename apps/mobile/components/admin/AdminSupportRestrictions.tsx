// Kullanıcı / mekân detayı (mobil admin): "Canlı destek kısıtlamaları" (en yeni en üstte); web karşılığı components/AdminSupportRestrictions.tsx
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { ALabel, AT } from './AdminUi';
import { adm } from '@/theme/theme';
import { fmtDate } from '@/lib/screenshotAdmin';
import { restrictionPath, RESTRICTION_STATUS, lifterLabel, type SupportRestrictionRow } from '@/lib/supportRestrictions';

export function AdminSupportRestrictions(props: { userId: string } | { venueId: string }) {
  const path = restrictionPath(props);
  const [rows, setRows] = useState<SupportRestrictionRow[] | null>(null);
  useEffect(() => {
    setRows(null);
    api.get<SupportRestrictionRow[]>(path).then(setRows).catch(() => setRows([]));
  }, [path]);
  if (!rows) return null;
  return (
    <View style={{ gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: adm.border }}>
      <ALabel style={{ color: adm.muted }}>CANLI DESTEK KISITLAMALARI</ALabel>
      {rows.length === 0 && <AT style={{ fontSize: 11, color: adm.muted }}>Kısıtlama yok</AT>}
      {rows.map((r) => (
        <View key={r.id} style={{ gap: 2 }}>
          <AT style={{ fontSize: 11 }}>
            <AT style={{ fontSize: 11, color: adm.muted }}>{fmtDate(r.createdAt)}</AT> · {r.days} gün · bitiş <AT style={{ fontSize: 11, color: adm.muted }}>{fmtDate(r.expiresAt)}</AT> · <AT style={{ fontSize: 11, color: r.status === 'ACTIVE' ? adm.red : r.status === 'LIFTED' ? adm.green : adm.muted }}>{RESTRICTION_STATUS[r.status]}</AT> · Temsilci No {r.agentNo ?? '—'}
          </AT>
          <AT style={{ fontSize: 11, color: adm.muted }}>Sebep: <AT style={{ fontSize: 11 }}>{r.reason}</AT></AT>
          {r.status === 'LIFTED' && <AT style={{ fontSize: 11, color: adm.muted }}>Kaldıran: <AT style={{ fontSize: 11 }}>{lifterLabel(r)}</AT>{r.liftedAt ? ` · ${fmtDate(r.liftedAt)}` : ''}</AT>}
        </View>
      ))}
    </View>
  );
}
