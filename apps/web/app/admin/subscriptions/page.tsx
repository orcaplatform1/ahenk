'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BG, SURFACE, BORDER, TEXT, MUTED, RED, GREEN, AMBER, BLUE, SANS, MONO, LABEL } from '@/lib/adminTheme';
import { AdminSelect } from '@/components/AdminSelect';


const inputStyle: React.CSSProperties = {
  background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
  padding: '7px 12px', fontSize: 13, color: TEXT,
  outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
};

interface Subscription {
  id: string;
  plan: string;
  kankaRights?: number;
  kankaCycles?: number;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  startsAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  cancelNote: string | null;
  missedGroupCycles: number;
  missedOneonOneCycles: number;
  groupRights: number;
  groupCycles: number;
  oneOnOneCycles: number;
  updatedAt: string;
  user: { id: string; email: string; phone: string | null; profile: { firstName: string; lastName: string } | null };
  payment: { platform: string; amountKurus: number; paidAt: string | null } | null;
}

interface ListResponse { items: { user: Subscription['user']; subscriptions: Subscription[] }[]; total: number; page: number; totalPages: number; }

const TABS = [
  { key: 'ACTIVE',    label: 'Aktif' },
  { key: 'EXPIRED',   label: 'Süresi Dolan / Kullanılan' },
  { key: 'CANCELLED', label: 'İptal Edilen' },
] as const;

const PLAN_LABEL: Record<string, string> = { MASADA: 'Grup', KARSIMDA: 'Başbaşa', ICERDE: 'İçerde', KANKAMLA: 'Kankamla', PRIME_1M: 'Prime 1 Aylık', PRIME_3M: 'Prime 3 Aylık', PRIME_6M: 'Prime 6 Aylık', PRIME_12M: 'Prime 12 Aylık' };
const PLATFORM_LABEL: Record<string, string> = { WEB: 'Web', ANDROID: 'Android', IOS: 'iOS' };

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

// Kişi kartındaki tek abonelik: hak/döngü bilgisi ve kendi iptal butonu
function SubscriptionRow({ s, onCancel }: { s: Subscription; onCancel: () => void }) {
  const oneOnOneRight = s.plan === 'KARSIMDA' || s.plan === 'ICERDE' || s.plan.startsWith('PRIME_');
  return (
    <div style={{ padding: '8px 10px', borderRadius: 8, background: SURFACE, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>{PLAN_LABEL[s.plan] ?? s.plan}</p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO }}>
          Başlangıç {fmtDate(s.startsAt)}
          {s.expiresAt ? ` · Bitiş ${fmtDate(s.expiresAt)}` : ''}
          {s.plan === 'MASADA' || s.plan === 'ICERDE' || s.plan.startsWith('PRIME_') ? ` · Grup hakkı: ${s.groupRights}` : ''}
          {s.plan === 'KANKAMLA' || s.plan.startsWith('PRIME_') ? ` · Kankamla hakkı: ${s.kankaRights ?? 0}` : ''}
          {oneOnOneRight ? ` · Başbaşa hakkı: ${s.usedAt ? `kullanıldı (${fmtDate(s.usedAt)})` : 'kullanılmadı'}` : ''}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: MUTED }}>
          {s.payment
            ? `${PLATFORM_LABEL[s.payment.platform] ?? s.payment.platform} · ₺${(s.payment.amountKurus / 100).toFixed(2)}`
            : 'Ücretsiz (admin)'}
          {s.status === 'ACTIVE' && (s.missedGroupCycles > 0 || s.missedOneonOneCycles > 0)
            ? ` · Masa kurulamayan döngü: grup ${s.missedGroupCycles}, başbaşa ${s.missedOneonOneCycles}`
            : ''}
        </p>
        {s.status === 'CANCELLED' && (
          <p style={{ margin: '3px 0 0', fontSize: 11, color: AMBER }}>
            İptal: {fmtDate(s.updatedAt)}{s.cancelNote ? ` · ${s.cancelNote}` : ''}
          </p>
        )}
      </div>
      {s.status === 'ACTIVE' && (
        <button
          onClick={onCancel}
          style={{
            padding: '4px 10px', borderRadius: 6, cursor: 'pointer', flexShrink: 0,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            fontSize: 11, color: RED, fontFamily: SANS,
          }}
        >
          İptal Et
        </button>
      )}
      {s.status === 'EXPIRED' && <span style={{ ...LABEL, color: MUTED, flexShrink: 0 }}>SONA ERDİ</span>}
    </div>
  );
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
    const params = new URLSearchParams({ status: tab, page: String(page), limit: '25', group: 'user' });
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
    <div className="adm-page" style={{ maxWidth: 900, margin: '0 auto', fontFamily: SANS }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="ll-title">Abonelikler</h1>
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
        <div style={{ width: 160 }}>
          <AdminSelect
            value={plan}
            onChange={v => { setPlan(v); setPage(1); }}
            placeholder="Tüm paketler"
            title="Paket filtresi"
            options={[
              { value: '', label: 'Tüm paketler' }, { value: 'MASADA', label: 'Grup' }, { value: 'KARSIMDA', label: 'Başbaşa' },
              { value: 'ICERDE', label: 'İçerde' }, { value: 'KANKAMLA', label: 'Kankamla' },
            ]}
          />
        </div>
      </div>

      {error && <p style={{ margin: '0 0 12px', fontSize: 13, color: RED }}>{error}</p>}

      <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 className="ll-title">Abonelikler</h2>
          {data && <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>{data.total} kişi</span>}
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
            {items.map(({ user, subscriptions }, i) => (
              <div
                key={user.id}
                style={{ padding: '12px 18px', borderBottom: i < items.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none' }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                  {user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : user.email}
                </span>
                <p style={{ margin: '2px 0 8px', fontSize: 11, color: MUTED }}>
                  {[user.email, user.phone].filter(Boolean).join(' · ')}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {subscriptions.map(s => (
                    <span key={s.id} style={{ ...LABEL, padding: '1px 7px', borderRadius: 99, background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)' }}>
                      {PLAN_LABEL[s.plan] ?? s.plan}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {subscriptions.map(s => (
                    <SubscriptionRow key={s.id} s={s} onCancel={() => { setCancelling(s); setCancelNote(''); }} />
                  ))}
                </div>
              </div>
            ))}
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
          <div className="ll-card" style={{ width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 className="ll-title">Aboneliği İptal Et</h2>
              <button onClick={() => setCancelling(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: MUTED, padding: 4 }}>✕</button>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: MUTED }}>
              {cancelling.user.profile ? `${cancelling.user.profile.firstName} ${cancelling.user.profile.lastName}` : cancelling.user.email}
              {': '}{PLAN_LABEL[cancelling.plan]}. Bu işlem geri alınamaz.
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
                fontSize: 13, fontWeight: 700, color: RED, fontFamily: SANS, opacity: saving ? 0.5 : 1,
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
