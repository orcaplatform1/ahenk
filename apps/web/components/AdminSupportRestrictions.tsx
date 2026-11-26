'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BORDER, MUTED, TEXT, LABEL, MONO, GREEN, RED } from '@/lib/adminTheme';
import { fmtDate } from '@/lib/screenshotAdmin';
import { restrictionPath, RESTRICTION_STATUS, lifterLabel, type SupportRestrictionRow } from '@/lib/supportRestrictions';

// Kullanıcı / mekân detayı: "Canlı destek kısıtlamaları" (en yeni en üstte; kaldırma yalnız SUPERADMIN, Canlı Destek → Kısıtlamalar ekranından)
export function AdminSupportRestrictions(props: { userId: string } | { venueId: string }) {
  const path = restrictionPath(props);
  const [rows, setRows] = useState<SupportRestrictionRow[] | null>(null);
  useEffect(() => {
    setRows(null);
    api.get<SupportRestrictionRow[]>(path).then(setRows).catch(() => setRows([]));
  }, [path]);
  if (!rows) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
      <span style={{ ...LABEL, color: MUTED }}>CANLI DESTEK KISITLAMALARI</span>
      {rows.length === 0 && <p style={{ margin: 0, fontSize: 11, color: MUTED }}>Kısıtlama yok</p>}
      {rows.map((r) => {
        const st = RESTRICTION_STATUS[r.status];
        return (
          <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: TEXT }}>
            <p style={{ margin: 0 }}>
              <span style={{ fontFamily: MONO, color: MUTED }}>{fmtDate(r.createdAt)}</span> · {r.days} gün · bitiş <span style={{ fontFamily: MONO, color: MUTED }}>{fmtDate(r.expiresAt)}</span> · <span style={{ color: r.status === 'ACTIVE' ? RED : r.status === 'LIFTED' ? GREEN : MUTED }}>{st}</span> · Temsilci No {r.agentNo ?? '—'}
            </p>
            <p style={{ margin: 0, color: MUTED }}>Sebep: <span style={{ color: TEXT }}>{r.reason}</span></p>
            {r.status === 'LIFTED' && <p style={{ margin: 0, color: MUTED }}>Kaldıran: <span style={{ color: TEXT }}>{lifterLabel(r)}</span>{r.liftedAt ? <span style={{ fontFamily: MONO }}> · {fmtDate(r.liftedAt)}</span> : null}</p>}
          </div>
        );
      })}
    </div>
  );
}
