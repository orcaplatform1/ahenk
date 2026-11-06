'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { myRole } from '@/lib/adminRole';
import { BORDER, TEXT, MUTED, RED, GREEN, AMBER, SANS, MONO } from '@/lib/adminTheme';

interface DeletionRequest {
  id: string; userId: string; userName: string; status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string; decidedAt: string | null;
  retainedIdentity?: { firstName: string | null; lastName: string | null; email: string; phone: string | null } | null;
}

const STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Bekliyor', color: AMBER },
  APPROVED: { label: 'Onaylandı', color: GREEN },
  REJECTED: { label: 'Reddedildi', color: RED },
};
const when = (d: string) => new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' });

// Kullanıcılar → Silme Talepleri: ADMIN ve SUPERADMIN görür, sadece SUPERADMIN karar verir
export function AdminDeletionRequests() {
  const [rows, setRows] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const isSuper = myRole() === 'SUPERADMIN';

  function load() {
    api.get<DeletionRequest[]>('/admin/deletion-requests')
      .then((r) => { setRows(r); setError(''); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function decide(id: string, status: 'APPROVED' | 'REJECTED') {
    if (status === 'APPROVED' && !window.confirm('Hesap kalıcı olarak silinecek. Bu işlem geri alınamaz.')) return;
    setBusy(id); setError('');
    try {
      await api.patch(`/admin/deletion-requests/${id}`, { status });
      load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }

  return (
    <div className="ll-card" style={{ padding: 0, overflow: 'hidden', fontFamily: SANS }}>
      {error && <p style={{ margin: 0, padding: '12px 18px', fontSize: 13, color: RED }}>{error}</p>}
      {loading ? (
        <p style={{ margin: 0, padding: 20, fontSize: 13, color: MUTED }}>Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p style={{ margin: 0, padding: '40px 20px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: MUTED }}>Silme talebi yok.</p>
      ) : rows.map((r, i) => (
        <div key={r.id} style={{ padding: '14px 18px', borderTop: i ? `1px solid ${BORDER}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>{r.userName}</p>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO }}>{when(r.createdAt)}{r.decidedAt ? ` → ${when(r.decidedAt)}` : ''}</p>
            {r.retainedIdentity && (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: AMBER }}>
                Saklanan kimlik: {r.retainedIdentity.firstName} {r.retainedIdentity.lastName} · {r.retainedIdentity.email} · {r.retainedIdentity.phone ?? '—'}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: STATUS[r.status].color }}>{STATUS[r.status].label}</span>
            {r.status === 'PENDING' && isSuper && (
              <>
                <button disabled={busy === r.id} onClick={() => decide(r.id, 'APPROVED')} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: SANS, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: GREEN, cursor: 'pointer' }}>Onayla</button>
                <button disabled={busy === r.id} onClick={() => decide(r.id, 'REJECTED')} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: SANS, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: RED, cursor: 'pointer' }}>Reddet</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
