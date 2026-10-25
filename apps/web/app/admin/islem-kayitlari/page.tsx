'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const BG      = '#020c1b';
const CARD    = '#0d1f3c';
const BORDER  = '#1a3a5c';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const RED     = '#ef4444';
const SANS    = 'Inter, system-ui, sans-serif';
const MONO    = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

interface AdminRef { id: string; profile: { firstName: string; lastName: string } | null }
interface LogItem { id: string; action: string; description: string; createdAt: string; admin: AdminRef }
interface LogResponse { items: LogItem[]; total: number; page: number; totalPages: number; admins: AdminRef[] }

const nameOf = (a: AdminRef) => (a.profile ? `${a.profile.firstName} ${a.profile.lastName}` : 'Admin');
const fmt = (d: string) => new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const input: React.CSSProperties = {
  background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 10px',
  fontSize: 12, color: TEXT, outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
};

// ADMIN rolündekilerin veri değiştiren işlemleri (SUPERADMIN işlemleri kaydedilmez) — sadece SUPERADMIN görür
export default function IslemKayitlari() {
  const [data, setData] = useState<LogResponse | null>(null);
  const [error, setError] = useState('');
  const [adminId, setAdminId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (adminId) params.set('adminId', adminId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (q.trim()) params.set('q', q.trim());
    api.get<LogResponse>(`/admin/action-logs?${params}`)
      .then((d) => { setData(d); setError(''); })
      .catch((e: Error) => setError(`Kayıtlar yüklenemedi: ${e.message}`));
  }, [adminId, from, to, q, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto', fontFamily: SANS }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: TEXT }}>İşlem Kayıtları</h1>
      <p style={{ margin: '0 0 20px', fontSize: 12, color: MUTED }}>Adminlerin yaptığı veri değiştiren işlemler. Kayıtlar silinemez ve değiştirilemez.</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <select value={adminId} onChange={(e) => { setAdminId(e.target.value); setPage(1); }} style={{ ...input, minWidth: 160 }}>
          <option value="">Tüm adminler</option>
          {data?.admins.map((a) => <option key={a.id} value={a.id}>{nameOf(a)}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} style={input} aria-label="Başlangıç tarihi" />
        <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} style={input} aria-label="Bitiş tarihi" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Açıklamada ara…" style={{ ...input, flex: 1, minWidth: 160 }} />
      </div>

      {error && <p style={{ margin: '0 0 12px', fontSize: 12, color: RED }}>{error}</p>}

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
        {!data ? (
          <p style={{ margin: 0, padding: 16, fontSize: 12, color: MUTED }}>Yükleniyor…</p>
        ) : data.items.length === 0 ? (
          <p style={{ margin: 0, padding: 16, fontSize: 12, color: MUTED }}>Kayıt yok</p>
        ) : data.items.map((l, i) => (
          <div key={l.id} style={{ padding: '12px 16px', borderTop: i ? `1px solid ${BORDER}` : 'none', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, color: MUTED, fontFamily: MONO, minWidth: 170 }}>{fmt(l.createdAt)}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT, minWidth: 120 }}>{nameOf(l.admin)}</span>
            <span style={{ fontSize: 12, color: TEXT, flex: 1, minWidth: 220 }}>{l.description}</span>
          </div>
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '6px 16px', borderRadius: 99, background: 'transparent', border: `1px solid ${BORDER}`, fontSize: 11, color: MUTED, cursor: 'pointer', opacity: page === 1 ? 0.3 : 1 }}>← Önceki</button>
          <span style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>{page} / {data.totalPages} · {data.total} kayıt</span>
          <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
            style={{ padding: '6px 16px', borderRadius: 99, background: 'transparent', border: `1px solid ${BORDER}`, fontSize: 11, color: MUTED, cursor: 'pointer', opacity: page === data.totalPages ? 0.3 : 1 }}>Sonraki →</button>
        </div>
      )}
    </div>
  );
}
