'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { myRole, myId } from '@/lib/adminRole';
import { AdminUserEdit } from '@/components/AdminUserEdit';
import { AdminSanctionHistory } from '@/components/AdminSanctionHistory';
import { AdminNoShowWarnings, type NoShowReportItem, type NoShowWarningInfo } from '@/components/AdminNoShowWarnings';
import { AdminOpenTables } from '@/components/AdminOpenTables';
import { BG, SURFACE, BORDER, TEXT, MUTED, RED, GREEN, AMBER, BLUE, CYAN, SANS, MONO, LABEL } from '@/lib/adminTheme';
import { AdminSelect } from '@/components/AdminSelect';

// Yaptırım yetkisi (backend assertCanSanction ile aynı kural)
function canSanction(target: { id: string; role: string }): boolean {
  const meId = myId();
  if (!meId) return false;
  if (meId === target.id || target.role === 'SUPERADMIN') return false;
  return target.role !== 'ADMIN' || myRole() === 'SUPERADMIN';
}


const inputStyle: React.CSSProperties = {
  background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
  padding: '7px 12px', fontSize: 13, color: TEXT,
  outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
};

interface MeetingRow {
  id: string;
  title: string;
  type: 'GROUP' | 'ONE_ON_ONE';
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  scheduledAt: string;
  locationText: string | null;
  venueMissing?: boolean;
  city?: { name: string } | null;
  _count: { participants: number };
}

// Masa adı tarihle: "7 Kas · İstanbul Grup 16"
function masaName(m: { scheduledAt: string; title: string }) {
  const day = new Date(m.scheduledAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' });
  return `${day} · ${m.title}`;
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
  participants: Participant[];
  reviews: {
    id: string; rating: number; comment: string | null;
    reviewer: { id: string; profile: { firstName: string; lastName: string } | null };
  }[];
  blocks: { blockerId: string; blockedId: string }[];
  noShowReports: { reporterId: string; reportedId: string; createdAt: string }[];
}

interface VenueOption {
  id: string; name: string; category: string;
  weekCount: number; lastDaysAgo: number | null; capacityShort: boolean;
}

interface BotRow { id: string; name: string; gender: string | null; age: number | null; }

interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  senderInitials: string;
  senderName: string | null;
  senderIsBot?: boolean;
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

const VENUE_PACKAGES = ['SADE', 'ORTA', 'PREMIUM'];
const TYPE_LABEL: Record<string, string> = { GROUP: 'Grup', ONE_ON_ONE: 'Başbaşa' };
const PLAN_LABEL: Record<string, string> = { MASADA: 'Masada', KARSIMDA: 'Karşımda', ICERDE: 'İçerde', KANKAMLA: 'Kankamla' };

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  const [venueOptions, setVenueOptions] = useState<VenueOption[]>([]);
  const [venueChoice, setVenueChoice] = useState('');
  const [venuePackage, setVenuePackage] = useState('');
  const [venueError, setVenueError] = useState('');
  const [venueSaving, setVenueSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  // Sohbet kutusu açıldığında en yeni mesaj (en alt) görünür
  const chatBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = chatBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);
  const [bots, setBots] = useState<BotRow[]>([]);
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
  const [withoutVenue, setWithoutVenue] = useState(0);
  useEffect(() => { api.get<{ count: number }>('/admin/meetings/without-venue').then(r => setWithoutVenue(r.count)).catch(() => {}); }, [items]);
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
      setVenuePackage('');
      setVenueError('');
      setVenueOptions([]);
      setVenueChoice('');
      loadVenueOptions(row.id);
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

  function loadVenueOptions(meetingId: string) {
    api.get<{ venueId: string | null; options: VenueOption[] }>(`/admin/meetings/${meetingId}/venue-options`)
      .then(r => { setVenueOptions(r.options); setVenueChoice(r.venueId ?? ''); })
      .catch((e: Error) => setError(`Mekanlar yüklenemedi: ${e.message}`));
  }

  async function assignVenue() {
    if (!selected || !venueChoice) return;
    setVenueSaving(true); setVenueError('');
    try {
      const r = await api.patch<{ locationText: string }>(`/admin/meetings/${selected.id}/assign-venue`, { venueId: venueChoice });
      setSelected(s => s ? { ...s, locationText: r.locationText } : null);
      setItems(prev => prev.map(m => m.id === selected.id ? { ...m, locationText: r.locationText, venueMissing: false } : m));
      loadVenueOptions(selected.id);
    } catch (e) { setVenueError((e as Error).message); }
    finally { setVenueSaving(false); }
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
    <div className="adm-page" style={{ maxWidth: 900, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24 }}>
        <h1 className="ll-title">Masalar</h1>
        {withoutVenue > 0 && (
          <p style={{ margin: '8px 0 0', padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>
            ⚠ Mekânsız masa: {withoutVenue}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['all', 'Tüm masalar'], ['open', 'Açık masalar']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '7px 16px', borderRadius: 99, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: SANS,
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
        <div style={{ width: 160 }}>
          <AdminSelect
            value={statusFilter}
            onChange={v => { setStatusFilter(v); setPage(1); }}
            placeholder="Tüm durumlar"
            options={[
              { value: '', label: 'Tüm durumlar' }, { value: 'PENDING', label: 'Bekliyor' }, { value: 'ACTIVE', label: 'Aktif' },
              { value: 'COMPLETED', label: 'Tamamlandı' }, { value: 'CANCELLED', label: 'İptal' },
            ]}
          />
        </div>
        <input
          type="text"
          value={cityFilter}
          onChange={e => { setCityFilter(e.target.value); setPage(1); }}
          placeholder="Şehir..."
          style={{ ...inputStyle, width: 140 }}
        />
      </div>

      {error && <p style={{ margin: '0 0 16px', fontSize: 13, color: RED }}>{error}</p>}

      {/* Tablo */}
      <div className="ll-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 className="ll-title">Masalar</h2>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>{total} kayıt</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="adm-table" style={{ width: '100%', minWidth: 420, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {['Masa', 'Tarih', 'Tip', 'Şehir', 'Kişi', 'Mekan', 'Durum', ''].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', ...LABEL, color: MUTED }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [0,1,2,3,4].map(i => (
                    <tr key={i}>
                      <td colSpan={8} style={{ padding: '8px 14px' }}>
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
                        <td data-label="Masa" style={{ padding: '10px 14px', fontSize: 11, color: TEXT, fontWeight: 600 }}>{masaName(m)}</td>
                        <td data-label="Tarih" style={{ padding: '10px 14px', fontSize: 11, color: TEXT, whiteSpace: 'nowrap' }}>{fmtDate(m.scheduledAt)}</td>
                        <td data-label="Tip" style={{ padding: '10px 14px', fontSize: 11, color: MUTED }}>{TYPE_LABEL[m.type] ?? m.type}</td>
                        <td data-label="Şehir" style={{ padding: '10px 14px', fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>{m.city?.name ?? '—'}</td>
                        <td data-label="Kişi" style={{ padding: '10px 14px', fontSize: 11, color: MUTED, textAlign: 'center' }}>{m._count.participants}</td>
                        <td data-label="Mekan" style={{ padding: '10px 14px', fontSize: 11, color: MUTED, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.venueMissing ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>⚠ Mekânsız</span> : m.locationText ?? '—'}</td>
                        <td data-label="Durum" style={{ padding: '10px 14px' }}>
                          <span style={{
                            ...LABEL,
                            padding: '2px 7px', borderRadius: 99,
                            background: s.bg, border: `1px solid ${s.border}`, color: s.color,
                          }}>{s.label}</span>
                        </td>
                        <td data-label="" style={{ padding: '10px 14px', fontSize: 11, color: MUTED }}>{isActive ? '▲' : '▼'}</td>
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
        <div className="ll-card" style={{ marginBottom: 16 }}>
          {[0,1,2].map(i => <div key={i} style={{ height: 36, background: SURFACE, borderRadius: 6, opacity: 0.5, marginBottom: 10 }} />)}
        </div>
      )}

      {selected && !detailLoading && (
        <div className="ll-card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Header */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, minWidth: 0 }}>
            <div style={{ minWidth: 0, flex: '1 1 160px' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>{masaName(selected)}</p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: MUTED }}>
                {fmtDate(selected.scheduledAt)} · {TYPE_LABEL[selected.type]} · {selected.participants.length} katılımcı
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 8, marginLeft: 'auto', maxWidth: '100%' }}>
              <span style={{
                ...LABEL,
                whiteSpace: 'nowrap',
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

          {/* Mekan: /admin/venues kayıtlarından seçilir; adres ve fotoğraflar mekân kaydından gelir */}
          <div>
            <p style={{ margin: '0 0 8px', ...LABEL, color: MUTED }}>Mekan</p>
            <div style={{ marginBottom: 8, maxWidth: 220, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
              <AdminSelect
                value={venuePackage}
                onChange={setVenuePackage}
                placeholder="Tüm paketler"
                title="Paket seç"
                options={[{ value: '', label: 'Tüm paketler' }, ...VENUE_PACKAGES.map(c => ({ value: c, label: c }))]}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 8, minWidth: 0, maxWidth: '100%' }}>
              <AdminSelect
                value={venueChoice}
                onChange={v => { setVenueChoice(v); setVenueError(''); }}
                placeholder={venueOptions.length ? 'Mekan seçin' : 'Uygun mekan yok'}
                title="Mekan seç"
                style={{ flex: 1, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}
                options={venueOptions
                  .filter(o => !venuePackage || o.category === venuePackage || o.id === venueChoice)
                  .map(o => ({
                    value: o.id,
                    label: [
                      o.name,
                      o.category,
                      `Bu hafta ${o.weekCount} masa`,
                      o.lastDaysAgo === null ? 'Hiç atanmadı' : `Son atama: ${o.lastDaysAgo} gün önce`,
                      ...(o.capacityShort ? ['Kapasite yetersiz'] : []),
                    ].join(' · '),
                  }))}
              />
              <button
                onClick={assignVenue}
                disabled={venueSaving || !venueChoice}
                style={{
                  padding: '7px 16px', borderRadius: 8, cursor: venueSaving || !venueChoice ? 'not-allowed' : 'pointer',
                  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                  fontSize: 11, fontWeight: 600, color: '#93c5fd', fontFamily: SANS,
                  opacity: venueSaving || !venueChoice ? 0.5 : 1, flexShrink: 0,
                }}
              >
                {venueSaving ? '…' : 'Ata'}
              </button>
            </div>
            {selected.locationText && !venueOptions.some(o => o.id === venueChoice) && (
              <p style={{ margin: '6px 0 0', fontSize: 11, color: MUTED }}>Mevcut mekan: {selected.locationText}</p>
            )}
            {venueError && <p style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 600, color: RED }}>{venueError}</p>}
          </div>

          {/* Katılımcılar */}
          <div>
            <p style={{ margin: '0 0 8px', ...LABEL, color: MUTED }}>
              KATILIMCILAR ({selected.participants.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {selected.participants.map((p, i) => (
                <div
                  key={p.userId}
                  style={{
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    padding: '10px 0', minWidth: 0,
                    borderBottom: i < selected.participants.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none',
                  }}
                >
                  <button
                    onClick={() => openUser(p.user.id)}
                    style={{ textAlign: 'left', flex: '1 1 160px', minWidth: 0, maxWidth: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, overflowWrap: 'anywhere' }}
                  >
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>
                      {p.user.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : p.user.email}
                      {p.user.isBot && <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 800, color: CYAN }}>BOT</span>}
                      {['CANCELLED', 'DECLINED', 'NO_SHOW'].includes(p.status) && <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 800, color: RED }}>İPTAL</span>}
                    </p>
                    {p.user.email && <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED }}>{p.user.email}</p>}
                  </button>
                  <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                    <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, whiteSpace: 'nowrap' }}>OCEAN {oceanAvg(p.user.oceanScore)}</span>
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

          {/* Onayla */}
          {selected.status === 'PENDING' && (
            <button
              onClick={approve}
              disabled={approving}
              style={{
                display: 'block', width: '100%', boxSizing: 'border-box', padding: '9px', borderRadius: 8, cursor: approving ? 'not-allowed' : 'pointer',
                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                fontSize: 13, fontWeight: 600, color: GREEN, fontFamily: SANS,
                opacity: approving ? 0.5 : 1,
              }}
            >
              {approving ? 'Onaylanıyor…' : '✓ Masayı Onayla'}
            </button>
          )}

          {/* Bot yerleştir */}
          {isSuperadmin && selected.status !== 'CANCELLED' && selected.status !== 'COMPLETED' && (() => {
            const active = selected.participants.filter(p => !['CANCELLED', 'DECLINED', 'NO_SHOW'].includes(p.status));
            const emptySeats = selected.maxParticipants - active.length;
            const available = bots;
            return (
              <div>
                <p style={{ margin: '0 0 8px', ...LABEL, color: MUTED }}>
                  BOT YERLEŞTİR ({emptySeats > 0 ? `${emptySeats} boş sandalye` : 'boş sandalye yok'})
                </p>
                {emptySeats > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 8, minWidth: 0, maxWidth: '100%' }}>
                    <AdminSelect
                      value={botToPlace}
                      onChange={setBotToPlace}
                      placeholder={available.length ? 'Bot seçin (eksik cinsiyet)' : 'Uygun bot yok'}
                      title="Bot seç"
                      style={{ flex: 1, width: 'auto', minWidth: 0 }}
                      options={available.map(b => ({ value: b.id, label: `${b.name || b.id} (${b.gender === 'MALE' ? 'E' : 'K'}${b.age !== null ? `, ${b.age}` : ''})` }))}
                    />
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
            <p style={{ margin: '0 0 8px', ...LABEL, color: MUTED }}>
              SOHBET GEÇMİŞİ ({chat.length}{chat.some(m => m.reportCount > 0) ? ` · ${chat.filter(m => m.reportCount > 0).length} şikayetli` : ''})
            </p>
            {chat.length === 0 ? (
              <p style={{ margin: 0, fontSize: 11, color: MUTED }}>Mesaj yok</p>
            ) : (
              <div
                ref={chatBoxRef}
                style={{
                  display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: 6,
                  height: 'min(60vh, 500px)', overflowY: 'auto', overflowX: 'hidden', minWidth: 0,
                  width: '100%', maxWidth: '100%', boxSizing: 'border-box',
                  padding: 8, borderRadius: 10, background: BG, border: `1px solid ${BORDER}`,
                }}
              >
                {[...chat].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(m => (
                  <div
                    key={m.id}
                    style={{
                      padding: '8px 10px', borderRadius: 8, flexShrink: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0, overflowWrap: 'anywhere',
                      background: m.reportCount > 0 ? 'rgba(239,68,68,0.08)' : SURFACE,
                      border: `1px solid ${m.reportCount > 0 ? 'rgba(239,68,68,0.3)' : BORDER}`,
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3, minWidth: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: TEXT, minWidth: 0, overflowWrap: 'anywhere' }}>
                        {m.senderName ?? m.senderInitials}
                        {m.senderIsBot && <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 800, color: CYAN }}>BOT</span>}
                      </span>
                      <span style={{ fontSize: 9, color: MUTED, fontFamily: MONO, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {new Date(m.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: m.deletedAt ? MUTED : TEXT, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {m.content}
                    </p>
                    {(m.deletedAt || m.reportCount > 0) && (
                      <p style={{ margin: '4px 0 0', fontSize: 9, color: m.reportCount > 0 ? RED : MUTED }}>
                        {m.deletedAt ? 'Kullanıcı tarafında silindi' : ''}
                        {m.deletedAt && m.reportCount > 0 ? ' · ' : ''}
                        {m.reportCount > 0
                          ? `${m.reportCount} şikayet: ${m.reports.map(r => `${r.reporterInitials} (${new Date(r.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})`).join(', ')}`
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
              <p style={{ margin: '0 0 8px', ...LABEL, color: MUTED }}>
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
                fontSize: 13, fontWeight: 600, color: RED, fontFamily: SANS,
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
            className="ll-card" style={{ width: '100%', maxWidth: 320, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Masayı iptal et</p>
              <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
                {selected && fmtDate(selected.scheduledAt)} tarihli masa iptal edilecek. Bu işlem geri alınamaz.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setCancelConfirm(false)}
                style={{ flex: 1, padding: '9px', borderRadius: 8, background: 'transparent', border: `1px solid ${BORDER}`, fontSize: 13, color: MUTED, cursor: 'pointer', fontFamily: SANS }}
              >Vazgeç</button>
              <button
                onClick={cancelMeeting}
                disabled={cancelling}
                style={{
                  flex: 1, padding: '9px', borderRadius: 8, cursor: cancelling ? 'not-allowed' : 'pointer',
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                  fontSize: 13, fontWeight: 600, color: RED, fontFamily: SANS,
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
            className="ll-card" style={{ width: '100%', maxWidth: 360, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: 16 }}
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
                    ...LABEL,
                    padding: '2px 8px', borderRadius: 99,
                    background: userModal.status === 'ACTIVE' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: userModal.status === 'ACTIVE' ? GREEN : RED,
                    border: `1px solid ${userModal.status === 'ACTIVE' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}>
                    {userModal.status === 'ACTIVE' ? 'Aktif' : userModal.status === 'SUSPENDED' ? 'Askıda' : 'Silinmiş'}
                  </span>
                  <span style={{
                    ...LABEL,
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
                      ...LABEL,
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
                  <p style={{ margin: 0, ...LABEL, color: MUTED }}>HESAP İŞLEMLERİ</p>
                  {canSanction(userModal) ? (<>
                  {userModal.status !== 'SUSPENDED' && (
                    <AdminSelect
                      value={sanctionReason}
                      onChange={setSanctionReason}
                      placeholder="Askı sebebi (boşsa: Yönetici kararı)"
                      title="Askı sebebi"
                      options={[{ value: '', label: 'Yönetici kararı' }, ...sanctionReasons.map(x => ({ value: x, label: x }))]}
                    />
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
                    <span style={{ ...LABEL, color: MUTED }}>KİŞİLİK TESTİ</span>
                    <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                      Son test: {new Date(userModal.oceanScore.completedAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}
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
                    <p style={{ margin: 0, ...LABEL, color: MUTED }}>KYC</p>
                    <button
                      onClick={userApproveKyc}
                      disabled={!!userAction}
                      style={{
                        padding: '9px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                        fontSize: 13, fontWeight: 600, color: GREEN, cursor: 'pointer', fontFamily: SANS,
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
                  <p style={{ margin: 0, ...LABEL, color: MUTED }}>ÜCRETSİZ ABONELİK VER</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <AdminSelect
                      value={grantPlan}
                      onChange={setGrantPlan}
                      placeholder="Paket seç…"
                      title="Paket seç"
                      style={{ flex: 1, width: 'auto', minWidth: 0 }}
                      options={[
              { value: 'MASADA', label: 'Masada' }, { value: 'KARSIMDA', label: 'Karşımda' },
              { value: 'ICERDE', label: 'İçerde' }, { value: 'KANKAMLA', label: 'Kankamla' },
            ]}
                    />
                    <button
                      onClick={userGrantSubscription}
                      disabled={!!userAction || !grantPlan}
                      style={{
                        padding: '7px 16px', borderRadius: 8, cursor: (!!userAction || !grantPlan) ? 'not-allowed' : 'pointer',
                        background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                        fontSize: 13, fontWeight: 600, color: BLUE, fontFamily: SANS,
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
