'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

// ─── Renk sabitleri ───────────────────────────────────────────────────────────
const SURFACE = '#0a1628';
const CARD    = '#0d1f3c';
const BORDER  = '#1a3a5c';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const GREEN   = '#22c55e';
const RED     = '#ef4444';
const BLUE    = '#3b82f6';
const AMBER   = '#f59e0b';
const CYAN    = '#22d3ee';
const MONO    = '"JetBrains Mono", "Fira Code", "Courier New", monospace';
const SANS    = 'Inter, system-ui, sans-serif';

const KYC_COLOR: Record<string, string> = {
  APPROVED:   GREEN,
  REJECTED:   RED,
  PENDING:    AMBER,
  SUSPICIOUS: '#fb923c',
};

// ─── Tipler ───────────────────────────────────────────────────────────────────
interface User {
  id: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  createdAt: string;
  profile?: { firstName: string; lastName: string; primaryCity?: { name: string }; };
  kyc?: { status: string };
}

interface UserDetail extends User {
  oceanScore?: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number };
  subscriptions?: { plan: string; expiresAt?: string }[];
}

// ─── Sayfa ────────────────────────────────────────────────────────────────────
export default function KullanicilarPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [myRole, setMyRole] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) q.set('search', search);
    api.get<{ items: User[]; total: number }>(`/admin/users?${q}`)
      .then((r) => { setUsers(r.items); setTotal(r.total); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get<{ role: string }>('/auth/me').then((m) => setMyRole(m.role)).catch(() => {});
  }, []);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await api.get<UserDetail>(`/admin/users/${id}`);
      setDetail(d);
    } catch (e) { toast.error((e as Error).message); }
    finally { setDetailLoading(false); }
  }

  async function resetOcean(id: string) {
    try {
      await api.patch(`/admin/users/${id}/test-lock-reset`, {});
      toast.success('Test kilidi sıfırlandı.');
    } catch (e) { toast.error((e as Error).message); }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <AdminShell>
      <div style={{ fontFamily: SANS }}>

        {/* Başlık */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>
            Kullanıcılar
          </h1>
          {total > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: MUTED }}>
              {total.toLocaleString('tr-TR')} kullanıcı
            </p>
          )}
        </div>

        {/* Arama */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
            placeholder="İsim veya telefon ara…"
            style={{
              flex: 1, maxWidth: 320,
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: '7px 12px',
              fontSize: 12, color: TEXT,
              outline: 'none', fontFamily: SANS,
            }}
          />
          <button
            onClick={() => { setSearch(searchInput); setPage(1); }}
            style={{
              padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.35)',
              fontSize: 12, color: BLUE, fontFamily: SANS,
            }}
          >
            Ara
          </button>
          {search && (
            <button
              onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
              style={{
                padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
                background: 'transparent',
                border: `1px solid ${BORDER}`,
                fontSize: 12, color: MUTED, fontFamily: SANS,
              }}
            >
              Temizle
            </button>
          )}
        </div>

        {/* Tablo */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{ height: 44, background: CARD, borderRadius: 8, border: `1px solid ${BORDER}`, opacity: 0.5 }} />
            ))}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {['Ad Soyad', 'Telefon', 'Şehir', 'KYC', 'Kayıt', ''].map((h) => (
                      <th key={h} style={{
                        textAlign: 'left',
                        padding: '0 12px 10px',
                        fontSize: 9, fontWeight: 800,
                        letterSpacing: '0.14em', color: MUTED,
                      }}>
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const kycColor = KYC_COLOR[u.kyc?.status ?? ''] ?? MUTED;
                    return (
                      <tr
                        key={u.id}
                        onClick={() => openDetail(u.id)}
                        style={{ borderBottom: `1px solid rgba(26,58,92,0.5)`, cursor: 'pointer' }}
                      >
                        <td style={{ padding: '11px 12px', fontSize: 12, fontWeight: 600, color: TEXT }}>
                          {u.profile?.firstName} {u.profile?.lastName}
                        </td>
                        <td style={{ padding: '11px 12px', fontSize: 11, color: MUTED, fontFamily: MONO }}>
                          {u.phone ?? '—'}
                        </td>
                        <td style={{ padding: '11px 12px', fontSize: 11, color: MUTED }}>
                          {u.profile?.primaryCity?.name ?? '—'}
                        </td>
                        <td style={{ padding: '11px 12px' }}>
                          {u.kyc?.status ? (
                            <span style={{
                              fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                              padding: '2px 7px', borderRadius: 99,
                              background: `${kycColor}18`,
                              border: `1px solid ${kycColor}55`,
                              color: kycColor,
                            }}>
                              {u.kyc.status}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: MUTED }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '11px 12px', fontSize: 11, color: MUTED, fontFamily: MONO }}>
                          {new Date(u.createdAt).toLocaleDateString('tr-TR')}
                        </td>
                        <td style={{ padding: '11px 12px', fontSize: 11, color: CYAN }}>
                          Detay →
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Sayfalama */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '5px 12px', borderRadius: 6, cursor: page === 1 ? 'not-allowed' : 'pointer',
                    background: 'transparent', border: `1px solid ${BORDER}`,
                    fontSize: 11, color: MUTED, fontFamily: SANS,
                    opacity: page === 1 ? 0.4 : 1,
                  }}
                >
                  ← Önceki
                </button>
                <span style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: '5px 12px', borderRadius: 6, cursor: page === totalPages ? 'not-allowed' : 'pointer',
                    background: 'transparent', border: `1px solid ${BORDER}`,
                    fontSize: 11, color: MUTED, fontFamily: SANS,
                    opacity: page === totalPages ? 0.4 : 1,
                  }}
                >
                  Sonraki →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detay Modal */}
      <Modal open={detailLoading || !!detail} onClose={() => setDetail(null)} title="Kullanıcı Detayı">
        {detailLoading && (
          <p style={{ fontSize: 12, color: MUTED, fontFamily: SANS }}>Yükleniyor…</p>
        )}
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: SANS }}>

            {/* Temel bilgiler */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <DetailRow label="Ad Soyad" value={`${detail.profile?.firstName ?? ''} ${detail.profile?.lastName ?? ''}`} />
              <DetailRow label="E-posta"  value={detail.email} mono />
              <DetailRow label="Telefon"  value={detail.phone ?? '—'} mono />
              <DetailRow label="Rol"      value={detail.role} />
              <DetailRow label="KYC"      value={detail.kyc?.status ?? '—'} color={KYC_COLOR[detail.kyc?.status ?? ''] ?? MUTED} />
            </div>

            {/* OCEAN Skoru */}
            {detail.oceanScore && (
              <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 2, height: 12, borderRadius: 1, background: CYAN }} />
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: CYAN }}>
                    OCEAN SKORU
                  </span>
                </div>
                {([
                  ['Açıklık',       detail.oceanScore.openness],
                  ['Öz-Disiplin',   detail.oceanScore.conscientiousness],
                  ['Dışadönüklük',  detail.oceanScore.extraversion],
                  ['Uyumluluk',     detail.oceanScore.agreeableness],
                  ['Nevrotiklik',   detail.oceanScore.neuroticism],
                ] as [string, number][]).map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: MUTED, minWidth: 100 }}>{label}</span>
                    <div style={{ flex: 1, height: 4, background: '#020c1b', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${val}%`,
                        background: `linear-gradient(90deg, ${BLUE}, ${CYAN})`,
                        borderRadius: 99,
                      }} />
                    </div>
                    <span style={{ fontSize: 11, color: MUTED, fontFamily: MONO, minWidth: 28, textAlign: 'right' }}>
                      {Math.round(val)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Aktif Paket */}
            {detail.subscriptions && detail.subscriptions.length > 0 && (
              <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 2, height: 12, borderRadius: 1, background: GREEN }} />
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: GREEN }}>
                    AKTİF PAKET
                  </span>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
                  padding: '3px 10px', borderRadius: 99,
                  background: 'rgba(34,197,94,0.12)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  color: GREEN,
                }}>
                  {detail.subscriptions[0].plan}
                </span>
              </div>
            )}

            {/* SUPERADMIN işlemleri */}
            {myRole === 'SUPERADMIN' && (
              <button
                onClick={() => resetOcean(detail.id)}
                style={{
                  marginTop: 4, width: '100%', padding: '8px',
                  borderRadius: 8, cursor: 'pointer',
                  background: 'transparent',
                  border: `1px solid ${BORDER}`,
                  fontSize: 12, color: MUTED, fontFamily: SANS,
                }}
              >
                OCEAN Kilidini Sıfırla
              </button>
            )}
          </div>
        )}
      </Modal>
    </AdminShell>
  );
}

function DetailRow({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 11, color: MUTED, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 11, color: color ?? TEXT, fontFamily: mono ? MONO : SANS, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}
