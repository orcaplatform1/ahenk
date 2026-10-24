'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const BG     = '#020c1b';
const SURFACE = '#0a1628';
const CARD   = '#0d1f3c';
const BORDER = '#1a3a5c';
const TEXT   = '#e2e8f0';
const MUTED  = '#64748b';
const GREEN  = '#22c55e';
const RED    = '#ef4444';
const AMBER  = '#f59e0b';
const CYAN   = '#22d3ee';
const BLUE   = '#3b82f6';
const SANS   = 'Inter, system-ui, sans-serif';
const MONO   = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

const inputStyle: React.CSSProperties = {
  background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
  padding: '7px 12px', fontSize: 12, color: TEXT,
  outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
};

interface Subscription {
  id: string;
  plan: 'MASADA' | 'KARSIMDA' | 'ICERDE';
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  startsAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  cancelNote: string | null;
  missedGroupCycles: number;
  missedOneonOneCycles: number;
  updatedAt: string;
  user: { id: string; email: string; phone: string | null; profile: { firstName: string; lastName: string } | null };
  payment: { platform: string; amountKurus: number; paidAt: string | null } | null;
}

interface ListResponse { items: Subscription[]; total: number; page: number; totalPages: number; }

const TABS = [
  { key: 'ACTIVE',    label: 'Aktif' },
  { key: 'EXPIRED',   label: 'Süresi Dolan / Kullanılan' },
  { key: 'CANCELLED', label: 'İptal Edilen' },
] as const;

const PLAN_LABEL: Record<string, string> = { MASADA: 'Masada', KARSIMDA: 'Karşımda', ICERDE: 'İçerde' };
const PLATFORM_LABEL: Record<string, string> = { WEB: 'Web', ANDROID: 'Android', IOS: 'iOS' };

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export default function AdminSubscriptions() {
  const [tab, setTab] = useState<typeof TABS[number]['key']>('ACTIVE');
  const [plan, setPlan] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState<Subscription | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError('');
    const params = new URLSearchParams({ status: tab, page: String(page), limit: '25' });
    if (plan) params.set('plan', plan);
    if (query) params.set('search', query);
    api.get<ListResponse>(`/admin/subscriptions?${params}`)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tab, plan, query, page]);

  useEffect(() => { load(); }, [load]);

  async function confirmCancel() {
    if (!cancelling) return;
    setSaving(true); setError('');
    try {
      await api.patch(`/admin/subscriptions/${cancelling.id}/cancel`, cancelNote.trim() ? { cancelNote: cancelNote.trim() } : {});
      setCancelling(null); setCancelNote('');
      load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  const items = data?.items ?? [];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', fontFamily: SANS }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>Abonelikler</h1>
      </div>

      {/* Sekmeler */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); }}
            style={{
              padding: '5px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: SANS,
              background: tab === t.key ? 'rgba(59,130,246,0.15)' : 'transparent',
              border: `1px solid ${tab === t.key ? 'rgba(59,130,246,0.35)' : BORDER}`,
              color: tab === t.key ? BLUE : MUTED,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtreler */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setQuery(search.trim()); setPage(1); } }}
          placeholder="Ad, e-posta veya telefon… (Enter)"
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
        />
        <select value={plan} onChange={e => { setPlan(e.target.value); setPage(1); }} style={{ ...inputStyle, background: SURFACE }}>
          <option value="">Tüm paketler</option>
          <option value="MASADA">Masada</option>
          <option value="KARSIMDA">Karşımda</option>
          <option value="ICERDE">İçerde</option>
        </select>
      </div>

      {error && <p style={{ margin: '0 0 12px', fontSize: 12, color: RED }}>{error}</p>}

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 2, height: 12, borderRadius: 1, background: CYAN }} />
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: CYAN }}>ABONELİKLER</span>
          {data && <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>{data.total} kayıt</span>}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ height: 52, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />)}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>Kayıt yok</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((s, i) => {
              const name = s.user.profile ? `${s.user.profile.firstName} ${s.user.profile.lastName}` : s.user.email;
              const oneOnOneRight = s.plan === 'KARSIMDA' || s.plan === 'ICERDE';
              return (
                <div
                  key={s.id}
                  style={{
                    padding: '12px 18px',
                    borderBottom: i < items.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none',
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{name}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', padding: '1px 7px', borderRadius: 99,
                        background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)',
                      }}>
                        {PLAN_LABEL[s.plan] ?? s.plan}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 10, color: MUTED }}>
                      {[s.user.email, s.user.phone].filter(Boolean).join(' · ')}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>
                      Başlangıç {fmtDate(s.startsAt)}
                      {s.expiresAt ? ` · Bitiş ${fmtDate(s.expiresAt)}` : ''}
                      {oneOnOneRight ? ` · Başbaşa hakkı: ${s.usedAt ? `kullanıldı (${fmtDate(s.usedAt)})` : 'kullanılmadı'}` : ''}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 10, color: MUTED }}>
                      {s.payment
                        ? `${PLATFORM_LABEL[s.payment.platform] ?? s.payment.platform} · ₺${(s.payment.amountKurus / 100).toFixed(2)}`
                        : 'Ücretsiz (admin)'}
                      {s.status === 'ACTIVE' && (s.missedGroupCycles > 0 || s.missedOneonOneCycles > 0)
                        ? ` · Masa kurulamayan döngü: grup ${s.missedGroupCycles}, başbaşa ${s.missedOneonOneCycles}`
                        : ''}
                    </p>
                    {s.status === 'CANCELLED' && (
                      <p style={{ margin: '3px 0 0', fontSize: 10, color: AMBER }}>
                        İptal: {fmtDate(s.updatedAt)}{s.cancelNote ? ` · ${s.cancelNote}` : ''}
                      </p>
                    )}
                  </div>
                  {s.status === 'ACTIVE' && (
                    <button
                      onClick={() => { setCancelling(s); setCancelNote(''); }}
                      style={{
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer', flexShrink: 0,
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        fontSize: 10, color: RED, fontFamily: SANS,
                      }}
                    >
                      İptal Et
                    </button>
                  )}
                  {s.status === 'EXPIRED' && (
                    <span style={{ fontSize: 9, fontWeight: 800, color: MUTED, flexShrink: 0 }}>SONA ERDİ</span>
                  )}
                  {s.status === 'ACTIVE' && (s.missedGroupCycles >= 4 || s.missedOneonOneCycles >= 4) && (
                    <span style={{ fontSize: 9, fontWeight: 800, color: GREEN, flexShrink: 0 }}>İADE HAKKI</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sayfalama */}
      {data && data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ ...inputStyle, cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}
          >
            ‹
          </button>
          <span style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>{page} / {data.totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
            style={{ ...inputStyle, cursor: page >= data.totalPages ? 'not-allowed' : 'pointer', opacity: page >= data.totalPages ? 0.4 : 1 }}
          >
            ›
          </button>
        </div>
      )}

      {/* İptal onayı */}
      {cancelling && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>Aboneliği İptal Et</h2>
              <button onClick={() => setCancelling(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: MUTED, padding: 4 }}>✕</button>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: MUTED }}>
              {cancelling.user.profile ? `${cancelling.user.profile.firstName} ${cancelling.user.profile.lastName}` : cancelling.user.email}
              {' — '}{PLAN_LABEL[cancelling.plan]}. Bu işlem geri alınamaz.
            </p>
            <textarea
              value={cancelNote}
              onChange={e => setCancelNote(e.target.value)}
              placeholder="İptal notu (opsiyonel)"
              rows={3}
              style={{ ...inputStyle, width: '100%', resize: 'vertical', marginBottom: 12 }}
            />
            <button
              onClick={confirmCancel}
              disabled={saving}
              style={{
                width: '100%', padding: '9px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                fontSize: 12, fontWeight: 700, color: RED, fontFamily: SANS, opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? 'İptal ediliyor…' : 'İptal Et'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
