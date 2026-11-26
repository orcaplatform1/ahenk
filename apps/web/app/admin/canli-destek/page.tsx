'use client';

// Canlı Destek (yönetim paneli). Temsilci (SUPPORT), ADMIN ve SUPERADMIN görür.
// Sohbetler: 3 sütun — sol: sıradaki ve açık sohbetler, orta: aktif sohbet, sağ: Haiku asistanı.
// Hazır Yanıtlar, Raporlar ve Temsilciler (liste, durum, mola geçmişi): ADMIN + SUPERADMIN; temsilci hesabı açma / kapama, Tüm Sohbetler,
// Kısıtlamalar, Haiku Kayıtları: yalnız SUPERADMIN.
// Temsilci kullanıcı hakkında Haiku dışında veri görmez (yalnız ad / mekân adı, konu, bekleme süresi).
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, API_PREFIX, langHeaders } from '@/lib/api';
import { myRole } from '@/lib/adminRole';
import { DetayAvatar } from '@ahenk/ui';
import { AMBER as GOLD } from '@/components/paket/PaketKarti';
// Mekân sahibi avatarı: Premium / Nasıl Çalışır 3 aylık kutu altını (#e0a526) çerçeve + aynı altının cinsiyet zemini gibi hafif tonu
const VENUE_RING = { color: GOLD, bg: 'rgba(224,165,38,0.12)' };
import { AdminConfirm } from '@/components/AdminConfirm';
import { AttachIcon, AutoTextarea, EmojiIcon, SendIcon, StatusPill } from '@/components/support/ChatParts';
import { BG, SURFACE, CARD, BORDER, TEXT, MUTED, RED, GREEN, AMBER, BLUE, SANS, MONO, LABEL } from '@/lib/adminTheme';

type Sender = 'USER' | 'AGENT' | 'SYSTEM';
// Kullanıcı avatarı (Masa Kuruldu DetayAvatar): onaylı fotoğraf ya da baş harfler, cinsiyet renkli çerçeve; mekânda cinsiyet / foto yok
interface Avatar { initials: string; gender: string | null; photoUrl: string | null }
interface Row { id: string; status: string; topic: string; requesterName: string; kind: 'user' | 'venue'; avatar: Avatar | null; queuedAt: string; assignedAt: string | null; agentNo: string | null; unread: number; userTyping?: boolean }
// assignable: yalnız Temsilci (SUPPORT) atama alır; ADMIN / SUPERADMIN ekranında durum seçimi ve mola şeridi yok
interface AgentState { me: { userId: string; role: string; agentNo: string; status: 'ONLINE' | 'BREAK' | 'OFFLINE'; breakStartedAt: string | null; assignable?: boolean }; maxChats: number; queue: Row[]; mine: Row[]; others: Row[]; onlineAgents: { userId: string; agentNo: string }[] }
interface Msg { id: string; sender: Sender; agentNo: string | null; content: string; images: string[]; createdAt: string }
interface ChatDetail {
  id: string; status: string; topic: string; requesterName: string; kind: 'user' | 'venue'; avatar?: Avatar | null; queuedAt: string; agentNo: string | null; mine: boolean; takenOver?: boolean;
  closedAt: string | null; userReadAt: string | null; userTyping: boolean; userOnline: boolean; userDraft: string; messages: Msg[];
  notes: { id: string; agentNo: string; content: string; createdAt: string }[];
  transfers: { id: string; from: string | null; to: string | null; note: string; createdAt: string }[];
}
interface Canned { id: string; title: string; content: string }
// Haiku sorgu kaydı: istek türü, sonuç ve hata türü (başarısız istekler de yazılır)
interface AiLog { id: string; agentNo: string; chatId?: string; question: string; tools: string[]; requestType: string; success: boolean; errorType: string | null; createdAt: string }
const AI_TYPE: Record<string, string> = { QUESTION: 'Soru', DRAFT: 'AI taslak' };
const AI_ERROR: Record<string, string> = { NO_KEY: 'anahtar yok', TIMEOUT: 'zaman aşımı', MODEL_ERROR: 'model hatası', CONNECTION_ERROR: 'bağlantı hatası', INTERNAL_ERROR: 'sunucu hatası' };
const aiResult = (l: { success: boolean; errorType: string | null }) => (l.success ? 'Başarılı' : `Başarısız${l.errorType ? ` · ${AI_ERROR[l.errorType] ?? l.errorType}` : ''}`);

const TOPIC: Record<string, string> = { ACCOUNT: 'Hesap', PAYMENT: 'Ödeme', MEETING: 'Masa', OTHER: 'Diğer' };
// Çevrimiçi / Çevrimdışı seçimi; mola tek butonla (Molaya Çık / Moladan Dön)
const STATUS: [AgentState['me']['status'], string, string][] = [['ONLINE', 'Çevrimiçi', GREEN], ['OFFLINE', 'Çevrimdışı', MUTED]];
const AGENT_STATUS: Record<string, string> = { ONLINE: 'Çevrimiçi', BREAK: 'Molada', OFFLINE: 'Çevrimdışı' };
const sinceMin = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
const REASON_MIN = 5; // kötüye kullanım sebebi: boşluklar hariç en az 5 karakter
const SYS: Record<string, string> = {
  NOTICE: "Hizmet kalitesinin artırılması ve güvenliğin için görüşmelerimiz kayıt altına alınır. Kişisel verilerinle ilgili Aydınlatma Metni'ni inceleyebilirsin.",
  GREETING: 'Merhaba, ben Ahenk müşteri temsilcisiyim. Bugün size yardımcı olmaktan mutluluk duyacağım.',
  TRANSFERRED: 'Görüşmen başka bir temsilcimize aktarıldı, durumu baştan anlatmana gerek yok.',
  IDLE_WARNING: '1 dakika içinde yanıt vermezsen sohbet sonlanacak.',
};
const EMOJIS = ['😀', '😊', '🙏', '👍', '🙌', '🎉', '❤️', '✨', '😉', '🤗', '👋', '😇'];

const hm = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
const dt = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
function waited(iso: string) { const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000)); return s < 60 ? `${s} sn` : s < 3600 ? `${Math.floor(s / 60)} dk` : `${Math.floor(s / 3600)} sa ${Math.floor((s % 3600) / 60)} dk`; }
const fmtMin = (n: number | null) => (n === null ? '—' : `${n.toFixed(1)} dk`);
const TAKEN_OVER = 'Bu sohbet SUPERADMIN tarafından devralındı.';
const imgUrl = (chatId: string, f: string) => `${API_PREFIX}/admin/live-support/chats/${chatId}/images/${f}`;

// Mesaj kutusu ikon butonu (kullanıcı ekranıyla aynı: 44 px, palet kırmızısı)
const ICON_BTN: React.CSSProperties = { width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' };
const RED_ICON = '#c0392b';
const btn = (color: string, filled = false): React.CSSProperties => ({ minHeight: 36, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: SANS, cursor: 'pointer', color: filled ? '#fff' : color, background: filled ? color : 'transparent', border: `1px solid ${color}` });
const inputStyle: React.CSSProperties = { background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: TEXT, fontFamily: SANS, outline: 'none' };

// Sesli uyarı (yeni sohbet / yeni mesaj): Web Audio kısa ton
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.36); o.onended = () => ctx.close();
  } catch { /* ses çalınamadı */ }
}

type Tab = 'chats' | 'all' | 'canned' | 'reports' | 'agents' | 'restrictions' | 'ai';

export default function CanliDestekAdmin() {
  const role = myRole();
  const tabs: [Tab, string][] = [
    ['chats', 'Sohbetler'],
    ...(role === 'SUPERADMIN' ? ([['all', 'Tüm Sohbetler']] as [Tab, string][]) : []),
    ...(role === 'ADMIN' || role === 'SUPERADMIN' ? ([['canned', 'Hazır Yanıtlar'], ['reports', 'Raporlar'], ['agents', 'Temsilciler']] as [Tab, string][]) : []),
    ...(role === 'SUPERADMIN' ? ([['restrictions', 'Kısıtlamalar'], ['ai', 'Haiku Kayıtları']] as [Tab, string][]) : []),
  ];
  const [tab, setTab] = useState<Tab>('chats');
  return (
    <div className="adm-page" style={{ fontFamily: SANS, color: TEXT, padding: 16 }}>
      <h1 className="ll-title" style={{ marginBottom: 12 }}>Canlı Destek</h1>
      {tabs.length > 1 && (
        <div role="tablist" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {tabs.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === k ? 'rgba(34,211,238,0.1)' : 'transparent', border: `1px solid ${tab === k ? 'rgba(34,211,238,0.3)' : BORDER}`, color: tab === k ? '#22d3ee' : MUTED }}>{l}</button>
          ))}
        </div>
      )}
      {tab === 'chats' && <ChatsTab />}
      {tab === 'all' && <AllChatsTab />}
      {tab === 'canned' && <CannedTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'agents' && <AgentsTab superadmin={role === 'SUPERADMIN'} />}
      {tab === 'restrictions' && <RestrictionsTab />}
      {tab === 'ai' && <AiLogsTab />}
    </div>
  );
}

// ─── Sohbetler ─────────────────────────────────────────────────────────────

function ChatsTab() {
  const [st, setSt] = useState<AgentState | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [takenOver, setTakenOver] = useState<Set<string>>(new Set());
  const [err, setErr] = useState('');
  const prev = useRef<{ mine: Set<string>; unread: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await api.get<AgentState>('/admin/live-support/state');
      const mine = new Set(s.mine.map((c) => c.id));
      const unread = s.mine.reduce((n, c) => n + c.unread, 0);
      if (prev.current && ([...mine].some((id) => !prev.current!.mine.has(id)) || unread > prev.current.unread)) beep();
      prev.current = { mine, unread };
      setSt(s); setErr('');
    } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 3000); return () => clearInterval(id); }, [load]);

  async function setStatus(status: AgentState['me']['status']) {
    try { await api.patch('/admin/live-support/status', { status }); load(); } catch (e) { setErr((e as Error).message); }
  }
  // Molaya Çık onaylı; Moladan Dön onaysız
  const [breakAsk, setBreakAsk] = useState(false);

  if (!st) return <p style={{ color: MUTED, fontSize: 13 }}>{err || 'Yükleniyor…'}</p>;
  const superadmin = st.me.role === 'SUPERADMIN';
  const list = (title: string, rows: Row[], showAgent = false) => (
    <div style={{ marginBottom: 14 }}>
      <p style={{ ...LABEL, color: MUTED, marginBottom: 6 }}>{title} ({rows.length})</p>
      {rows.length === 0 && <p style={{ fontSize: 12, color: MUTED }}>—</p>}
      {rows.map((r) => (
        <button key={r.id} onClick={() => setSel(r.id)} style={{ width: '100%', textAlign: 'left', marginBottom: 6, padding: '9px 10px', borderRadius: 10, cursor: r.status === 'QUEUED' && !superadmin ? 'default' : 'pointer', background: sel === r.id ? 'rgba(59,130,246,0.15)' : CARD, border: `1px solid ${sel === r.id ? 'rgba(59,130,246,0.35)' : BORDER}`, color: TEXT }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DetayAvatar ring={r.kind === 'venue' ? VENUE_RING : undefined} participant={r.avatar ?? {}} delay={0} size={36} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.requesterName}</span>
            {r.unread > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: RED, color: '#fff' }}>{r.unread}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 11, color: MUTED, flexWrap: 'wrap' }}>
            <span style={{ padding: '1px 7px', borderRadius: 99, border: `1px solid ${BORDER}` }}>{TOPIC[r.topic]}</span>
            <span>{r.kind === 'venue' ? 'Mekân' : 'Üye'}</span>
            <span>· {waited(r.queuedAt)}</span>
            {showAgent && r.agentNo && <span>· Temsilci No {r.agentNo}</span>}
            {r.userTyping && <span style={{ color: RED, fontStyle: 'italic' }}>· yazıyor…</span>}
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <div className="ll-card" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12, padding: '10px 14px' }}>
        <span style={{ fontSize: 13 }}>Temsilci No: <strong style={{ fontFamily: MONO }}>{st.me.agentNo}</strong></span>
        <span style={{ fontSize: 12, color: MUTED }}>Eşzamanlı sınır: {st.maxChats}</span>
        {st.me.assignable && <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {st.me.status === 'BREAK'
            ? <button style={btn(AMBER, true)} onClick={() => setStatus('ONLINE')}>Moladan Dön</button>
            : st.me.status === 'ONLINE' && <button style={btn(AMBER)} onClick={() => setBreakAsk(true)}>Molaya Çık</button>}
          {STATUS.map(([k, l, c]) => (
            <button key={k} onClick={() => setStatus(k)} aria-pressed={st.me.status === k} style={{ ...btn(c, st.me.status === k), color: st.me.status === k ? '#020c1b' : c }}>{l}</button>
          ))}
        </div>}
      </div>
      {st.me.assignable && st.me.status === 'BREAK' && (
        <div role="status" style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', color: AMBER, fontSize: 13, fontWeight: 600 }}>
          Moladasın{st.me.breakStartedAt ? ` · ${sinceMin(st.me.breakStartedAt)} dk` : ''}
        </div>
      )}
      <AdminConfirm open={breakAsk} text="Molaya çıkmak istediğinden emin misin?" onNo={() => setBreakAsk(false)} onYes={() => { setBreakAsk(false); setStatus('BREAK'); }} />
      {err && <p style={{ color: RED, fontSize: 12, marginBottom: 8 }}>{err}</p>}
      <div className="cd-grid" style={{ display: 'grid', gap: 12 }}>
        <style>{`.cd-grid{grid-template-columns:1fr}@media(min-width:1100px){.cd-grid{grid-template-columns:260px minmax(0,1fr) 340px}}`}</style>
        <aside className="ll-card" style={{ padding: 12, maxHeight: '78vh', overflowY: 'auto' }}>
          {list('Sıradakiler', st.queue)}
          {list('Açık Sohbetlerim', st.mine)}
          {/* ADMIN salt okunur izler, SUPERADMIN devralabilir */}
          {(superadmin || st.me.role === 'ADMIN') && list('Diğer Açık Sohbetler', st.others, true)}
        </aside>
        {sel ? <ChatColumn key={sel} id={sel} st={st} reload={load} onClosed={() => setSel(null)} onTakenOver={() => setTakenOver((p) => (p.has(sel) ? p : new Set(p).add(sel)))} /> : (
          <div className="ll-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><p style={{ color: MUTED, fontSize: 13 }}>Soldan bir sohbet seç.</p></div>
        )}
        {/* SUPERADMIN devraldıysa eski temsilcide Haiku asistanı kapanır */}
        {/* Haiku: devralınan sohbette ve SUPERADMIN'in izlediği (Devral etmediği) sohbette kapalı */}
        {sel && !takenOver.has(sel) && !(superadmin && !st.mine.some((r) => r.id === sel)) ? <HaikuPanel chatId={sel} onInsert={(t) => window.dispatchEvent(new CustomEvent('cd-insert', { detail: t }))} /> : <div className="ll-card" />}
      </div>
    </div>
  );
}

function ChatColumn({ id, st, reload, onClosed, onTakenOver }: { id: string; st: AgentState; reload: () => void; onClosed: () => void; onTakenOver: () => void }) {
  const [c, setC] = useState<ChatDetail | null>(null);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [canned, setCanned] = useState<Canned[]>([]);
  const [emoji, setEmoji] = useState(false);
  const [note, setNote] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferNote, setTransferNote] = useState('');
  // Kötüye kullanım: gün seçimi (tek) + sebep (boşluklar hariç en az 5 karakter) → Kısıtla → onay
  const [abuseDays, setAbuseDays] = useState<number | null>(null);
  const [abuseReason, setAbuseReason] = useState('');
  // Onay penceresi: 0 = Sonlandır, 1 / 7 / 30 = kötüye kullanım gün sayısı; null = kapalı
  const [confirm, setConfirm] = useState<number | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingAt = useRef(0);
  const count = useRef(0);
  // Atanmış temsilci: kullanıcının yazıyor bilgisi ve gönderilmemiş yazı önizlemesi 300 ms aralıkla (sunucuda yalnız bellekte)
  const [live, setLive] = useState<{ userTyping: boolean; userDraft: string } | null>(null);
  const liveOn = !!c && c.mine && c.status === 'ACTIVE' && !c.takenOver;
  useEffect(() => {
    if (!liveOn) { setLive(null); return; }
    let stop = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try { const r = await api.get<{ userTyping: boolean; userDraft: string }>(`/admin/live-support/chats/${id}/typing`); if (!stop) setLive(r); } catch { /* sonraki yoklamada */ }
      if (!stop) timer = setTimeout(poll, 300);
    };
    poll();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [liveOn, id]);
  const draft = live ? live.userDraft : c?.userDraft ?? '';
  useEffect(() => { if (draft) listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [draft]);

  const loaded = useRef(false);
  const cb = useRef({ onClosed, onTakenOver });
  cb.current = { onClosed, onTakenOver };
  // SUPERADMIN devraldıysa: Temsilci (SUPPORT) yalnız { takenOver: true } alır, elindeki son hâl salt okunur kalır (403 gösterilmez);
  // sohbet ilk açılışta zaten devralınmışsa ekran kapanır (sohbet hiçbir listede olmadığından yeniden açılamaz)
  const load = useCallback(async () => {
    try {
      const d = await api.get<ChatDetail | { id: string; takenOver: true }>(`/admin/live-support/chats/${id}`);
      if (!('messages' in d)) {
        if (!loaded.current) { cb.current.onClosed(); return; }
        setC((p) => (p ? { ...p, mine: false, takenOver: true, userTyping: false, userDraft: '' } : p));
      } else { loaded.current = true; setC(d); }
      if ((d as { takenOver?: boolean }).takenOver) cb.current.onTakenOver();
      setErr('');
    } catch (e) { setErr((e as Error).message); }
  }, [id]);
  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [load]);
  useEffect(() => { api.get<Canned[]>('/admin/live-support/canned').then(setCanned).catch(() => {}); }, []);
  useEffect(() => {
    if (c && c.messages.length !== count.current) { count.current = c.messages.length; listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }
  }, [c]);
  // Haiku "Sohbete ekle": metin mesaj kutusuna gelir, temsilci düzenleyip kendisi gönderir
  useEffect(() => {
    const on = (e: Event) => setText((v) => (v ? `${v}\n` : '') + String((e as CustomEvent).detail));
    window.addEventListener('cd-insert', on);
    return () => window.removeEventListener('cd-insert', on);
  }, []);

  if (!c) return <div className="ll-card"><p style={{ color: err ? RED : MUTED, fontSize: 13 }}>{err || 'Yükleniyor…'}</p></div>;
  const open = c.status === 'ACTIVE' || c.status === 'QUEUED';
  const canWrite = c.mine && c.status === 'ACTIVE';
  const userTyping = live ? live.userTyping : c.userTyping;
  const abuseOk = abuseDays !== null && abuseReason.replace(/\s/g, '').length >= REASON_MIN;
  // Okundu: yalnız temsilci mesajlarından kullanıcının okuduğu sonuncusunun altında
  const readId = c.userReadAt ? [...c.messages].reverse().find((m) => m.sender === 'AGENT' && m.createdAt <= c.userReadAt!)?.id : undefined;
  const slash = text.startsWith('/') ? canned.filter((x) => x.title.toLocaleLowerCase('tr').includes(text.slice(1).toLocaleLowerCase('tr'))) : [];

  function onType(v: string) {
    setText(v.slice(0, 2000));
    if (canWrite && Date.now() - typingAt.current > 1500) { typingAt.current = Date.now(); api.post(`/admin/live-support/chats/${id}/typing`, {}).catch(() => undefined); }
  }
  function pick(list: FileList | null) {
    const next = [...files];
    for (const f of Array.from(list ?? [])) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) { setErr('Yalnız JPG, PNG ve WebP görseller gönderilebilir.'); continue; }
      if (f.size > 5 * 1024 * 1024) { setErr('Her görsel en fazla 5 MB olabilir.'); continue; }
      if (next.length >= 3) { setErr('Bir mesajda en fazla 3 görsel gönderilebilir.'); break; }
      next.push(f);
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = '';
  }
  async function send() {
    if ((!text.trim() && !files.length) || busy) return;
    setBusy(true); setErr('');
    const fd = new FormData();
    if (text.trim()) fd.append('content', text.trim());
    files.forEach((f) => fd.append('images', f));
    try {
      const res = await fetch(`${API_PREFIX}/admin/live-support/chats/${id}/messages`, { method: 'POST', body: fd, credentials: 'include', headers: langHeaders() });
      if (!res.ok) { const b = await res.json().catch(() => null) as { message?: string } | null; throw new Error(b?.message ?? 'Mesaj gönderilemedi'); }
      setText(''); setFiles([]); setEmoji(false); load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const act = async (fn: () => Promise<unknown>, after?: () => void) => { setErr(''); try { await fn(); after?.(); load(); reload(); } catch (e) { setErr((e as Error).message); } };

  return (
    <section className="ll-card" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 520, maxHeight: '78vh', overflow: 'hidden' }}>
      {/* Bilgi alanı solda genişler; Devral / Sonlandır sağda alt alta; kötüye kullanım alanı başlığın altında */}
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {c.avatar !== undefined && <DetayAvatar ring={c.kind === 'venue' ? VENUE_RING : undefined} participant={c.avatar ?? {}} delay={0} size={48} />}
        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <p style={{ fontSize: 15, fontWeight: 700 }}>{c.requesterName}</p>
          <p style={{ fontSize: 11, color: MUTED }}>{TOPIC[c.topic]} · {c.kind === 'venue' ? 'Mekân' : 'Üye'} · bekleme {waited(c.queuedAt)}{c.agentNo ? ` · Temsilci No ${c.agentNo}` : ''}</p>
          {open && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <StatusPill status={userTyping ? 'typing' : c.userOnline ? 'online' : 'offline'} label={userTyping ? 'yazıyor…' : c.userOnline ? 'Çevrimiçi' : 'Çevrimdışı'} />
              {((!c.mine && st.me.role === 'ADMIN') || c.takenOver) && <span style={{ fontSize: 11, color: MUTED }}>salt okunur</span>}
            </div>
          )}
        </div>
        {/* SUPERADMIN izlediği sohbette yalnız Devral; Sonlandır ve kötüye kullanım yalnız atanmış temsilcide (Devral sonrası SUPERADMIN dahil) */}
        {open && (c.mine || st.me.role === 'SUPERADMIN') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6, flexShrink: 0 }}>
            {!c.mine && st.me.role === 'SUPERADMIN' && <button style={btn(BLUE)} onClick={() => act(() => api.post(`/admin/live-support/chats/${id}/take`, {}))}>Devral</button>}
            {c.mine && <button style={btn(MUTED)} onClick={() => setConfirm(0)}>Sonlandır</button>}
          </div>
        )}
      </div>
      {open && c.mine && (
        <details style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.06)', borderBottom: `1px solid ${BORDER}` }}>
          <summary style={{ fontSize: 12, fontWeight: 600, color: RED, cursor: 'pointer' }}>Kötüye kullanım</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 12 }}>Sohbeti kapat ve canlı destek erişimini kısıtla:</span>
            <div role="radiogroup" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[1, 7, 30].map((d) => <button key={d} role="radio" aria-checked={abuseDays === d} style={btn(RED, abuseDays === d)} onClick={() => setAbuseDays(d)}>{d} gün</button>)}
            </div>
            <textarea value={abuseReason} onChange={(e) => setAbuseReason(e.target.value.slice(0, 1000))} rows={3} aria-label="Kısıtlama sebebi" style={{ ...inputStyle, resize: 'vertical' }} />
            <button style={{ ...btn(RED, true), alignSelf: 'flex-start', opacity: abuseOk ? 1 : 0.4, cursor: abuseOk ? 'pointer' : 'not-allowed' }} disabled={!abuseOk} onClick={() => setConfirm(abuseDays)}>Kısıtla</button>
          </div>
        </details>
      )}
      <AdminConfirm open={confirm !== null}
        text={confirm ? `${confirm} gün kısıtlama vermek istediğinden emin misin?` : 'Görüşmeyi sonlandırmak istediğinden emin misin?'}
        onNo={() => setConfirm(null)}
        onYes={() => { const d = confirm; setConfirm(null); act(() => api.post(`/admin/live-support/chats/${id}/close`, d ? { abuseDays: d, abuseReason: abuseReason.trim() } : {}), onClosed); }} />
      {!open && <p style={{ padding: '8px 14px', fontSize: 12, color: MUTED }}>Sohbet kapandı{c.closedAt ? ` (${dt(c.closedAt)})` : ''}.</p>}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {c.messages.map((m) => {
          const sys = m.sender === 'SYSTEM' && m.content !== 'GREETING';
          // Kayıt bildirimi (NOTICE) saatsiz
          if (sys) return <p key={m.id} style={{ alignSelf: 'center', maxWidth: '90%', fontSize: 11, color: MUTED, textAlign: 'center', flexShrink: 0 }}>{SYS[m.content] ?? m.content}{m.content === 'NOTICE' ? '' : ` · ${hm(m.createdAt)}`}</p>;
          const user = m.sender === 'USER';
          return (
            <div key={m.id} style={{ alignSelf: user ? 'flex-start' : 'flex-end', maxWidth: '78%', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '7px 10px 5px', borderRadius: 12, background: user ? CARD : 'rgba(59,130,246,0.14)', border: `1px solid ${user ? BORDER : 'rgba(59,130,246,0.35)'}` }}>
                {m.images.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>{m.images.map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={f} src={imgUrl(id, f)} alt="Görsel" onClick={() => setViewer(imgUrl(id, f))} style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 8, cursor: 'zoom-in' }} />
                ))}</div>}
                {(m.content || m.sender === 'SYSTEM') && <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.sender === 'SYSTEM' ? SYS.GREETING : m.content}</p>}
                <p style={{ fontSize: 10, color: MUTED, textAlign: 'right' }}>{!user && m.agentNo ? `No ${m.agentNo} · ` : ''}{hm(m.createdAt)}</p>
              </div>
              {m.id === readId && <p style={{ alignSelf: 'flex-end', fontSize: 10, color: MUTED, marginTop: 2 }}>Okundu</p>}
            </div>
          );
        })}
        {/* Yazı önizlemesi: kullanıcının gönderilmemiş metni, listenin en altında gri ve italik (sunucuda yalnız bellekte; yalnız atanmış temsilci) */}
        {!!draft && <p style={{ alignSelf: 'flex-start', maxWidth: '78%', flexShrink: 0, fontSize: 13, color: MUTED, fontStyle: 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{draft}</p>}
        {c.takenOver && <p style={{ alignSelf: 'center', marginTop: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, color: AMBER, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', textAlign: 'center' }}>{TAKEN_OVER}</p>}
      </div>
      {err && <p style={{ padding: '0 12px 6px', fontSize: 12, color: RED }}>{err}</p>}
      {canWrite && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: 8, position: 'relative' }}>
          {slash.length > 0 && (
            <div style={{ position: 'absolute', bottom: '100%', left: 8, right: 8, maxHeight: 220, overflowY: 'auto', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, zIndex: 5 }}>
              {slash.map((x) => <button key={x.id} onClick={() => setText(x.content)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', borderBottom: `1px solid ${BORDER}`, color: TEXT, cursor: 'pointer' }}><strong style={{ fontSize: 12 }}>{x.title}</strong><span style={{ display: 'block', fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.content}</span></button>)}
            </div>
          )}
          {files.length > 0 && <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>{files.map((f, i) => (
            <button key={i} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} title="Kaldır" style={{ padding: 0, border: `1px solid ${BORDER}`, borderRadius: 6, background: 'none', cursor: 'pointer' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(f)} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
            </button>
          ))}</div>}
          {emoji && <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 6 }}>{EMOJIS.map((e) => <button key={e} onClick={() => setText((v) => v + e)} style={{ width: 34, height: 34, fontSize: 18, background: 'none', border: 'none', cursor: 'pointer' }}>{e}</button>)}</div>}
          {/* Mesaj kutusu: kullanıcı ekranıyla aynı düzen (dosya, emoji, yazı alanı, gönder ikonu kutunun içinde) */}
          <div style={{ display: 'flex', alignItems: 'flex-end', minHeight: 48, borderRadius: 24, border: `1px solid ${BORDER}`, background: BG, padding: 2 }}>
            <button type="button" onClick={() => fileRef.current?.click()} aria-label="Görsel ekle" style={ICON_BTN}><AttachIcon color={RED_ICON} /></button>
            <button type="button" onClick={() => setEmoji((v) => !v)} aria-label="Emoji" style={ICON_BTN}><EmojiIcon color={RED_ICON} /></button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => pick(e.target.files)} />
            <AutoTextarea value={text} onChange={onType} onEnter={send} enterSends={!slash.length} color={TEXT} />
            <button type="button" onClick={send} disabled={busy || (!text.trim() && !files.length)} aria-label="Gönder" style={{ ...ICON_BTN, opacity: busy || (!text.trim() && !files.length) ? 0.5 : 1 }}><SendIcon /></button>
          </div>
        </div>
      )}
      {/* İç not (kullanıcıya asla gösterilmez) ve devir; devralınan sohbette kapalı */}
      {!c.takenOver && <details style={{ borderTop: `1px solid ${BORDER}`, padding: '8px 12px' }}>
        <summary style={{ fontSize: 12, color: MUTED, cursor: 'pointer' }}>İç notlar ({c.notes.length}) ve devir geçmişi ({c.transfers.length})</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {c.transfers.map((x) => <p key={x.id} style={{ fontSize: 12, color: AMBER }}>Devir {x.from ?? '—'} → {x.to ?? '—'} · {dt(x.createdAt)}: {x.note}</p>)}
          {c.notes.map((n) => <p key={n.id} style={{ fontSize: 12 }}><span style={{ color: MUTED }}>No {n.agentNo} · {dt(n.createdAt)}:</span> {n.content}</p>)}
          {c.mine && (
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="İç not ekle" style={{ ...inputStyle, flex: 1 }} />
              <button style={btn(BLUE)} onClick={() => note.trim() && act(() => api.post(`/admin/live-support/chats/${id}/notes`, { content: note.trim() }), () => setNote(''))}>Ekle</button>
            </div>
          )}
          {canWrite && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} style={inputStyle}>
                <option value="">Devredilecek temsilci</option>
                {st.onlineAgents.map((a) => <option key={a.userId} value={a.userId}>Temsilci No {a.agentNo}</option>)}
              </select>
              <input value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="Devir notu (zorunlu)" style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
              <button style={btn(AMBER)} disabled={!transferTo || !transferNote.trim()} onClick={() => act(() => api.post(`/admin/live-support/chats/${id}/transfer`, { toAgentId: transferTo, note: transferNote.trim() }), () => { setTransferNote(''); setTransferTo(''); onClosed(); })}>Devret</button>
            </div>
          )}
        </div>
      </details>}
      {viewer && (
        <div onClick={() => setViewer(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewer} alt="Görsel" style={{ maxWidth: '94vw', maxHeight: '90vh', objectFit: 'contain' }} />
        </div>
      )}
    </section>
  );
}

// Haiku asistanı: yalnız okur; cevabın altında "Kopyala" ve "Sohbete ekle" (mesajı temsilci gönderir)
function HaikuPanel({ chatId, onInsert }: { chatId: string; onInsert: (t: string) => void }) {
  const [q, setQ] = useState('');
  const [images, setImages] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [items, setItems] = useState<{ q: string; a: string }[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  // Kopyala: yalnız panoya yazar, kısa onay gösterir; kopyalama hiçbir yere kaydedilmez
  function copy(i: number, text: string) {
    navigator.clipboard?.writeText(text).then(() => { setCopied(i); setTimeout(() => setCopied((v) => (v === i ? null : v)), 1500); }).catch(() => {});
  }
  async function run(draft: boolean) {
    if (busy || (!draft && !q.trim())) return;
    setBusy(true); setErr('');
    try {
      const r = await api.post<{ answer: string }>(`/admin/live-support/chats/${chatId}/ai`, { question: draft ? undefined : q.trim(), draft, includeImages: images });
      setItems((p) => [{ q: draft ? 'Taslak cevap' : q.trim(), a: r.answer }, ...p]); setCopied(null);
      if (!draft) setQ('');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <aside className="ll-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '78vh', overflowY: 'auto' }}>
      <p style={{ ...LABEL, color: '#22d3ee' }}>HAIKU ASİSTANI</p>
      <p style={{ fontSize: 11, color: MUTED }}>Yalnız bu sohbetin hesabını okur; veri değiştirmez, kullanıcıya mesaj göndermez.</p>
      <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={3} placeholder="Haiku'ya sor (ör. kalan hakları neler?)" style={{ ...inputStyle, resize: 'vertical' }} />
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: MUTED }}>
        <input type="checkbox" checked={images} onChange={(e) => setImages(e.target.checked)} /> Sohbetteki görselleri de oku
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={btn('#22d3ee')} disabled={busy} onClick={() => run(false)}>Sor</button>
        <button style={btn(BLUE)} disabled={busy} onClick={() => run(true)}>Taslak öner</button>
      </div>
      {busy && <p style={{ fontSize: 12, color: MUTED }}>Haiku düşünüyor…</p>}
      {err && <p style={{ fontSize: 12, color: RED }}>{err}</p>}
      {items.map((it, i) => (
        <div key={i} style={{ padding: 10, borderRadius: 10, background: CARD, border: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{it.q}</p>
          <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{it.a}</p>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button style={btn(copied === i ? GREEN : MUTED)} onClick={() => copy(i, it.a)} aria-live="polite">{copied === i ? 'Kopyalandı ✓' : 'Kopyala'}</button>
            <button style={btn(GREEN)} onClick={() => onInsert(it.a)}>Sohbete ekle</button>
          </div>
        </div>
      ))}
    </aside>
  );
}

// ─── Tüm Sohbetler (yalnız SUPERADMIN) ─────────────────────────────────────
// Açık, sıradaki ve kapanmış bütün sohbetler (üye + mekân). Sohbete basınca tamamı: mesajlar, görseller, iç notlar, devirler,
// değerlendirme ve yorum, Haiku sorgu kayıtları. Açık sohbette mevcut devralma (POST /admin/live-support/chats/:id/take).

interface AllRow { id: string; name: string; kind: 'user' | 'venue'; avatar: Avatar | null; topic: string; status: string; agentNo: string | null; startedAt: string; durationMin: number; stars: number | null }
interface AllDetail {
  id: string; name: string; requesterName: string; kind: 'user' | 'venue'; avatar: Avatar | null; topic: string; status: string; agentNo: string | null;
  startedAt: string; closedAt: string | null; closedBy: string | null; durationMin: number; messages: Msg[];
  notes: { id: string; agentNo: string; content: string; createdAt: string }[];
  transfers: { id: string; from: string | null; to: string | null; note: string; createdAt: string }[];
  rating: { helped: boolean; stars: number; tags: string[]; comment: string | null; createdAt: string } | null;
  aiLogs: AiLog[];
  restriction: { days: number; reason: string; createdAt: string; expiresAt: string; liftedAt: string | null; agentNo: string | null; liftReason: string | null } | null;
}
const CHAT_STATUS: Record<string, string> = { QUEUED: 'Sırada', ACTIVE: 'Açık', CLOSED: 'Kapandı' };
const CLOSED_BY: Record<string, string> = { USER: 'kullanıcı', AGENT: 'temsilci', AUTO: 'otomatik', ABUSE: 'kötüye kullanım' };
const dur = (m: number) => (m < 60 ? `${Math.max(0, Math.round(m))} dk` : `${Math.floor(m / 60)} sa ${Math.round(m % 60)} dk`);
const starsText = (n: number | null) => (n === null ? '—' : '★'.repeat(n) + '☆'.repeat(5 - n));

function AllChatsTab() {
  const [f, setF] = useState({ from: '', to: '', status: '', topic: '', agentNo: '', kind: '', q: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; page: number; pages: number; rows: AllRow[] } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    const qs = new URLSearchParams(Object.entries({ ...f, page: String(page) }).filter(([, v]) => v));
    api.get<{ total: number; page: number; pages: number; rows: AllRow[] }>(`/admin/live-support/manage/chats?${qs}`).then((d) => { setData(d); setErr(''); }).catch((e) => setErr((e as Error).message));
  }, [f, page]);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof typeof f, v: string) => { setF((p) => ({ ...p, [k]: v })); setPage(1); };
  if (sel) return <AllChatDetailView id={sel} onBack={() => { setSel(null); load(); }} />;
  return (
    <div>
      <div className="ll-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginBottom: 12 }}>
        <input value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Ad soyad / mekân adı ara" style={{ ...inputStyle, gridColumn: 'span 2' }} />
        <label style={{ fontSize: 11, color: MUTED, display: 'flex', flexDirection: 'column', gap: 3 }}>Başlangıç<input type="date" value={f.from} onChange={(e) => set('from', e.target.value)} style={inputStyle} /></label>
        <label style={{ fontSize: 11, color: MUTED, display: 'flex', flexDirection: 'column', gap: 3 }}>Bitiş<input type="date" value={f.to} onChange={(e) => set('to', e.target.value)} style={inputStyle} /></label>
        <select value={f.status} onChange={(e) => set('status', e.target.value)} style={inputStyle}>
          <option value="">Tüm durumlar</option>{Object.entries(CHAT_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={f.topic} onChange={(e) => set('topic', e.target.value)} style={inputStyle}>
          <option value="">Tüm konular</option>{Object.entries(TOPIC).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={f.kind} onChange={(e) => set('kind', e.target.value)} style={inputStyle}>
          <option value="">Üye + Mekân</option><option value="user">Üye</option><option value="venue">Mekân</option>
        </select>
        <input value={f.agentNo} onChange={(e) => set('agentNo', e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" placeholder="Temsilci No" style={inputStyle} />
      </div>
      {err && <p style={{ color: RED, fontSize: 12, marginBottom: 8 }}>{err}</p>}
      {!data ? <p style={{ color: MUTED, fontSize: 13 }}>Yükleniyor…</p> : (
        <div className="ll-card" style={{ overflowX: 'auto' }}>
          <p style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>{data.total} sohbet</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ color: MUTED, textAlign: 'left' }}>{['Ad soyad / Mekân', 'Tür', 'Konu', 'Durum', 'Temsilci No', 'Başlangıç', 'Süre', 'Değerlendirme'].map((h) => <th key={h} style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} onClick={() => setSel(r.id)} style={{ borderTop: `1px solid ${BORDER}`, cursor: 'pointer' }}>
                  <td style={{ padding: '8px', fontWeight: 600 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><DetayAvatar ring={r.kind === 'venue' ? VENUE_RING : undefined} participant={r.avatar ?? {}} delay={0} size={32} /><span>{r.name}</span></div></td>
                  <td style={{ padding: '8px' }}>{r.kind === 'venue' ? 'Mekân' : 'Üye'}</td>
                  <td style={{ padding: '8px' }}>{TOPIC[r.topic]}</td>
                  <td style={{ padding: '8px', color: r.status === 'CLOSED' ? MUTED : r.status === 'ACTIVE' ? GREEN : AMBER }}>{CHAT_STATUS[r.status] ?? r.status}</td>
                  <td style={{ padding: '8px', fontFamily: MONO }}>{r.agentNo ?? '—'}</td>
                  <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{dt(r.startedAt)}</td>
                  <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{dur(r.durationMin)}</td>
                  <td style={{ padding: '8px', color: '#e0a526', whiteSpace: 'nowrap' }}>{starsText(r.stars)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.rows.length && <p style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Sohbet yok.</p>}
          {data.pages > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
              <button style={btn(MUTED)} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Önceki</button>
              <span style={{ fontSize: 12, color: MUTED }}>{data.page} / {data.pages}</span>
              <button style={btn(MUTED)} disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Sonraki →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AllChatDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [c, setC] = useState<AllDetail | null>(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [viewer, setViewer] = useState<string | null>(null);
  const load = useCallback(() => { api.get<AllDetail>(`/admin/live-support/manage/chats/${id}`).then((d) => { setC(d); setErr(''); }).catch((e) => setErr((e as Error).message)); }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') setViewer(null); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  async function take() {
    setErr(''); setOk('');
    try { await api.post(`/admin/live-support/chats/${id}/take`, {}); setOk('Sohbeti devraldın. Sohbetler sekmesinden yazabilirsin.'); load(); } catch (e) { setErr((e as Error).message); }
  }
  if (!c) return <div><button style={btn(MUTED)} onClick={onBack}>← Tüm Sohbetler</button><p style={{ color: err ? RED : MUTED, fontSize: 13, marginTop: 10 }}>{err || 'Yükleniyor…'}</p></div>;
  const open = c.status === 'ACTIVE' || c.status === 'QUEUED';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 900 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={btn(MUTED)} onClick={onBack}>← Tüm Sohbetler</button>
        {open && <button style={btn(BLUE)} onClick={take}>Devral</button>}
        {ok && <span style={{ fontSize: 12, color: GREEN }}>{ok}</span>}
        {err && <span style={{ fontSize: 12, color: RED }}>{err}</span>}
      </div>
      <div className="ll-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DetayAvatar ring={c.kind === 'venue' ? VENUE_RING : undefined} participant={c.avatar ?? {}} delay={0} size={48} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</p>
            {c.kind === 'venue' && c.requesterName !== c.name && <p style={{ fontSize: 12, color: MUTED }}>{c.requesterName}</p>}
          </div>
        </div>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
          {c.kind === 'venue' ? 'Mekân' : 'Üye'} · {TOPIC[c.topic]} · {CHAT_STATUS[c.status] ?? c.status} · Temsilci No {c.agentNo ?? '—'} · {dt(c.startedAt)} · {dur(c.durationMin)}
          {c.closedAt ? ` · kapanış ${dt(c.closedAt)}${c.closedBy ? ` (${CLOSED_BY[c.closedBy] ?? c.closedBy})` : ''}` : ''}
        </p>
      </div>
      <div className="ll-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
        <p style={{ ...LABEL, color: MUTED }}>MESAJLAR ({c.messages.length})</p>
        {c.messages.map((m) => {
          if (m.sender === 'SYSTEM' && m.content !== 'GREETING') return <p key={m.id} style={{ alignSelf: 'center', maxWidth: '90%', fontSize: 11, color: MUTED, textAlign: 'center' }}>{SYS[m.content] ?? m.content}{m.content === 'NOTICE' ? '' : ` · ${dt(m.createdAt)}`}</p>;
          const user = m.sender === 'USER';
          return (
            <div key={m.id} style={{ alignSelf: user ? 'flex-start' : 'flex-end', maxWidth: '78%' }}>
              <div style={{ padding: '7px 10px 5px', borderRadius: 12, background: user ? CARD : 'rgba(59,130,246,0.14)', border: `1px solid ${user ? BORDER : 'rgba(59,130,246,0.35)'}` }}>
                {m.images.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>{m.images.map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={f} src={imgUrl(id, f)} alt="Görsel" onClick={() => setViewer(imgUrl(id, f))} style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 8, cursor: 'zoom-in' }} />
                ))}</div>}
                {(m.content || m.sender === 'SYSTEM') && <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.sender === 'SYSTEM' ? SYS.GREETING : m.content}</p>}
                <p style={{ fontSize: 10, color: MUTED, textAlign: 'right' }}>{!user && m.agentNo ? `No ${m.agentNo} · ` : ''}{dt(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        {!c.messages.length && <p style={{ fontSize: 12, color: MUTED }}>—</p>}
      </div>
      <div className="ll-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ ...LABEL, color: MUTED }}>İÇ NOTLAR ({c.notes.length}) · DEVİRLER ({c.transfers.length})</p>
        {c.transfers.map((x) => <p key={x.id} style={{ fontSize: 12, color: AMBER }}>Devir {x.from ?? '—'} → {x.to ?? '—'} · {dt(x.createdAt)}: {x.note}</p>)}
        {c.notes.map((n) => <p key={n.id} style={{ fontSize: 12 }}><span style={{ color: MUTED }}>No {n.agentNo} · {dt(n.createdAt)}:</span> {n.content}</p>)}
        {!c.notes.length && !c.transfers.length && <p style={{ fontSize: 12, color: MUTED }}>—</p>}
      </div>
      {c.restriction && (
        <div className="ll-card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ ...LABEL, color: RED }}>KÖTÜYE KULLANIM KISITLAMASI</p>
          <p style={{ fontSize: 12 }}>{c.restriction.days} gün · {dt(c.restriction.createdAt)} → {dt(c.restriction.expiresAt)} · Temsilci No {c.restriction.agentNo ?? '—'}{c.restriction.liftedAt ? ` · kaldırıldı ${dt(c.restriction.liftedAt)}` : ''}</p>
          <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>Sebep: {c.restriction.reason}</p>
          {c.restriction.liftedAt && <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>Kaldırma sebebi: {c.restriction.liftReason ?? 'Sebep girilmemiş'}</p>}
        </div>
      )}
      <div className="ll-card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ ...LABEL, color: MUTED }}>DEĞERLENDİRME</p>
        {c.rating ? (<>
          <p style={{ fontSize: 16, color: '#e0a526' }}>{starsText(c.rating.stars)}</p>
          <p style={{ fontSize: 12 }}>Sorun çözüldü mü: <strong>{c.rating.helped ? 'Evet' : 'Hayır'}</strong> · {dt(c.rating.createdAt)}</p>
          {c.rating.tags.length > 0 && <p style={{ fontSize: 12, color: MUTED }}>{c.rating.tags.join(', ')}</p>}
          {c.rating.comment && <p style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{c.rating.comment}</p>}
        </>) : <p style={{ fontSize: 12, color: MUTED }}>Değerlendirme yok.</p>}
      </div>
      <div className="ll-card" style={{ overflowX: 'auto' }}>
        <p style={{ ...LABEL, color: '#22d3ee', marginBottom: 6 }}>HAIKU SORGU KAYITLARI ({c.aiLogs.length})</p>
        {c.aiLogs.map((l) => (
          <div key={l.id} style={{ padding: '6px 0', borderTop: `1px solid ${BORDER}` }}>
            <p style={{ fontSize: 11, color: MUTED }}>{dt(l.createdAt)} · Temsilci No {l.agentNo} · {AI_TYPE[l.requestType] ?? l.requestType} · <span style={{ color: l.success ? GREEN : RED }}>{aiResult(l)}</span></p>
            <p style={{ fontSize: 13 }}>{l.question}</p>
            <p style={{ fontSize: 11, color: '#22d3ee' }}>{l.tools.join(', ') || '—'}</p>
          </div>
        ))}
        {!c.aiLogs.length && <p style={{ fontSize: 12, color: MUTED }}>Kayıt yok.</p>}
      </div>
      {viewer && (
        <div onClick={() => setViewer(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewer} alt="Görsel" style={{ maxWidth: '94vw', maxHeight: '90vh', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}

// ─── Hazır yanıtlar ────────────────────────────────────────────────────────

function CannedTab() {
  const [rows, setRows] = useState<Canned[]>([]);
  const [edit, setEdit] = useState<Canned | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [err, setErr] = useState('');
  const load = () => api.get<Canned[]>('/admin/live-support/canned').then(setRows).catch((e) => setErr((e as Error).message));
  useEffect(() => { load(); }, []);
  async function save() {
    setErr('');
    try {
      if (edit) await api.patch(`/admin/live-support/manage/canned/${edit.id}`, { title, content });
      else await api.post('/admin/live-support/manage/canned', { title, content });
      setEdit(null); setTitle(''); setContent(''); load();
    } catch (e) { setErr((e as Error).message); }
  }
  return (
    <div style={{ maxWidth: 760 }}>
      <div className="ll-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 600 }}>{edit ? 'Hazır yanıtı düzenle' : 'Yeni hazır yanıt'}</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Başlık (temsilci '/' yazınca bununla arar)" style={inputStyle} />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="Metin" style={{ ...inputStyle, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btn(GREEN)} onClick={save} disabled={!title.trim() || !content.trim()}>Kaydet</button>
          {edit && <button style={btn(MUTED)} onClick={() => { setEdit(null); setTitle(''); setContent(''); }}>Vazgeç</button>}
        </div>
        {err && <p style={{ fontSize: 12, color: RED }}>{err}</p>}
      </div>
      {rows.map((r) => (
        <div key={r.id} className="ll-card" style={{ marginBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</p><p style={{ fontSize: 12, color: MUTED, whiteSpace: 'pre-wrap' }}>{r.content}</p></div>
          <button style={btn(BLUE)} onClick={() => { setEdit(r); setTitle(r.title); setContent(r.content); }}>Düzenle</button>
          <button style={btn(RED)} onClick={() => api.delete(`/admin/live-support/manage/canned/${r.id}`).then(load).catch((e) => setErr((e as Error).message))}>Sil</button>
        </div>
      ))}
    </div>
  );
}

// ─── Raporlar ──────────────────────────────────────────────────────────────

interface Report {
  total: number; open: number; avgWaitMin: number | null; topics: Record<string, number>; hourly: number[]; shift: { DAY: number; NIGHT: number }; shiftDay: string; shiftNight: string;
  byAgent: { agentNo: string; closed: number; firstResponseMin: number | null; avgDurationMin: number | null; avgStars: number | null; helpedYesRate: number | null; ratings: number; tags: Record<string, number> }[];
}
function ReportsTab() {
  const [days, setDays] = useState(7);
  const [r, setR] = useState<Report | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { setR(null); api.get<Report>(`/admin/live-support/manage/reports?days=${days}`).then(setR).catch((e) => setErr((e as Error).message)); }, [days]);
  const max = r ? Math.max(1, ...r.hourly) : 1;
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[[1, 'Bugün'], [7, '7 gün'], [30, '30 gün'], [0, 'Tümü']].map(([d, l]) => <button key={d} style={btn('#22d3ee', days === d)} onClick={() => setDays(d as number)}>{l}</button>)}
      </div>
      {err && <p style={{ color: RED, fontSize: 12 }}>{err}</p>}
      {!r ? <p style={{ color: MUTED, fontSize: 13 }}>Yükleniyor…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
            {[['Toplam sohbet', String(r.total)], ['Açık', String(r.open)], ['Ortalama bekleme', fmtMin(r.avgWaitMin)], [`Gündüz (${r.shiftDay})`, String(r.shift.DAY)], [`Gece (${r.shiftNight})`, String(r.shift.NIGHT)]].map(([l, v]) => (
              <div key={l} className="ll-card" style={{ padding: 12 }}><p style={{ fontSize: 11, color: MUTED }}>{l}</p><p style={{ fontSize: 20, fontWeight: 700, fontFamily: MONO }}>{v}</p></div>
            ))}
          </div>
          <div className="ll-card">
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Konu dağılımı</p>
            {Object.entries(r.topics).map(([k, v]) => <p key={k} style={{ fontSize: 12 }}>{k}: <strong>{v}</strong></p>)}
            {!Object.keys(r.topics).length && <p style={{ fontSize: 12, color: MUTED }}>—</p>}
          </div>
          <div className="ll-card">
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Saatlik yoğunluk (TR saati, sıraya giriş)</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 110 }}>
              {r.hourly.map((n, h) => (
                <div key={h} title={`${String(h).padStart(2, '0')}:00 · ${n}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', height: `${(n / max) * 90}px`, minHeight: n ? 2 : 0, background: BLUE, borderRadius: 2 }} />
                  <span style={{ fontSize: 8, color: MUTED }}>{h}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ll-card" style={{ overflowX: 'auto' }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Temsilci başına</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ color: MUTED, textAlign: 'left' }}>{['Temsilci No', 'Kapatılan', 'İlk yanıt', 'Ort. sohbet', 'Puan ort.', 'Evet oranı', 'Etiketler'].map((h) => <th key={h} style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
              <tbody>
                {r.byAgent.map((a) => (
                  <tr key={a.agentNo} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '6px 8px', fontFamily: MONO }}>{a.agentNo}</td>
                    <td style={{ padding: '6px 8px' }}>{a.closed}</td>
                    <td style={{ padding: '6px 8px' }}>{fmtMin(a.firstResponseMin)}</td>
                    <td style={{ padding: '6px 8px' }}>{fmtMin(a.avgDurationMin)}</td>
                    <td style={{ padding: '6px 8px' }}>{a.avgStars === null ? '—' : `${a.avgStars.toFixed(2)} (${a.ratings})`}</td>
                    <td style={{ padding: '6px 8px' }}>{a.helpedYesRate === null ? '—' : `%${Math.round(a.helpedYesRate * 100)}`}</td>
                    <td style={{ padding: '6px 8px' }}>{Object.entries(a.tags).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!r.byAgent.length && <p style={{ fontSize: 12, color: MUTED }}>Bu dönemde kapanan sohbet yok.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Temsilciler (liste, durum ve mola geçmişi ADMIN + SUPERADMIN; hesap açma / kapama SUPERADMIN) ───────

interface AgentRow { userId: string; name: string; email: string; phone: string | null; role: string; active: boolean; agentNo: string | null; status: string | null; createdAt: string; breakStartedAt: string | null }
interface BreakRow { id: string; startedAt: string; endedAt: string | null; durationMin: number }
const dOnly = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Istanbul' });
function BreakHistory({ userId }: { userId: string }) {
  const [rows, setRows] = useState<BreakRow[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get<BreakRow[]>(`/admin/live-support/manage/agents/${userId}/breaks`).then(setRows).catch((e) => setErr((e as Error).message)); }, [userId]);
  if (err) return <p style={{ fontSize: 12, color: RED }}>{err}</p>;
  if (!rows) return <p style={{ fontSize: 12, color: MUTED }}>Yükleniyor…</p>;
  if (!rows.length) return <p style={{ fontSize: 12, color: MUTED }}>Mola kaydı yok.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr style={{ color: MUTED, textAlign: 'left' }}>{['Tarih', 'Başlangıç', 'Bitiş', 'Süre'].map((h) => <th key={h} style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} style={{ borderTop: `1px solid ${BORDER}` }}>
              <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>{dOnly(b.startedAt)}</td>
              <td style={{ padding: '4px 8px' }}>{hm(b.startedAt)}</td>
              <td style={{ padding: '4px 8px' }}>{b.endedAt ? hm(b.endedAt) : 'Sürüyor'}</td>
              <td style={{ padding: '4px 8px' }}>{Math.round(b.durationMin)} dk</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function AgentsTab({ superadmin }: { superadmin: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const load = () => api.get<AgentRow[]>('/admin/live-support/manage/agents').then(setRows).catch((e) => setErr((e as Error).message));
  useEffect(() => { load(); }, []);
  async function create() {
    setErr(''); setOk('');
    try { const r = await api.post<{ agentNo: string }>('/admin/live-support/manage/agents', f); setOk(`Temsilci hesabı açıldı. Temsilci No: ${r.agentNo}`); setF({ firstName: '', lastName: '', email: '', phone: '', password: '' }); load(); }
    catch (e) { setErr((e as Error).message); }
  }
  const roleTr: Record<string, string> = { SUPPORT: 'Temsilci', ADMIN: 'Admin', SUPERADMIN: 'Süper Admin' };
  return (
    <div style={{ maxWidth: 860 }}>
      {!superadmin && err && <p style={{ fontSize: 12, color: RED, marginBottom: 8 }}>{err}</p>}
      {superadmin && <div className="ll-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8, marginBottom: 12 }}>
        <p style={{ gridColumn: '1/-1', fontSize: 13, fontWeight: 600 }}>Temsilci hesabı aç</p>
        {([['firstName', 'Ad'], ['lastName', 'Soyad'], ['email', 'E-posta'], ['phone', 'Telefon (+90…)'], ['password', 'Şifre (en az 8)']] as const).map(([k, l]) => (
          <input key={k} type={k === 'password' ? 'password' : 'text'} value={f[k]} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))} placeholder={l} style={inputStyle} />
        ))}
        <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, alignItems: 'center' }}>
          <button style={btn(GREEN)} onClick={create}>Hesap Aç</button>
          {err && <span style={{ fontSize: 12, color: RED }}>{err}</span>}
          {ok && <span style={{ fontSize: 12, color: GREEN }}>{ok}</span>}
        </div>
      </div>}
      {rows.map((r) => (
        <div key={r.userId} className="ll-card" style={{ marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', opacity: r.active ? 1 : 0.55 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>{r.name} <span style={{ fontSize: 11, color: MUTED }}>· {roleTr[r.role] ?? r.role}</span></p>
            <p style={{ fontSize: 11, color: MUTED }}>{r.email} · {r.phone ?? '—'} · Temsilci No {r.agentNo ?? '—'} · <span style={{ color: r.status === 'ONLINE' ? GREEN : r.status === 'BREAK' ? AMBER : MUTED }}>{AGENT_STATUS[r.status ?? 'OFFLINE']}{r.status === 'BREAK' && r.breakStartedAt ? ` · ${sinceMin(r.breakStartedAt)} dk` : ''}</span></p>
            {!r.active && <p style={{ fontSize: 11, color: AMBER }}>Bu temsilci artık destek ekibinde değil.</p>}
          </div>
          <button style={btn(AMBER)} aria-expanded={open === r.userId} onClick={() => setOpen((v) => (v === r.userId ? null : r.userId))}>Mola Geçmişi</button>
          {superadmin && r.role === 'SUPPORT' && (
            <button style={btn(r.active ? RED : GREEN)} onClick={() => api.patch(`/admin/live-support/manage/agents/${r.userId}`, { active: !r.active }).then(load).catch((e) => setErr((e as Error).message))}>
              {r.active ? 'Hesabı Kapat' : 'Hesabı Aç'}
            </button>
          )}
          {open === r.userId && <div style={{ flexBasis: '100%' }}><BreakHistory userId={r.userId} /></div>}
        </div>
      ))}
    </div>
  );
}

// ─── Kısıtlamalar (SUPERADMIN kaldırır) ────────────────────────────────────

interface Restr { id: string; requesterName: string; kind: string; days: number; expiresAt: string; createdAt: string; agentNo: string | null; liftedAt: string | null; active: boolean; reason: string; liftReason: string | null }
// Kısıt kaldırma (yalnız SUPERADMIN): "Kaldır" → sebep alanı (boşluklar hariç en az 5 karakter) + "Kaldır" → onay penceresi → kaldırma
function RestrictionsTab() {
  const [rows, setRows] = useState<Restr[]>([]);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [liftReason, setLiftReason] = useState('');
  const [ask, setAsk] = useState(false);
  const load = () => api.get<Restr[]>('/admin/live-support/manage/restrictions').then(setRows).catch((e) => setErr((e as Error).message));
  useEffect(() => { load(); }, []);
  const liftOk = liftReason.replace(/\s/g, '').length >= REASON_MIN;
  function lift() {
    const id = openId; if (!id) return;
    setAsk(false); setErr('');
    api.post(`/admin/live-support/manage/restrictions/${id}/lift`, { reason: liftReason.trim() })
      .then(() => { setOpenId(null); setLiftReason(''); load(); })
      .catch((e) => setErr((e as Error).message));
  }
  return (
    <div style={{ maxWidth: 860 }}>
      <AdminConfirm open={ask} text="Kısıtlamayı kaldırmak istediğinden emin misin?" onNo={() => setAsk(false)} onYes={lift} />
      {err && <p style={{ color: RED, fontSize: 12 }}>{err}</p>}
      {!rows.length && <p style={{ fontSize: 13, color: MUTED }}>Kısıtlama kaydı yok.</p>}
      {rows.map((r) => (
        <div key={r.id} className="ll-card" style={{ marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>{r.requesterName} <span style={{ fontSize: 11, color: MUTED }}>· {r.kind === 'venue' ? 'Mekân' : 'Üye'}</span></p>
            <p style={{ fontSize: 11, color: MUTED }}>{r.days} gün · {dt(r.createdAt)} → {dt(r.expiresAt)} · Temsilci No {r.agentNo ?? '—'}{r.liftedAt ? ` · kaldırıldı ${dt(r.liftedAt)}` : ''}</p>
            <p style={{ fontSize: 12, whiteSpace: 'pre-wrap', marginTop: 2 }}>Sebep: {r.reason}</p>
            {r.liftedAt && <p style={{ fontSize: 12, whiteSpace: 'pre-wrap', marginTop: 2 }}>Kaldırma sebebi: {r.liftReason ?? 'Sebep girilmemiş'}</p>}
          </div>
          {r.active && openId !== r.id && <button style={btn(GREEN)} onClick={() => { setOpenId(r.id); setLiftReason(''); }}>Kaldır</button>}
          {r.active && openId === r.id && (
            <div style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea value={liftReason} onChange={(e) => setLiftReason(e.target.value.slice(0, 1000))} rows={3} aria-label="Kaldırma sebebi" style={{ ...inputStyle, resize: 'vertical' }} />
              <button style={{ ...btn(GREEN, true), alignSelf: 'flex-start', opacity: liftOk ? 1 : 0.4, cursor: liftOk ? 'pointer' : 'not-allowed' }} disabled={!liftOk} onClick={() => setAsk(true)}>Kaldır</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Haiku sorgu kayıtları (SUPERADMIN) ────────────────────────────────────

function AiLogsTab() {
  const [rows, setRows] = useState<AiLog[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => { api.get<typeof rows>('/admin/live-support/manage/ai-logs').then(setRows).catch((e) => setErr((e as Error).message)); }, []);
  return (
    <div className="ll-card" style={{ overflowX: 'auto' }}>
      {err && <p style={{ color: RED, fontSize: 12 }}>{err}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr style={{ color: MUTED, textAlign: 'left' }}>{['Zaman', 'Temsilci No', 'Sohbet ID', 'Tür', 'Soru', 'Çağrılan işlevler', 'Sonuç'].map((h) => <th key={h} style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: `1px solid ${BORDER}` }}>
              <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{dt(r.createdAt)}</td>
              <td style={{ padding: '6px 8px', fontFamily: MONO }}>{r.agentNo}</td>
              <td style={{ padding: '6px 8px', fontFamily: MONO, fontSize: 10 }}>{r.chatId}</td>
              <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{AI_TYPE[r.requestType] ?? r.requestType}</td>
              <td style={{ padding: '6px 8px' }}>{r.question}</td>
              <td style={{ padding: '6px 8px' }}>{r.tools.join(', ') || '—'}</td>
              <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: r.success ? GREEN : RED }}>{aiResult(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p style={{ fontSize: 12, color: MUTED }}>Kayıt yok.</p>}
    </div>
  );
}
