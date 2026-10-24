'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { myRole } from '@/lib/adminRole';

const SURFACE = '#0a1628';
const BORDER  = '#1a3a5c';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const RED     = '#ef4444';
const AMBER   = '#f59e0b';
const SANS    = 'Inter, system-ui, sans-serif';

interface Sanction {
  id: string;
  type: 'WARNING' | 'SUSPENSION' | 'BAN';
  reason: string;
  expiresAt: string | null;
  liftedAt: string | null;
  createdAt: string;
  admin: { profile: { firstName: string | null; lastName: string | null } | null } | null;
}

const TYPE_LABEL: Record<Sanction['type'], { label: string; color: string }> = {
  WARNING:    { label: 'Uyarı', color: AMBER },
  SUSPENSION: { label: 'Askı',  color: RED },
  BAN:        { label: 'Ban',   color: RED },
};

function fmt(d: string) {
  return new Date(d).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Askı/ban: kaldırılmamış ve süresi dolmamış; uyarı: kaldırılmamış
function isActive(s: Sanction) {
  if (s.liftedAt) return false;
  return s.type === 'WARNING' || !s.expiresAt || new Date(s.expiresAt) > new Date();
}

// Admin kullanıcı penceresi: tüm uyarı/askı/ban kayıtları; kaldırma yalnızca SUPERADMIN
export function AdminSanctionHistory({ userId, canAct, onChanged }: {
  userId: string;
  canAct: boolean;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<Sanction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lifting, setLifting] = useState<string | null>(null);
  const isSuperadmin = myRole() === 'SUPERADMIN';

  const load = useCallback(() => {
    api.get<Sanction[]>(`/admin/users/${userId}/sanctions`)
      .then(d => { setItems(d); setError(''); })
      .catch((e: Error) => setError(`Yaptırım geçmişi yüklenemedi: ${e.message}`))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function lift(id: string) {
    if (!confirm('Bu yaptırım kaldırılsın mı?')) return;
    setLifting(id);
    setError('');
    try {
      await api.delete(`/admin/users/${userId}/sanction/${id}`);
      load();
      onChanged();
    } catch (e) {
      setError(`Kaldırılamadı: ${(e as Error).message}`);
    } finally {
      setLifting(null);
    }
  }

  return (
    <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>
        YAPTIRIM GEÇMİŞİ{!loading ? ` (${items.length})` : ''}
      </span>
      {error && <p style={{ margin: 0, fontSize: 11, color: RED }}>{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p style={{ margin: 0, fontSize: 11, color: MUTED }}>Kayıt yok.</p>
      )}
      {items.map(s => {
        const t = TYPE_LABEL[s.type];
        const active = isActive(s);
        const by = s.admin?.profile ? `${s.admin.profile.firstName ?? ''} ${s.admin.profile.lastName ?? ''}`.trim() : '—';
        return (
          <div key={s.id} style={{ padding: '8px 10px', borderRadius: 8, background: SURFACE, border: `1px solid ${active ? 'rgba(239,68,68,0.3)' : BORDER}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: t.color }}>
                {t.label}{active ? ' · AKTİF' : s.liftedAt ? ' · KALDIRILDI' : ' · SÜRESİ DOLDU'}
              </span>
              {active && isSuperadmin && canAct && (
                <button
                  onClick={() => lift(s.id)} disabled={!!lifting}
                  style={{
                    padding: '2px 10px', borderRadius: 6, cursor: lifting ? 'not-allowed' : 'pointer',
                    background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)',
                    fontSize: 10, fontWeight: 600, fontFamily: SANS, opacity: lifting ? 0.5 : 1,
                  }}
                >
                  {lifting === s.id ? '…' : 'Kaldır'}
                </button>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 11, color: TEXT, lineHeight: 1.5 }}>{s.reason}</p>
            <p style={{ margin: 0, fontSize: 10, color: MUTED }}>
              {fmt(s.createdAt)}
              {s.expiresAt ? ` → ${fmt(s.expiresAt)}` : s.type === 'BAN' ? ' → süresiz' : ''}
              {s.liftedAt ? ` · kaldırılma: ${fmt(s.liftedAt)}` : ''}
              {' · veren: '}{by}
            </p>
          </div>
        );
      })}
    </div>
  );
}
