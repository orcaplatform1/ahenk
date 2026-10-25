'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, API_PREFIX } from '@/lib/api';
import { myRole, myId } from '@/lib/adminRole';
import { AdminUserEdit } from '@/components/AdminUserEdit';
import { AdminSanctionHistory } from '@/components/AdminSanctionHistory';
import { AdminNoShowWarnings, type NoShowReportItem, type NoShowWarningInfo } from '@/components/AdminNoShowWarnings';
import { AdminOpenTables } from '@/components/AdminOpenTables';

// Yaptırım yetkisi (backend assertCanSanction ile aynı kural)
function canSanction(target: { id: string; role: string }): boolean {
  const meId = myId();
  if (!meId) return false;
  if (meId === target.id || target.role === 'SUPERADMIN') return false;
  return target.role !== 'ADMIN' || myRole() === 'SUPERADMIN';
}

const BG     = '#020c1b';
const SURFACE = '#0a1628';
const CARD   = '#0d1f3c';
const BORDER = '#1a3a5c';
const TEXT   = '#e2e8f0';
const MUTED  = '#64748b';
const GREEN  = '#22c55e';
const RED    = '#ef4444';
const BLUE   = '#3b82f6';
const AMBER  = '#f59e0b';
const CYAN   = '#22d3ee';
const SANS   = 'Inter, system-ui, sans-serif';
const MONO   = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

const inputStyle: React.CSSProperties = {
  background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
  padding: '7px 12px', fontSize: 12, color: TEXT,
  outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
};

interface MeetingRow {
  id: string;
  type: 'GROUP' | 'ONE_ON_ONE';
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  scheduledAt: string;
  locationText: string | null;
  city?: { name: string } | null;
  _count: { participants: number };
}

interface OceanScore {
  openness: number; conscientiousness: number; extraversion: number;
  agreeableness: number; neuroticism: number;
}

interface Participant {
  userId: string;
  status: string;
  user: {
    id: string; email: string; isBot?: boolean;
    profile: { firstName: string; lastName: string; city: string | null } | null;
    oceanScore: OceanScore | null;
    subscriptions: { plan: string }[];
  };
}

interface MeetingDetail extends MeetingRow {
  maxParticipants: number;
  venueAddress: string | null;
  venuePhotoUrl: string | null;  venuePhotoCaption1: string | null;
  venuePhoto2Url: string | null; venuePhotoCaption2: string | null;
  venuePhoto3Url: string | null; venuePhotoCaption3: string | null;
  participants: Participant[];
  reviews: {
    id: string; rating: number; comment: string | null;
    reviewer: { id: string; profile: { firstName: string; lastName: string } | null };
  }[];
  blocks: { blockerId: string; blockedId: string }[];
  noShowReports: { reporterId: string; reportedId: string; createdAt: string }[];
}

interface BotRow { id: string; name: string; gender: string | null; age: number | null; }

interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  senderInitials: string;
  senderName: string | null;
  reportCount: number;
  reports: { reporterId: string; reporterInitials: string; createdAt: string }[];
}

interface ListResponse { items: MeetingRow[]; total: number; page: number; totalPages: number; }

interface AdminUserDetail {
  id: string; email: string; phone: string | null; role: string; status: string;
  profile: { firstName: string | null; lastName: string | null; city: string | null; gender?: string | null; birthDate?: string | null; primaryCity?: string | null } | null;
  occupationSector?: string | null;
  kyc: { status: string } | null;
  subscriptions: { id: string; plan: string; status: string }[];
  oceanScore?: { completedAt: string; adminCanReset: boolean } | null;
  noShowReportsReceived?: NoShowReportItem[];
  noShowWarnings?: NoShowWarningInfo;
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:   { label: 'Bekliyor',   color: AMBER, bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)'  },
  ACTIVE:    { label: 'Aktif',      color: GREEN, bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)'   },
  COMPLETED: { label: 'Tamamlandı', color: MUTED, bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)' },
  CANCELLED: { label: 'İptal',      color: RED,   bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)'   },
};

const TYPE_LABEL: Record<string, string> = { GROUP: 'Grup', ONE_ON_ONE: 'Başbaşa' };
const PLAN_LABEL: Record<string, string> = { MASADA: 'Masada', KARSIMDA: 'Karşımda', ICERDE: 'İçerde' };

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function oceanAvg(o: OceanScore | null) {
  if (!o) return '—';
  return ((o.openness + o.conscientiousness + o.extraversion + o.agreeableness + o.neuroticism) / 5).toFixed(0);
}

export default function AdminMatches() {
  const [tab, setTab] = useState<'all' | 'open'>('all');
  const [items, setItems] = useState<MeetingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<MeetingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [venueInput, setVenueInput] = useState('');
  const [venueSaving, setVenueSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [bots, setBots] = useState<BotRow[]>([]);
  const [venueAddress, setVenueAddress] = useState('');
  const [captions, setCaptions] = useState(['', '', '']);
  const [photoSaving, setPhotoSaving] = useState<number | 'info' | null>(null);
  const [botToPlace, setBotToPlace] = useState('');
  const [placingBot, setPlacingBot] = useState(false);

  const [userModal, setUserModal] = useState<AdminUserDetail | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userAction, setUserAction] = useState<string | null>(null);
  const [sanctionReasons, setSanctionReasons] = useState<string[]>([]);
  const [sanctionReason, setSanctionReason] = useState('');
  const [grantPlan, setGrantPlan] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (statusFilter) params.set('status', statusFilter);
    if (cityFilter) params.set('city', cityFilter);
    api.get<ListResponse>(`/admin/meetings?${params}`)
      .then(r => { setItems(r.items ?? []); setTotal(r.total ?? 0); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [statusFilter, cityFilter, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get<string[]>('/admin/sanction-reasons').then(setSanctionReasons).catch(() => {}); }, []);
  // Bot listesi ve yerleştirme yalnızca SUPERADMIN
  const isSuperadmin = myRole() === 'SUPERADMIN';
  // Masaya eklenebilecek botlar: sadece eksik cinsiyet ve o saatte boşta olanlar (backend süzer)
  const loadBots = (meetingId: string) => {
    if (isSuperadmin) api.get<BotRow[]>(`/admin/matches/${meetingId}/bots`).then(setBots).catch(() => setBots([]));
  };

  async function openDetail(row: MeetingRow) {
    if (selected?.id === row.id) { setSelected(null); return; }
    setDetailLoading(true);
    setSelected(null);
    try {
      const [d, messages] = await Promise.all([
        api.get<MeetingDetail>(`/admin/meetings/${row.id}`),
        api.get<ChatMessage[]>(`/chat/admin/${row.id}`).catch(() => [] as ChatMessage[]),
      ]);
      setSelected(d);
      setChat(messages);
      setBotToPlace('');
      loadBots(row.id);
      setVenueInput(d.locationText ?? '');
      setVenueAddress(d.venueAddress ?? '');
      setCaptions([d.venuePhotoCaption1 ?? '', d.venuePhotoCaption2 ?? '', d.venuePhotoCaption3 ?? '']);
    } catch (e) { setError(`Masa detayı yüklenemedi: ${(e as Error).message}`); }
    finally { setDetailLoading(false); }
  }

  async function approve() {
    if (!selected) return;
    setApproving(true);
    try {
      await api.patch(`/admin/matches/${selected.id}/approve`, {});
      setSelected(s => s ? { ...s, status: 'ACTIVE' } : null);
      setItems(prev => prev.map(m => m.id === selected.id ? { ...m, status: 'ACTIVE' } : m));
    } catch (e) { setError(`Onaylama başarısız: ${(e as Error).message}`); }
    finally { setApproving(false); }
  }

  async function saveVenue() {
    if (!selected) return;
    setVenueSaving(true);
    try {
      await api.patch(`/admin/meetings/${selected.id}/venue`, { locationText: venueInput });
      setSelected(s => s ? { ...s, locationText: venueInput } : null);
      setItems(prev => prev.map(m => m.id === selected.id ? { ...m, locationText: venueInput } : m));
    } catch (e) { setError(`Mekan kaydedilemedi: ${(e as Error).message}`); }
    finally { setVenueSaving(false); }
  }

  async function uploadVenuePhoto(slot: 1 | 2 | 3, file: File) {
    if (!selected) return;
    setPhotoSaving(slot); setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_PREFIX}/admin/meetings/${selected.id}/venue-photo?slot=${slot}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message ?? 'Fotoğraf yüklenemedi');
      const key = (['venuePhotoUrl', 'venuePhoto2Url', 'venuePhoto3Url'] as const)[slot - 1];
      setSelected(s => s ? { ...s, [key]: (data as { url: string }).url } : null);
    } catch (e) { setError((e as Error).message); }
    finally { setPhotoSaving(null); }
  }

  async function saveVenueInfo(clearSlot?: 1 | 2 | 3) {
    if (!selected) return;
    setPhotoSaving(clearSlot ?? 'info'); setError('');
    try {
      const body: Record<string, string> = {
        venueAddress,
        venuePhotoCaption1: captions[0], venuePhotoCaption2: captions[1], venuePhotoCaption3: captions[2],
      };
      if (clearSlot) body[(['venuePhotoUrl', 'venuePhoto2Url', 'venuePhoto3Url'] as const)[clearSlot - 1]] = '';
      const d = await api.patch<Partial<MeetingDetail>>(`/admin/meetings/${selected.id}/venue-photos`, body);
      setSelected(s => s ? { ...s, ...d } : null);
    } catch (e) { setError((e as Error).message); }
    finally { setPhotoSaving(null); }
  }

  async function placeBot() {
    if (!selected || !botToPlace) return;
    setPlacingBot(true); setError('');
    try {
      await api.post(`/admin/matches/${selected.id}/bot`, { botUserId: botToPlace });
      const d = await api.get<MeetingDetail>(`/admin/meetings/${selected.id}`);
      setSelected(d);
      setBotToPlace('');
      loadBots(selected.id);
    } catch (e) { setError((e as Error).message); }
    finally { setPlacingBot(false); }
  }

  async function removeParticipant(userId: string) {
    if (!selected) return;
    setRemoving(userId);
    try {
      await api.delete(`/admin/meetings/${selected.id}/participants/${userId}`);
      setSelected(s => s ? { ...s, participants: s.participants.filter(p => p.userId !== userId) } : null);
    } catch (e) { setError(`Katılımcı çıkarılamadı: ${(e as Error).message}`); }
    finally { setRemoving(null); }
  }

  async function cancelMeeting() {
    if (!selected) return;
    setCancelling(true);
    try {
      await api.delete(`/admin/meetings/${selected.id}`);
      setSelected(s => s ? { ...s, status: 'CANCELLED' } : null);
      setItems(prev => prev.map(m => m.id === selected.id ? { ...m, status: 'CANCELLED' } : m));
      setCancelConfirm(false);
    } catch (e) { setError(`İptal başarısız: ${(e as Error).message}`); }
    finally { setCancelling(false); }
  }

  // Pencereyi kapatmadan detayı yeniler (düzenleme / yaptırım sonrası)
  function refreshUser(userId: string) {
    api.get<AdminUserDetail>(`/admin/users/${userId}`).then(setUserModal)
      .catch((e: Error) => setError(`Kullanıcı yüklenemedi: ${e.message}`));
  }

  async function openUser(userId: string) {
    setUserLoading(true);
    setUserModal(null);
    try {
      const u = await api.get<AdminUserDetail>(`/admin/users/${userId}`);
      setUserModal(u);
      setGrantPlan('');
    } catch (e) { setError(`Kullanıcı yüklenemedi: ${(e as Error).message}`); }
    finally { setUserLoading(false); }
  }

  async function userUpdateStatus(status: string, reasonOverride?: string) {
    if (!userModal) return;
    setUserAction(status);
    const reason = reasonOverride ?? sanctionReason;
    try {
      await api.patch(`/admin/users/${userModal.id}/status`, status === 'SUSPENDED' && reason ? { status, reason } : { status });
      setUserModal(u => u ? { ...u, status } : null);
    } catch (e) { setError(`İşlem başarısız: ${(e as Error).message}`); }
    finally { setUserAction(null); }
  }

  async function userResetTestLock() {
    if (!userModal) return;
    setUserAction('test');
    try {
      await api.patch(`/admin/users/${userModal.id}/test-lock-reset`, {});
      setUserModal(u => u && u.oceanScore ? { ...u, oceanScore: { ...u.oceanScore, adminCanReset: true } } : u);
    } catch (e) { setError(`Test kilidi sıfırlanamadı: ${(e as Error).message}`); }
    finally { setUserAction(null); }
  }

  async function userApproveKyc() {
    if (!userModal) return;
    setUserAction('kyc');
    try {
      await api.post(`/admin/users/${userModal.id}/kyc-approve`, {});
      setUserModal(u => u ? { ...u, kyc: { status: 'APPROVED' } } : null);
    } catch (e) { setError(`KYC onaylanamadı: ${(e as Error).message}`); }
    finally { setUserAction(null); }
  }

  async function userGrantSubscription() {
    if (!userModal || !grantPlan) return;
    setUserAction('sub');
    try {
      await api.post(`/admin/users/${userModal.id}/free-subscription`, { plan: grantPlan });
      setGrantPlan('');
      // Çakışan paket iptal edilmiş olabilir: rozetler güncellenir
      refreshUser(userModal.id);
    } catch (e) { setError(`Abonelik verilemedi: ${(e as Error).message}`); }
    finally { setUserAction(null); }
  }

  const totalPages = Math.ceil(total / 25);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>Masalar</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['all', 'Tüm masalar'], ['open', 'Açık masalar']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '7px 16px', borderRadius: 99, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: SANS,
              background: tab === key ? 'rgba(59,130,246,0.15)' : 'transparent',
              border: `1px solid ${tab === key ? 'rgba(59,130,246,0.45)' : BORDER}`,
              color: tab === key ? '#93c5fd' : MUTED,
            }}
          >{label}</button>
        ))}
      </div>

      {tab === 'open' && <AdminOpenTables isSuperadmin={isSuperadmin} onUserClick={openUser} />}

      {tab === 'all' && (<>
      {/* Filtreler */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ ...inputStyle, width: 160 }}
        >
          <option value="">Tüm durumlar</option>
          <option value="PENDING">Bekliyor</option>
          <option value="ACTIVE">Aktif</option>
          <option value="COMPLETED">Tamamlandı</option>
          <option value="CANCELLED">İptal</option>
        </select>
        <input
          type="text"
          value={cityFilter}
          onChange={e => { setCityFilter(e.target.value); setPage(1); }}
          placeholder="Şehir..."
          style={{ ...inputStyle, width: 140 }}
        />
      </div>

      {error && <p style={{ margin: '0 0 16px', fontSize: 12, color: RED }}>{error}</p>}

      {/* Tablo */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 2, height: 12, borderRadius: 1, background: BLUE }} />
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: BLUE }}>MASALAR</span>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>{total} kayıt</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 420, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {['Tarih', 'Tip', 'Şehir', 'Kişi', 'Mekan', 'Durum', ''].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: MUTED }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [0,1,2,3,4].map(i => (
                    <tr key={i}>
                      <td colSpan={7} style={{ padding: '8px 14px' }}>
                        <div style={{ height: 36, background: SURFACE, borderRadius: 6, opacity: 0.5 }} />
                      </td>
                    </tr>
                  ))
                : items.map((m, i) => {
                    const s = STATUS_CFG[m.status] ?? STATUS_CFG.PENDING;
                    const isActive = selected?.id === m.id;
                    return (
                      <tr
                        key={m.id}
                        onClick={() => openDetail(m)}
                        style={{
                          borderBottom: i < items.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none',
                          background: isActive ? 'rgba(59,130,246,0.07)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '10px 14px', fontSize: 11, color: TEXT, whiteSpace: 'nowrap' }}>{fmtDate(m.scheduledAt)}</td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: MUTED }}>{TYPE_LABEL[m.type] ?? m.type}</td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>{m.city?.name ?? '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: MUTED, textAlign: 'center' }}>{m._count.participants}</td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: MUTED, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.locationText ?? '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                            padding: '2px 7px', borderRadius: 99,
                            background: s.bg, border: `1px solid ${s.border}`, color: s.color,
                          }}>{s.label}</span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: MUTED }}>{isActive ? '▲' : '▼'}</td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>

        {!loading && items.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>Henüz masa yok</p>
          </div>
        )}
      </div>

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: '6px 16px', borderRadius: 99, background: 'transparent', border: `1px solid ${BORDER}`, fontSize: 11, color: MUTED, cursor: 'pointer', opacity: page === 1 ? 0.3 : 1 }}
          >← Önceki</button>
          <span style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ padding: '6px 16px', borderRadius: 99, background: 'transparent', border: `1px solid ${BORDER}`, fontSize: 11, color: MUTED, cursor: 'pointer', opacity: page === totalPages ? 0.3 : 1 }}
          >Sonraki →</button>
        </div>
      )}

      {/* Detay */}
      {detailLoading && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
          {[0,1,2].map(i => <div key={i} style={{ height: 36, background: SURFACE, borderRadius: 6, opacity: 0.5, marginBottom: 10 }} />)}
        </div>
      )}

      {selected && !detailLoading && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>{fmtDate(selected.scheduledAt)}</p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: MUTED }}>
                {TYPE_LABEL[selected.type]} · {selected.participants.length} katılımcı
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                padding: '2px 8px', borderRadius: 99,
                background: STATUS_CFG[selected.status]?.bg,
                border: `1px solid ${STATUS_CFG[selected.status]?.border}`,
                color: STATUS_CFG[selected.status]?.color,
              }}>
                {STATUS_CFG[selected.status]?.label}
              </span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: MUTED, padding: 4 }}>✕</button>
            </div>
          </div>

          {/* Onayla */}
          {selected.status === 'PENDING' && (
            <button
              onClick={approve}
              disabled={approving}
              style={{
                width: '100%', padding: '9px', borderRadius: 8, cursor: approving ? 'not-allowed' : 'pointer',
                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                fontSize: 12, fontWeight: 600, color: GREEN, fontFamily: SANS,
                opacity: approving ? 0.5 : 1,
              }}
            >
              {approving ? 'Onaylanıyor…' : '✓ Masayı Onayla'}
            </button>
          )}

          {/* Mekan */}
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>MEKAN</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={venueInput}
                onChange={e => setVenueInput(e.target.value)}
                placeholder="Mekan adı / adresi…"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={saveVenue}
                disabled={venueSaving}
                style={{
                  padding: '7px 16px', borderRadius: 8, cursor: venueSaving ? 'not-allowed' : 'pointer',
                  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                  fontSize: 11, fontWeight: 600, color: '#93c5fd', fontFamily: SANS,
                  opacity: venueSaving ? 0.5 : 1, flexShrink: 0,
                }}
              >
                {venueSaving ? '…' : 'Kaydet'}
              </button>
            </div>
          </div>

          {/* Mekan adresi + fotoğraflar (masa kartında katılımcılara gösterilir) */}
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>MEKAN ADRESİ VE FOTOĞRAFLAR</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={venueAddress}
                onChange={e => setVenueAddress(e.target.value)}
                placeholder="Açık adres…"
                style={{ ...inputStyle, flex: 1 }}
              />
              {(venueAddress.trim() || venueInput.trim()) && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([venueInput.trim(), venueAddress.trim()].filter(Boolean).join(', '))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '7px 12px', borderRadius: 8, flexShrink: 0, textDecoration: 'none',
                    background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)',
                    fontSize: 11, fontWeight: 600, color: CYAN, fontFamily: SANS,
                  }}
                >
                  Haritada gör
                </a>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {([1, 2, 3] as const).map(slot => {
                const url = [selected.venuePhotoUrl, selected.venuePhoto2Url, selected.venuePhoto3Url][slot - 1];
                return (
                  <div key={slot} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label
                      style={{
                        position: 'relative', aspectRatio: '4 / 3', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                        background: SURFACE, border: `1px dashed ${BORDER}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {url
                        ? <img src={url} alt={`Fotoğraf ${slot}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 10, color: MUTED }}>{photoSaving === slot ? 'Yükleniyor…' : `+ Fotoğraf ${slot}`}</span>}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        disabled={photoSaving !== null}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadVenuePhoto(slot, f); e.target.value = ''; }}
                      />
                    </label>
                    <input
                      value={captions[slot - 1]}
                      onChange={e => setCaptions(c => c.map((x, i) => i === slot - 1 ? e.target.value : x))}
                      placeholder={`Açıklama ${slot}`}
                      style={{ ...inputStyle, width: '100%', padding: '5px 8px', fontSize: 10 }}
                    />
                    {url && (
                      <button
                        onClick={() => saveVenueInfo(slot)}
                        disabled={photoSaving !== null}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 9, color: RED, fontFamily: SANS, textAlign: 'left' }}
                      >
                        {photoSaving === slot ? '…' : 'Fotoğrafı kaldır'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => saveVenueInfo()}
              disabled={photoSaving !== null}
              style={{
                marginTop: 8, padding: '7px 16px', borderRadius: 8, cursor: photoSaving !== null ? 'not-allowed' : 'pointer',
                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                fontSize: 11, fontWeight: 600, color: '#93c5fd', fontFamily: SANS,
                opacity: photoSaving !== null ? 0.5 : 1,
              }}
            >
              {photoSaving === 'info' ? '…' : 'Adres ve Açıklamaları Kaydet'}
            </button>
          </div>

          {/* Katılımcılar */}
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>
              KATILIMCILAR ({selected.participants.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {selected.participants.map((p, i) => (
                <div
                  key={p.userId}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    padding: '10px 0',
                    borderBottom: i < selected.participants.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none',
                  }}
                >
                  <button
                    onClick={() => openUser(p.user.id)}
                    style={{ textAlign: 'left', flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: TEXT }}>
                      {p.user.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : p.user.email}
                      {p.user.isBot && <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 800, color: CYAN }}>BOT</span>}
                      {['CANCELLED', 'DECLINED', 'NO_SHOW'].includes(p.status) && <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 800, color: RED }}>İPTAL</span>}
                    </p>
                    {p.user.email && <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED }}>{p.user.email}</p>}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO }}>OCEAN {oceanAvg(p.user.oceanScore)}</span>
                    {selected.status !== 'CANCELLED' && selected.status !== 'COMPLETED' && (
                      <button
                        onClick={() => removeParticipant(p.userId)}
                        disabled={removing === p.userId}
                        style={{
                          padding: '3px 8px', borderRadius: 6, cursor: removing === p.userId ? 'not-allowed' : 'pointer',
                          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                          fontSize: 10, color: RED, fontFamily: SANS,
                          opacity: removing === p.userId ? 0.5 : 1,
                        }}
                      >
                        {removing === p.userId ? '…' : 'Çıkart'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bot yerleştir */}
          {isSuperadmin && selected.status !== 'CANCELLED' && selected.status !== 'COMPLETED' && (() => {
            const active = selected.participants.filter(p => !['CANCELLED', 'DECLINED', 'NO_SHOW'].includes(p.status));
            const emptySeats = selected.maxParticipants - active.length;
            const available = bots;
            return (
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>
                  BOT YERLEŞTİR ({emptySeats > 0 ? `${emptySeats} boş koltuk` : 'boş koltuk yok'})
                </p>
                {emptySeats > 0 && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={botToPlace}
                      onChange={e => setBotToPlace(e.target.value)}
                      style={{ ...inputStyle, flex: 1, background: SURFACE }}
                    >
                      <option value="">{available.length ? 'Bot seçin (eksik cinsiyet)' : 'Uygun bot yok'}</option>
                      {available.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name || b.id} ({b.gender === 'MALE' ? 'E' : 'K'}{b.age !== null ? `, ${b.age}` : ''})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={placeBot}
                      disabled={placingBot || !botToPlace}
                      style={{
                        padding: '7px 16px', borderRadius: 8, cursor: placingBot || !botToPlace ? 'not-allowed' : 'pointer',
                        background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                        fontSize: 11, fontWeight: 600, color: '#93c5fd', fontFamily: SANS,
                        opacity: placingBot || !botToPlace ? 0.5 : 1, flexShrink: 0,
                      }}
                    >
                      {placingBot ? '…' : 'Yerleştir'}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Sohbet geçmişi (salt okunur, silinenler dahil) */}
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>
              SOHBET GEÇMİŞİ ({chat.length}{chat.some(m => m.reportCount > 0) ? ` · ${chat.filter(m => m.reportCount > 0).length} şikayetli` : ''})
            </p>
            {chat.length === 0 ? (
              <p style={{ margin: 0, fontSize: 11, color: MUTED }}>Mesaj yok</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                {chat.map(m => (
                  <div
                    key={m.id}
                    style={{
                      padding: '8px 10px', borderRadius: 8,
                      background: m.reportCount > 0 ? 'rgba(239,68,68,0.08)' : SURFACE,
                      border: `1px solid ${m.reportCount > 0 ? 'rgba(239,68,68,0.3)' : BORDER}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: TEXT }}>
                        {m.senderName ?? m.senderInitials}
                      </span>
                      <span style={{ fontSize: 9, color: MUTED, fontFamily: MONO }}>
                        {new Date(m.createdAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: m.deletedAt ? MUTED : TEXT, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {m.content}
                    </p>
                    {(m.deletedAt || m.reportCount > 0) && (
                      <p style={{ margin: '4px 0 0', fontSize: 9, color: m.reportCount > 0 ? RED : MUTED }}>
                        {m.deletedAt ? 'Kullanıcı tarafında silindi' : ''}
                        {m.deletedAt && m.reportCount > 0 ? ' · ' : ''}
                        {m.reportCount > 0
                          ? `${m.reportCount} şikayet: ${m.reports.map(r => `${r.reporterInitials} (${new Date(r.createdAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})`).join(', ')}`
                          : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Değerlendirmeler */}
          {selected.reviews.length > 0 && (
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>
                DEĞERLENDİRMELER ({selected.reviews.length})
              </p>
              {selected.reviews.map((r, i) => (
                <div key={r.id} style={{ padding: '8px 0', borderBottom: i < selected.reviews.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                      {r.reviewer.profile ? `${r.reviewer.profile.firstName} ${r.reviewer.profile.lastName[0]}.` : '—'}
                    </p>
                    <span style={{ fontSize: 13 }}>
                      {[1,2,3,4,5].map(i => <span key={i} style={{ color: i <= r.rating ? AMBER : 'rgba(255,255,255,0.12)' }}>★</span>)}
                    </span>
                  </div>
                  {r.comment && (
                    <p style={{ margin: 0, fontSize: 11, color: TEXT }}>
                      <span style={{ color: MUTED }}>Beklenti: </span>{r.comment}
                    </p>
                  )}
                  {(() => {
                    const nameOf = (id: string) => {
                      const pr = selected.participants.find(p => p.userId === id)?.user.profile;
                      return pr ? `${pr.firstName} ${pr.lastName}` : '—';
                    };
                    const blocked = selected.blocks.filter(b => b.blockerId === r.reviewer.id).map(b => nameOf(b.blockedId));
                    const noShow = (selected.noShowReports ?? []).filter(n => n.reporterId === r.reviewer.id).map(n => nameOf(n.reportedId));
                    return (
                      <>
                        {noShow.length > 0 && (
                          <p style={{ margin: '4px 0 0', fontSize: 11, color: RED }}>
                            <span style={{ color: MUTED }}>Gelmedi bildirdi: </span>{noShow.join(', ')}
                          </p>
                        )}
                        {blocked.length > 0 && (
                          <p style={{ margin: '4px 0 0', fontSize: 11, color: AMBER }}>
                            <span style={{ color: MUTED }}>Engelledi: </span>{blocked.join(', ')}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}

          {/* İptal */}
          {selected.status !== 'CANCELLED' && selected.status !== 'COMPLETED' && (
            <button
              onClick={() => setCancelConfirm(true)}
              style={{
                width: '100%', padding: '9px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(239,68,68,0.08)', border: `1px solid rgba(239,68,68,0.3)`,
                fontSize: 12, fontWeight: 600, color: RED, fontFamily: SANS,
              }}
            >
              Masayı İptal Et
            </button>
          )}
        </div>
      )}

      </>)}

      {/* İptal onay modalı */}
      {cancelConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setCancelConfirm(false)}
        >
          <div
            style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, width: '100%', maxWidth: 320, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Masayı iptal et</p>
              <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
                {selected && fmtDate(selected.scheduledAt)} tarihli masa iptal edilecek. Bu işlem geri alınamaz.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setCancelConfirm(false)}
                style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'transparent', border: `1px solid ${BORDER}`, fontSize: 12, color: MUTED, cursor: 'pointer', fontFamily: SANS }}
              >Vazgeç</button>
              <button
                onClick={cancelMeeting}
                disabled={cancelling}
                style={{
                  flex: 1, padding: '9px', borderRadius: 8, cursor: cancelling ? 'not-allowed' : 'pointer',
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                  fontSize: 12, fontWeight: 600, color: RED, fontFamily: SANS,
                  opacity: cancelling ? 0.5 : 1,
                }}
              >
                {cancelling ? '…' : 'İptal Et'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kullanıcı detay modalı */}
      {(userLoading || userModal) && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => setUserModal(null)}
        >
          <div
            style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, width: '100%', maxWidth: 360, maxHeight: '85vh', overflowY: 'auto', padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}
          >
            {userLoading && [0,1,2,3].map(i => (
              <div key={i} style={{ height: 36, background: SURFACE, borderRadius: 6, opacity: 0.5 }} />
            ))}

            {userModal && !userLoading && (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT }}>
                      {userModal.profile ? `${userModal.profile.firstName} ${userModal.profile.lastName}` : userModal.email}
                    </p>
                    {userModal.email && <p style={{ margin: '3px 0 0', fontSize: 11, color: MUTED }}>{userModal.email}</p>}
                    {userModal.phone && <p style={{ margin: '2px 0 0', fontSize: 11, color: MUTED }}>{userModal.phone}</p>}
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>{userModal.role}</p>
                  </div>
                  <button onClick={() => setUserModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: MUTED, padding: 4 }}>✕</button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                    padding: '2px 8px', borderRadius: 99,
                    background: userModal.status === 'ACTIVE' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: userModal.status === 'ACTIVE' ? GREEN : RED,
                    border: `1px solid ${userModal.status === 'ACTIVE' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}>
                    {userModal.status === 'ACTIVE' ? 'Aktif' : userModal.status === 'SUSPENDED' ? 'Askıda' : 'Silinmiş'}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                    padding: '2px 8px', borderRadius: 99,
                    background: userModal.kyc?.status === 'APPROVED' ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
                    color: userModal.kyc?.status === 'APPROVED' ? GREEN : MUTED,
                    border: `1px solid ${userModal.kyc?.status === 'APPROVED' ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.25)'}`,
                  }}>
                    KYC: {userModal.kyc?.status === 'APPROVED' ? 'Onaylı ✓' : userModal.kyc?.status ?? 'Yok'}
                  </span>
                  {/* Tüm aktif paketler (backend sadece ACTIVE gönderir) */}
                  {userModal.subscriptions.map(s => (
                    <span key={s.id} style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                      padding: '2px 8px', borderRadius: 99,
                      background: 'rgba(59,130,246,0.12)', color: BLUE,
                      border: '1px solid rgba(59,130,246,0.3)',
                    }}>
                      {PLAN_LABEL[s.plan] ?? s.plan}
                    </span>
                  ))}
                </div>

                {/* Kişisel bilgi düzenleme */}
                <AdminUserEdit user={userModal} canEdit={canSanction(userModal)} onSaved={() => refreshUser(userModal.id)} />

                {/* Gelmedi bildirimleri + uyarı */}
                <AdminNoShowWarnings
                  userId={userModal.id}
                  reports={userModal.noShowReportsReceived ?? []}
                  warnings={userModal.noShowWarnings ?? { count: 0, limit: 3, warnedMeetingIds: [] }}
                  canSanction={canSanction(userModal)}
                  userStatus={userModal.status}
                  suspending={userAction === 'SUSPENDED'}
                  onChanged={w => setUserModal(u => u ? { ...u, noShowWarnings: w } : null)}
                  onSuspend={() => userUpdateStatus('SUSPENDED', 'Masaya katılım sağlamama')}
                />

                {/* Yaptırım geçmişi */}
                <AdminSanctionHistory userId={userModal.id} canAct={canSanction(userModal)} onChanged={() => refreshUser(userModal.id)} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>HESAP İŞLEMLERİ</p>
                  {canSanction(userModal) ? (<>
                  {userModal.status !== 'SUSPENDED' && (
                    <select
                      value={sanctionReason}
                      onChange={e => setSanctionReason(e.target.value)}
                      style={{
                        padding: '6px 10px', borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`,
                        fontSize: 11, color: TEXT, fontFamily: SANS, outline: 'none',
                      }}
                    >
                      <option value="">Askı sebebi (boşsa: Yönetici kararı)</option>
                      {sanctionReasons.map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {userModal.status !== 'SUSPENDED' && (
                      <button
                        onClick={() => userUpdateStatus('SUSPENDED')}
                        disabled={!!userAction}
                        style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', fontSize: 11, color: AMBER, cursor: 'pointer', fontFamily: SANS, opacity: !!userAction ? 0.5 : 1 }}
                      >
                        {userAction === 'SUSPENDED' ? '…' : 'Askıya Al (1 ay)'}
                      </button>
                    )}
                    {userModal.status === 'SUSPENDED' && myRole() === 'SUPERADMIN' && (
                      <button
                        onClick={() => userUpdateStatus('ACTIVE')}
                        disabled={!!userAction}
                        style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', fontSize: 11, color: GREEN, cursor: 'pointer', fontFamily: SANS, opacity: !!userAction ? 0.5 : 1 }}
                      >
                        {userAction === 'ACTIVE' ? '…' : 'Aktifleştir'}
                      </button>
                    )}
                    {userModal.status !== 'DELETED' && (
                      <button
                        onClick={() => userUpdateStatus('DELETED')}
                        disabled={!!userAction}
                        style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 11, color: RED, cursor: 'pointer', fontFamily: SANS, opacity: !!userAction ? 0.5 : 1 }}
                      >
                        {userAction === 'DELETED' ? '…' : 'Hesabı Sil'}
                      </button>
                    )}
                  </div>
                  </>) : (
                    <p style={{ margin: 0, fontSize: 11, color: MUTED, fontFamily: SANS }}>Bu hesaba işlem yetkiniz yok</p>
                  )}
                </div>

                {/* Kişilik testi kilidi */}
                {userModal.oceanScore && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>KİŞİLİK TESTİ</span>
                    <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                      Son test: {new Date(userModal.oceanScore.completedAt).toLocaleDateString('tr-TR')}
                      {userModal.oceanScore.adminCanReset ? ' · Kilit açık, kullanıcı testi yeniden yapabilir' : ' · 180 gün kilitli'}
                    </p>
                    {!userModal.oceanScore.adminCanReset && (
                      <button
                        onClick={userResetTestLock} disabled={!!userAction}
                        style={{
                          alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 8, cursor: userAction ? 'not-allowed' : 'pointer',
                          background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)',
                          fontSize: 11, fontWeight: 600, fontFamily: SANS, opacity: userAction ? 0.5 : 1,
                        }}
                      >
                        {userAction === 'test' ? '…' : 'Test Kilidini Sıfırla'}
                      </button>
                    )}
                  </div>
                )}

                {userModal.kyc && userModal.kyc.status !== 'APPROVED' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                    <p style={{ margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>KYC</p>
                    <button
                      onClick={userApproveKyc}
                      disabled={!!userAction}
                      style={{
                        padding: '9px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                        fontSize: 12, fontWeight: 600, color: GREEN, cursor: 'pointer', fontFamily: SANS,
                        opacity: !!userAction ? 0.5 : 1,
                      }}
                    >
                      {userAction === 'kyc' ? 'Onaylanıyor…' : "KYC'yi Onayla"}
                    </button>
                  </div>
                )}

                {/* Ücretsiz paket sadece SUPERADMIN */}
                {myRole() === 'SUPERADMIN' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>ÜCRETSİZ ABONELİK VER</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={grantPlan}
                      onChange={e => setGrantPlan(e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                    >
                      <option value="">Paket seç…</option>
                      <option value="MASADA">Masada</option>
                      <option value="KARSIMDA">Karşımda</option>
                      <option value="ICERDE">İçerde</option>
                    </select>
                    <button
                      onClick={userGrantSubscription}
                      disabled={!!userAction || !grantPlan}
                      style={{
                        padding: '7px 16px', borderRadius: 8, cursor: (!!userAction || !grantPlan) ? 'not-allowed' : 'pointer',
                        background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                        fontSize: 12, fontWeight: 600, color: BLUE, fontFamily: SANS,
                        opacity: (!!userAction || !grantPlan) ? 0.5 : 1, flexShrink: 0,
                      }}
                    >
                      {userAction === 'sub' ? '…' : 'Ver'}
                    </button>
                  </div>
                </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
