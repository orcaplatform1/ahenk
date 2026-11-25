'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { myRole, myId } from '@/lib/adminRole';
import { AdminUserEdit } from '@/components/AdminUserEdit';
import { AdminSanctionHistory } from '@/components/AdminSanctionHistory';
import { AdminNoShowWarnings, type NoShowReportItem, type NoShowWarningInfo } from '@/components/AdminNoShowWarnings';
import { BG, SURFACE, BORDER, TEXT, MUTED, RED, GREEN, AMBER, BLUE, CYAN, SANS, MONO, LABEL } from '@/lib/adminTheme';
import { AdminSelect } from '@/components/AdminSelect';
import { AdminUserPhoto } from '@/components/AdminUserPhoto';
import { AdminNoShowDetail } from '@/components/AdminNoShowDetail';
import { AdminSuspendButtons } from '@/components/AdminSuspendButtons';

// Yaptırım yetkisi (backend assertCanSanction ile aynı kural)
function canSanction(target: { id: string; role: string }): boolean {
  const meId = myId();
  if (!meId) return false;
  // Kendi hesabını yalnız SUPERADMIN düzenler
  if (meId === target.id) return myRole() === 'SUPERADMIN';
  return (target.role !== 'ADMIN' && target.role !== 'SUPERADMIN') || myRole() === 'SUPERADMIN';
}

interface MeetingRow {
  id: string;
  title: string;
  type: 'GROUP' | 'ONE_ON_ONE' | 'KANKA';
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
  photoUrl?: string | null;
  user: {
    id: string; email: string; phone?: string | null; isBot?: boolean;
    profile: { firstName: string; lastName: string; city: string | null; gender?: string | null } | null;
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
const TYPE_LABEL: Record<string, string> = { GROUP: 'Grup', ONE_ON_ONE: 'Baş Başa', KANKA: 'Kankamla' };

// Sekmeler masa durum alanından: PENDING → Bekleyen, ACTIVE → Aktif, COMPLETED → Geçmiş, CANCELLED → İptal
type StatusTab = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
const STATUS_TABS: [StatusTab, string][] = [['PENDING', 'Bekleyen'], ['ACTIVE', 'Aktif'], ['COMPLETED', 'Geçmiş'], ['CANCELLED', 'İptal']];
const TYPE_FILTERS = [{ value: '', label: 'Tümü' }, { value: 'GROUP', label: 'Grup' }, { value: 'ONE_ON_ONE', label: 'Baş Başa' }, { value: 'KANKA', label: 'Kankamla' }];

// Gün başlığı "18 Kas 2026" ve saat "20:00" (TR saati)
const dayLabel = (d: string) => new Date(d).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', year: 'numeric' });
const timeLabel = (d: string) => new Date(d).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });

// Liste tarihe göre gruplanır; gün içi saat artan. Sunucu sırası günlerin sırasını belirler (Bekleyen/Aktif en yakın, Geçmiş/İptal en yeni üstte)
function groupByDay(rows: MeetingRow[]) {
  const groups: { day: string; rows: MeetingRow[] }[] = [];
  for (const m of rows) {
    const day = dayLabel(m.scheduledAt);
    const g = groups.find(x => x.day === day);
    if (g) g.rows.push(m); else groups.push({ day, rows: [m] });
  }
  for (const g of groups) g.rows.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return groups;
}
const PLAN_LABEL: Record<string, string> = { MASADA: 'Masada', KARSIMDA: 'Karşımda', ICERDE: 'İçerde', KANKAMLA: 'Kankamla', PRIME_1M: 'Premium 1 Aylık', PRIME_3M: 'Premium 3 Aylık', PRIME_6M: 'Premium 6 Aylık', PRIME_12M: 'Premium 12 Aylık' };

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function oceanAvg(o: OceanScore | null) {
  if (!o) return '—';
  return ((o.openness + o.conscientiousness + o.extraversion + o.agreeableness + o.neuroticism) / 5).toFixed(0);
}

export default function AdminMatches() {
  const [items, setItems] = useState<MeetingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('PENDING');
  const [typeFilter, setTypeFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
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
  const [noShowFor, setNoShowFor] = useState<string | null>(null); // GELMEDİ detayı açık katılımcı
  const [userLoading, setUserLoading] = useState(false);
  const [userAction, setUserAction] = useState<string | null>(null);
  const [sanctionReasons, setSanctionReasons] = useState<string[]>([]);
  const [sanctionReason, setSanctionReason] = useState('');
  const [grantPlan, setGrantPlan] = useState('');

  // silent: yükleme iskeleti göstermeden yeniler (detay penceresindeki değişiklikten sonra)
  const load = useCallback((silent?: boolean) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25', status: statusTab });
    if (statusTab === 'PENDING' || statusTab === 'ACTIVE') params.set('order', 'asc');
    if (typeFilter) params.set('type', typeFilter);
    if (cityFilter) params.set('cityId', cityFilter);
    api.get<ListResponse>(`/admin/meetings?${params}`)
      .then(r => { setItems(r.items ?? []); setTotal(r.total ?? 0); })
      .catch((e: Error) => setError(e.message))
      .finally(() => { if (!silent) setLoading(false); });
  }, [statusTab, typeFilter, cityFilter, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get<{ id: string; name: string }[]>('/admin/cities').then(c => setCities(Array.isArray(c) ? c : [])).catch(() => {}); }, []);
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
      load(true);
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
      load(true);
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
      load(true);
    } catch (e) { setError((e as Error).message); }
    finally { setPlacingBot(false); }
  }

  async function removeParticipant(userId: string) {
    if (!selected) return;
    setRemoving(userId);
    try {
      await api.delete(`/admin/meetings/${selected.id}/participants/${userId}`);
      setSelected(s => s ? { ...s, participants: s.participants.filter(p => p.userId !== userId) } : null);
      load(true);
    } catch (e) { setError(`Katılımcı çıkarılamadı: ${(e as Error).message}`); }
    finally { setRemoving(null); }
  }

  async function cancelMeeting() {
    if (!selected) return;
    setCancelling(true);
    try {
      await api.delete(`/admin/meetings/${selected.id}`);
      setSelected(s => s ? { ...s, status: 'CANCELLED' } : null);
      load(true);
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
  // Askı tek model: 3 gün / 15 gün / 1 ay; kullanıcı durumu değişmez (giriş açık), şablon push gider
  async function suspendUser(days: 3 | 15 | 30, reasonOverride?: string) {
    if (!userModal) return;
    if (!confirm(`Kullanıcı ${days === 30 ? '1 ay' : `${days} gün`} askıya alınsın mı?`)) return;
    setUserAction('SUSPENDED');
    try {
      await api.post(`/admin/users/${userModal.id}/sanction`, { type: 'SUSPENSION', days, reason: reasonOverride ?? (sanctionReason || 'Yönetici kararı') });
      refreshUser(userModal.id);
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
      {noShowFor && selected && (() => {
        const p = selected.participants.find(x => x.userId === noShowFor);
        if (!p) return null;
        const nameOf = (id: string) => { const q = selected.participants.find(x => x.userId === id)?.user.profile; return q ? `${q.firstName} ${q.lastName}` : '—'; };
        return (
          <AdminNoShowDetail meetingId={selected.id} onClose={() => setNoShowFor(null)}
            user={{ id: p.user.id, name: p.user.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : p.user.email, photoUrl: p.photoUrl ?? null, gender: p.user.profile?.gender }}
            reports={selected.noShowReports.filter(r => r.reportedId === p.userId).map(r => ({ reporterName: nameOf(r.reporterId), createdAt: r.createdAt }))} />
        );
      })()}

      <div style={{ marginBottom: 24 }}>
        <h1 className="ll-title">Masalar</h1>
        {withoutVenue > 0 && (
          <p style={{ margin: '8px 0 0', padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>
            ⚠ Mekânsız masa: {withoutVenue}
          </p>
        )}
      </div>

      {/* Durum sekmeleri */}
      <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {STATUS_TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={statusTab === key}
            onClick={() => { setStatusTab(key); setPage(1); }}
            style={{
              padding: '7px 16px', borderRadius: 99, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: SANS,
              background: statusTab === key ? 'rgba(59,130,246,0.15)' : 'transparent',
              border: `1px solid ${statusTab === key ? 'rgba(59,130,246,0.45)' : BORDER}`,
              color: statusTab === key ? '#93c5fd' : MUTED,
            }}
          >{label}</button>
        ))}
      </div>

      {/* Filtreler: Tip ve Şehir */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 160 }}>
          <AdminSelect
            value={typeFilter}
            onChange={v => { setTypeFilter(v); setPage(1); }}
            placeholder="Tip: Tümü"
            title="Tip"
            options={TYPE_FILTERS}
          />
        </div>
        <div style={{ width: 180 }}>
          <AdminSelect
            value={cityFilter}
            onChange={v => { setCityFilter(v); setPage(1); }}
            placeholder="Şehir: Tümü"
            title="Şehir"
            options={[{ value: '', label: 'Tümü' }, ...cities.map(c => ({ value: c.id, label: c.name }))]}
          />
        </div>
      </div>

      {error && !selected && <p style={{ margin: '0 0 16px', fontSize: 13, color: RED }}>{error}</p>}

      {/* Liste: güne göre gruplu, her masa tek satır */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
        {loading
          ? [0, 1, 2, 3].map(i => <div key={i} style={{ height: 44, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />)
          : items.length === 0
            ? (
              <div className="ll-card" style={{ padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>Masa yok</p>
              </div>
            )
            : groupByDay(items).map(g => (
              <div key={g.day}>
                <p style={{ margin: '0 0 8px', ...LABEL, color: MUTED }}>{g.day}</p>
                <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
                  {g.rows.map((m, i) => {
                    const st = STATUS_CFG[m.status] ?? STATUS_CFG.PENDING;
                    return (
                      <button
                        key={m.id}
                        onClick={() => openDetail(m)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 44, padding: '10px 16px',
                          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: SANS,
                          borderBottom: i < g.rows.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none',
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
                        <span style={{ fontSize: 12, color: MUTED, fontFamily: MONO, flexShrink: 0 }}>{timeLabel(m.scheduledAt)}</span>
                        <span style={{ fontSize: 12, color: MUTED, flexShrink: 0 }}>{m._count.participants} kişi</span>
                        <span style={{ ...LABEL, padding: '2px 7px', borderRadius: 99, background: st.bg, border: `1px solid ${st.border}`, color: st.color, flexShrink: 0 }}>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
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

      {/* Detay: ortada modal */}
      {(detailLoading || selected) && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="ll-card"
            style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: 20 }}
            onClick={e => e.stopPropagation()}
          >
          {detailLoading && [0, 1, 2].map(i => <div key={i} style={{ height: 36, background: SURFACE, borderRadius: 6, opacity: 0.5 }} />)}
          {selected && !detailLoading && (<>
          {error && <p style={{ margin: 0, fontSize: 13, color: RED }}>{error}</p>}

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
              <button onClick={() => setSelected(null)} aria-label="Kapat" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: MUTED, padding: 4, minWidth: 44, minHeight: 44 }}>✕</button>
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
                placeholder={venueOptions.length ? 'Mekan seç' : 'Uygun mekan yok'}
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
                  {/* Katılımcı kartı: profil fotoğrafı (büyür, "Sil"), ad soyad, telefon, "Detay" (tüm bilgiler). Gelmeyende kırmızı GELMEDİ */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 200px', minWidth: 0 }}>
                    <AdminUserPhoto userId={p.user.id} photoUrl={p.photoUrl} gender={p.user.profile?.gender} size={44}
                      initials={`${p.user.profile?.firstName?.[0] ?? ''}${p.user.profile?.lastName?.[0] ?? ''}`.toLocaleUpperCase('tr-TR') || '?'}
                      onDeleted={() => setSelected(s => s ? { ...s, participants: s.participants.map(x => x.userId === p.userId ? { ...x, photoUrl: null } : x) } : null)} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT, overflowWrap: 'anywhere' }}>
                        {p.user.profile ? `${p.user.profile.firstName} ${p.user.profile.lastName}` : p.user.email}
                        {p.user.isBot && <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 800, color: CYAN }}>BOT</span>}
                        {(p.status === 'NO_SHOW' || selected.noShowReports.some(r => r.reportedId === p.userId)) ? (
                          <button type="button" onClick={() => setNoShowFor(p.userId)}
                            style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 99, border: 'none', background: RED, color: '#fff', fontSize: 9, fontWeight: 800, cursor: 'pointer', fontFamily: SANS }}>
                            GELMEDİ
                          </button>
                        ) : ['CANCELLED', 'DECLINED'].includes(p.status) && <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 800, color: RED }}>İPTAL</span>}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: MUTED }}>{p.user.phone ?? '—'}</p>
                      <button type="button" onClick={() => openUser(p.user.id)}
                        style={{ marginTop: 4, padding: '2px 10px', borderRadius: 99, border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
                        Detay
                      </button>
                    </div>
                  </div>
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
                  BOT YERLEŞTİR ({emptySeats > 0 ? `${emptySeats} boş koltuk` : 'boş koltuk yok'})
                </p>
                {emptySeats > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 8, minWidth: 0, maxWidth: '100%' }}>
                    <AdminSelect
                      value={botToPlace}
                      onChange={setBotToPlace}
                      placeholder={available.length ? 'Bot seç (eksik cinsiyet)' : 'Uygun bot yok'}
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
          </>)}
          </div>
        </div>
      )}

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
                  onSuspend={(days) => suspendUser(days, 'Masaya katılım sağlamama')}
                />

                {/* Yaptırım geçmişi */}
                <AdminSanctionHistory userId={userModal.id} canAct={canSanction(userModal)} onChanged={() => refreshUser(userModal.id)} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                  <p style={{ margin: 0, ...LABEL, color: MUTED }}>HESAP İŞLEMLERİ</p>
                  {canSanction(userModal) ? (<>
                  {(
                    <AdminSelect
                      value={sanctionReason}
                      onChange={setSanctionReason}
                      placeholder="Askı sebebi (boşsa: Yönetici kararı)"
                      title="Askı sebebi"
                      options={[{ value: '', label: 'Yönetici kararı' }, ...sanctionReasons.map(x => ({ value: x, label: x }))]}
                    />
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <AdminSuspendButtons busy={!!userAction} onPick={(d) => suspendUser(d)} />
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
                    <p style={{ margin: 0, fontSize: 11, color: MUTED, fontFamily: SANS }}>Bu hesaba işlem yetkin yok</p>
                  )}
                </div>

                {/* Kişilik testi kilidi */}
                {userModal.oceanScore && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ ...LABEL, color: MUTED }}>KİŞİLİK TESTİ</span>
                    <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                      Son test: {new Date(userModal.oceanScore.completedAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}
                      {userModal.oceanScore.adminCanReset ? ' · Kilit açık, kullanıcı testi yeniden yapabilir' : ' · 6 ay kilitli'}
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
              { value: 'PRIME_1M', label: 'Premium 1 Aylık' }, { value: 'PRIME_3M', label: 'Premium 3 Aylık' },
              { value: 'PRIME_6M', label: 'Premium 6 Aylık' }, { value: 'PRIME_12M', label: 'Premium 12 Aylık' },
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
