'use client';

// Canlı Destek (yönetim paneli). Temsilci (SUPPORT), ADMIN ve SUPERADMIN görür.
// Sohbetler: 3 sütun — sol: sıradaki ve açık sohbetler, orta: aktif sohbet, sağ: Haiku asistanı.
// Hazır Yanıtlar ve Raporlar: ADMIN + SUPERADMIN. Temsilciler, Kısıtlamalar, Haiku Kayıtları: yalnız SUPERADMIN.
// Temsilci kullanıcı hakkında Haiku dışında veri görmez (yalnız ad / mekân adı, konu, bekleme süresi).
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, API_PREFIX, langHeaders } from '@/lib/api';
import { myRole } from '@/lib/adminRole';
import { BG, SURFACE, CARD, BORDER, TEXT, MUTED, RED, GREEN, AMBER, BLUE, SANS, MONO, LABEL } from '@/lib/adminTheme';

type Sender = 'USER' | 'AGENT' | 'SYSTEM';
interface Row { id: string; status: string; topic: string; requesterName: string; kind: 'user' | 'venue'; queuedAt: string; assignedAt: string | null; agentNo: string | null; unread: number }
interface AgentState { me: { userId: string; role: string; agentNo: string; status: 'ONLINE' | 'BREAK' | 'OFFLINE' }; maxChats: number; queue: Row[]; mine: Row[]; others: Row[]; onlineAgents: { userId: string; agentNo: string }[] }
interface Msg { id: string; sender: Sender; agentNo: string | null; content: string; images: string[]; createdAt: string }
interface ChatDetail {
  id: string; status: string; topic: string; requesterName: string; kind: 'user' | 'venue'; queuedAt: string; agentNo: string | null; mine: boolean;
  closedAt: string | null; userReadAt: string | null; userTyping: boolean; userDraft: string; messages: Msg[];
  notes: { id: string; agentNo: string; content: string; createdAt: string }[];
  transfers: { id: string; from: string | null; to: string | null; note: string; createdAt: string }[];
}
interface Canned { id: string; title: string; content: string }

const TOPIC: Record<string, string> = { ACCOUNT: 'Hesap', PAYMENT: 'Ödeme', MEETING: 'Masa', OTHER: 'Diğer' };
const STATUS: [AgentState['me']['status'], string, string][] = [['ONLINE', 'Çevrimiçi', GREEN], ['BREAK', 'Mola', AMBER], ['OFFLINE', 'Çevrimdışı', MUTED]];
const SYS: Record<string, string> = {
  NOTICE: "Hizmet kalitesinin artırılması ve güvenliğin için görüşmelerimiz kayıt altına alınır. Kişisel verilerinle ilgili Aydınlatma Metni'ni inceleyebilirsin.",
  GREETING: 'Merhaba, ben Ahenk Müşteri Temsilcisi. Sana nasıl yardımcı olabilirim?',
  TRANSFERRED: 'Görüşmen başka bir temsilcimize aktarıldı, durumu baştan anlatmana gerek yok.',
  IDLE_WARNING: '1 dakika içinde yanıt vermezsen sohbet sonlanacak.',
};
const EMOJIS = ['😀', '😊', '🙏', '👍', '🙌', '🎉', '❤️', '✨', '😉', '🤗', '👋', '😇'];

const hm = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
const dt = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
function waited(iso: string) { const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000)); return s < 60 ? `${s} sn` : s < 3600 ? `${Math.floor(s / 60)} dk` : `${Math.floor(s / 3600)} sa ${Math.floor((s % 3600) / 60)} dk`; }
const fmtMin = (n: number | null) => (n === null ? '—' : `${n.toFixed(1)} dk`);
const imgUrl = (chatId: string, f: string) => `${API_PREFIX}/admin/live-support/chats/${chatId}/images/${f}`;

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

type Tab = 'chats' | 'canned' | 'reports' | 'agents' | 'restrictions' | 'ai';

export default function CanliDestekAdmin() {
  const role = myRole();
  const tabs: [Tab, string][] = [
    ['chats', 'Sohbetler'],
    ...(role === 'ADMIN' || role === 'SUPERADMIN' ? ([['canned', 'Hazır Yanıtlar'], ['reports', 'Raporlar']] as [Tab, string][]) : []),
    ...(role === 'SUPERADMIN' ? ([['agents', 'Temsilciler'], ['restrictions', 'Kısıtlamalar'], ['ai', 'Haiku Kayıtları']] as [Tab, string][]) : []),
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
      {tab === 'canned' && <CannedTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'agents' && <AgentsTab />}
      {tab === 'restrictions' && <RestrictionsTab />}
      {tab === 'ai' && <AiLogsTab />}
    </div>
  );
}

// ─── Sohbetler ─────────────────────────────────────────────────────────────

function ChatsTab() {
  const [st, setSt] = useState<AgentState | null>(null);
  const [sel, setSel] = useState<string | null>(null);
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

  if (!st) return <p style={{ color: MUTED, fontSize: 13 }}>{err || 'Yükleniyor…'}</p>;
  const superadmin = st.me.role === 'SUPERADMIN';
  const list = (title: string, rows: Row[], showAgent = false) => (
    <div style={{ marginBottom: 14 }}>
      <p style={{ ...LABEL, color: MUTED, marginBottom: 6 }}>{title} ({rows.length})</p>
      {rows.length === 0 && <p style={{ fontSize: 12, color: MUTED }}>—</p>}
      {rows.map((r) => (
        <button key={r.id} onClick={() => setSel(r.id)} style={{ width: '100%', textAlign: 'left', marginBottom: 6, padding: '9px 10px', borderRadius: 10, cursor: r.status === 'QUEUED' && !superadmin ? 'default' : 'pointer', background: sel === r.id ? 'rgba(59,130,246,0.15)' : CARD, border: `1px solid ${sel === r.id ? 'rgba(59,130,246,0.35)' : BORDER}`, color: TEXT }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.requesterName}</span>
            {r.unread > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: RED, color: '#fff' }}>{r.unread}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 11, color: MUTED, flexWrap: 'wrap' }}>
            <span style={{ padding: '1px 7px', borderRadius: 99, border: `1px solid ${BORDER}` }}>{TOPIC[r.topic]}</span>
            <span>{r.kind === 'venue' ? 'Mekân' : 'Üye'}</span>
            <span>· {waited(r.queuedAt)}</span>
            {showAgent && r.agentNo && <span>· Temsilci No {r.agentNo}</span>}
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
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {STATUS.map(([k, l, c]) => (
            <button key={k} onClick={() => setStatus(k)} aria-pressed={st.me.status === k} style={{ ...btn(c, st.me.status === k), color: st.me.status === k ? '#020c1b' : c }}>{l}</button>
          ))}
        </div>
      </div>
      {err && <p style={{ color: RED, fontSize: 12, marginBottom: 8 }}>{err}</p>}
      <div className="cd-grid" style={{ display: 'grid', gap: 12 }}>
        <style>{`.cd-grid{grid-template-columns:1fr}@media(min-width:1100px){.cd-grid{grid-template-columns:260px minmax(0,1fr) 340px}}`}</style>
        <aside className="ll-card" style={{ padding: 12, maxHeight: '78vh', overflowY: 'auto' }}>
          {list('Sıradakiler', st.queue)}
          {list('Açık Sohbetlerim', st.mine)}
          {superadmin && list('Diğer Açık Sohbetler', st.others, true)}
        </aside>
        {sel ? <ChatColumn key={sel} id={sel} st={st} reload={load} onClosed={() => setSel(null)} /> : (
          <div className="ll-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}><p style={{ color: MUTED, fontSize: 13 }}>Soldan bir sohbet seç.</p></div>
        )}
        {sel ? <HaikuPanel chatId={sel} onInsert={(t) => window.dispatchEvent(new CustomEvent('cd-insert', { detail: t }))} /> : <div className="ll-card" />}
      </div>
    </div>
  );
}

function ChatColumn({ id, st, reload, onClosed }: { id: string; st: AgentState; reload: () => void; onClosed: () => void }) {
  const [c, setC] = useState<ChatDetail | null>(null);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [canned, setCanned] = useState<Canned[]>([]);
  const [emoji, setEmoji] = useState(false);
  const [note, setNote] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [abuse, setAbuse] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingAt = useRef(0);
  const count = useRef(0);

  const load = useCallback(async () => {
    try { setC(await api.get<ChatDetail>(`/admin/live-support/chats/${id}`)); setErr(''); } catch (e) { setErr((e as Error).message); }
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
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 700 }}>{c.requesterName}</p>
          <p style={{ fontSize: 11, color: MUTED }}>{TOPIC[c.topic]} · {c.kind === 'venue' ? 'Mekân' : 'Üye'} · bekleme {waited(c.queuedAt)}{c.agentNo ? ` · Temsilci No ${c.agentNo}` : ''}</p>
        </div>
        {open && !c.mine && st.me.role === 'SUPERADMIN' && <button style={btn(BLUE)} onClick={() => act(() => api.post(`/admin/live-support/chats/${id}/take`, {}))}>Devral</button>}
        {open && (c.mine || st.me.role === 'SUPERADMIN') && (
          <>
            <button style={btn(MUTED)} onClick={() => act(() => api.post(`/admin/live-support/chats/${id}/close`, {}), onClosed)}>Kapat</button>
            <button style={btn(RED)} onClick={() => setAbuse((v) => !v)}>Kötüye kullanım</button>
          </>
        )}
      </div>
      {abuse && (
        <div style={{ padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'rgba(239,68,68,0.06)', borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: 12 }}>Sohbeti kapat ve canlı destek erişimini kısıtla:</span>
          {[1, 7, 30].map((d) => <button key={d} style={btn(RED, true)} onClick={() => act(() => api.post(`/admin/live-support/chats/${id}/close`, { abuseDays: d }), onClosed)}>{d} gün</button>)}
        </div>
      )}
      {!open && <p style={{ padding: '8px 14px', fontSize: 12, color: MUTED }}>Sohbet kapandı{c.closedAt ? ` (${dt(c.closedAt)})` : ''}.</p>}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {c.messages.map((m) => {
          const sys = m.sender === 'SYSTEM' && m.content !== 'GREETING';
          if (sys) return <p key={m.id} style={{ alignSelf: 'center', maxWidth: '90%', fontSize: 11, color: MUTED, textAlign: 'center' }}>{SYS[m.content] ?? m.content} · {hm(m.createdAt)}</p>;
          const user = m.sender === 'USER';
          return (
            <div key={m.id} style={{ alignSelf: user ? 'flex-start' : 'flex-end', maxWidth: '78%' }}>
              <div style={{ padding: '7px 10px 5px', borderRadius: 12, background: user ? CARD : 'rgba(59,130,246,0.14)', border: `1px solid ${user ? BORDER : 'rgba(59,130,246,0.35)'}` }}>
                {m.images.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>{m.images.map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={f} src={imgUrl(id, f)} alt="Görsel" onClick={() => setViewer(imgUrl(id, f))} style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 8, cursor: 'zoom-in' }} />
                ))}</div>}
                {(m.content || m.sender === 'SYSTEM') && <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.sender === 'SYSTEM' ? SYS.GREETING : m.content}</p>}
                <p style={{ fontSize: 10, color: MUTED, textAlign: 'right' }}>{!user && m.agentNo ? `No ${m.agentNo} · ` : ''}{hm(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        {c.userReadAt && c.messages.some((m) => m.sender === 'AGENT') && c.userReadAt >= ([...c.messages].reverse().find((m) => m.sender === 'AGENT')?.createdAt ?? '') && <p style={{ alignSelf: 'flex-end', fontSize: 10, color: MUTED }}>Okundu</p>}
        {/* Yazı önizlemesi: kullanıcının gönderilmemiş metni (sunucuda yalnız bellekte) */}
        {c.userTyping && <p style={{ fontSize: 12, color: AMBER, fontStyle: 'italic' }}>Yazıyor…{c.userDraft ? ` “${c.userDraft}”` : ''}</p>}
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
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <button onClick={() => setEmoji((v) => !v)} aria-label="Emoji" style={{ ...btn(MUTED), minWidth: 40 }}>☺</button>
            <button onClick={() => fileRef.current?.click()} aria-label="Görsel ekle" style={{ ...btn(MUTED), minWidth: 40 }}>＋</button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => pick(e.target.files)} />
            <textarea value={text} onChange={(e) => onType(e.target.value)} rows={2} placeholder='Mesaj yaz ("/" ile hazır yanıtlar)'
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !slash.length) { e.preventDefault(); send(); } }}
              style={{ ...inputStyle, flex: 1, resize: 'vertical' }} />
            <button onClick={send} disabled={busy} style={btn(RED, true)}>Gönder</button>
          </div>
        </div>
      )}
      {/* İç not (kullanıcıya asla gösterilmez) ve devir */}
      <details style={{ borderTop: `1px solid ${BORDER}`, padding: '8px 12px' }}>
        <summary style={{ fontSize: 12, color: MUTED, cursor: 'pointer' }}>İç notlar ({c.notes.length}) ve devir geçmişi ({c.transfers.length})</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {c.transfers.map((x) => <p key={x.id} style={{ fontSize: 12, color: AMBER }}>Devir {x.from ?? '—'} → {x.to ?? '—'} · {dt(x.createdAt)}: {x.note}</p>)}
          {c.notes.map((n) => <p key={n.id} style={{ fontSize: 12 }}><span style={{ color: MUTED }}>No {n.agentNo} · {dt(n.createdAt)}:</span> {n.content}</p>)}
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="İç not ekle" style={{ ...inputStyle, flex: 1 }} />
            <button style={btn(BLUE)} onClick={() => note.trim() && act(() => api.post(`/admin/live-support/chats/${id}/notes`, { content: note.trim() }), () => setNote(''))}>Ekle</button>
          </div>
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
      </details>
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
  async function run(draft: boolean) {
    if (busy || (!draft && !q.trim())) return;
    setBusy(true); setErr('');
    try {
      const r = await api.post<{ answer: string }>(`/admin/live-support/chats/${chatId}/ai`, { question: draft ? undefined : q.trim(), draft, includeImages: images });
      setItems((p) => [{ q: draft ? 'Taslak cevap' : q.trim(), a: r.answer }, ...p]);
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
            <button style={btn(MUTED)} onClick={() => navigator.clipboard?.writeText(it.a).catch(() => {})}>Kopyala</button>
            <button style={btn(GREEN)} onClick={() => onInsert(it.a)}>Sohbete ekle</button>
          </div>
        </div>
      ))}
    </aside>
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

// ─── Temsilciler (SUPERADMIN) ──────────────────────────────────────────────

interface AgentRow { userId: string; name: string; email: string; phone: string | null; role: string; active: boolean; agentNo: string | null; status: string | null; createdAt: string }
function AgentsTab() {
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
      <div className="ll-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8, marginBottom: 12 }}>
        <p style={{ gridColumn: '1/-1', fontSize: 13, fontWeight: 600 }}>Temsilci hesabı aç</p>
        {([['firstName', 'Ad'], ['lastName', 'Soyad'], ['email', 'E-posta'], ['phone', 'Telefon (+90…)'], ['password', 'Şifre (en az 8)']] as const).map(([k, l]) => (
          <input key={k} type={k === 'password' ? 'password' : 'text'} value={f[k]} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))} placeholder={l} style={inputStyle} />
        ))}
        <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, alignItems: 'center' }}>
          <button style={btn(GREEN)} onClick={create}>Hesap Aç</button>
          {err && <span style={{ fontSize: 12, color: RED }}>{err}</span>}
          {ok && <span style={{ fontSize: 12, color: GREEN }}>{ok}</span>}
        </div>
      </div>
      {rows.map((r) => (
        <div key={r.userId} className="ll-card" style={{ marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', opacity: r.active ? 1 : 0.55 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>{r.name} <span style={{ fontSize: 11, color: MUTED }}>· {roleTr[r.role] ?? r.role}</span></p>
            <p style={{ fontSize: 11, color: MUTED }}>{r.email} · {r.phone ?? '—'} · Temsilci No {r.agentNo ?? '—'} · {r.status === 'ONLINE' ? 'Çevrimiçi' : r.status === 'BREAK' ? 'Mola' : 'Çevrimdışı'}</p>
          </div>
          {r.role === 'SUPPORT' && (
            <button style={btn(r.active ? RED : GREEN)} onClick={() => api.patch(`/admin/live-support/manage/agents/${r.userId}`, { active: !r.active }).then(load).catch((e) => setErr((e as Error).message))}>
              {r.active ? 'Hesabı Kapat' : 'Hesabı Aç'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Kısıtlamalar (SUPERADMIN kaldırır) ────────────────────────────────────

interface Restr { id: string; requesterName: string; kind: string; days: number; expiresAt: string; createdAt: string; agentNo: string | null; liftedAt: string | null; active: boolean }
function RestrictionsTab() {
  const [rows, setRows] = useState<Restr[]>([]);
  const [err, setErr] = useState('');
  const load = () => api.get<Restr[]>('/admin/live-support/manage/restrictions').then(setRows).catch((e) => setErr((e as Error).message));
  useEffect(() => { load(); }, []);
  return (
    <div style={{ maxWidth: 860 }}>
      {err && <p style={{ color: RED, fontSize: 12 }}>{err}</p>}
      {!rows.length && <p style={{ fontSize: 13, color: MUTED }}>Kısıtlama kaydı yok.</p>}
      {rows.map((r) => (
        <div key={r.id} className="ll-card" style={{ marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>{r.requesterName} <span style={{ fontSize: 11, color: MUTED }}>· {r.kind === 'venue' ? 'Mekân' : 'Üye'}</span></p>
            <p style={{ fontSize: 11, color: MUTED }}>{r.days} gün · {dt(r.createdAt)} → {dt(r.expiresAt)} · Temsilci No {r.agentNo ?? '—'}{r.liftedAt ? ` · kaldırıldı ${dt(r.liftedAt)}` : ''}</p>
          </div>
          {r.active && <button style={btn(GREEN)} onClick={() => api.post(`/admin/live-support/manage/restrictions/${r.id}/lift`, {}).then(load).catch((e) => setErr((e as Error).message))}>Kısıtlamayı Kaldır</button>}
        </div>
      ))}
    </div>
  );
}

// ─── Haiku sorgu kayıtları (SUPERADMIN) ────────────────────────────────────

function AiLogsTab() {
  const [rows, setRows] = useState<{ id: string; agentNo: string; chatId: string; question: string; tools: string[]; createdAt: string }[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => { api.get<typeof rows>('/admin/live-support/manage/ai-logs').then(setRows).catch((e) => setErr((e as Error).message)); }, []);
  return (
    <div className="ll-card" style={{ overflowX: 'auto' }}>
      {err && <p style={{ color: RED, fontSize: 12 }}>{err}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr style={{ color: MUTED, textAlign: 'left' }}>{['Zaman', 'Temsilci No', 'Sohbet ID', 'Soru', 'Çağrılan işlevler'].map((h) => <th key={h} style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: `1px solid ${BORDER}` }}>
              <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{dt(r.createdAt)}</td>
              <td style={{ padding: '6px 8px', fontFamily: MONO }}>{r.agentNo}</td>
              <td style={{ padding: '6px 8px', fontFamily: MONO, fontSize: 10 }}>{r.chatId}</td>
              <td style={{ padding: '6px 8px' }}>{r.question}</td>
              <td style={{ padding: '6px 8px' }}>{r.tools.join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p style={{ fontSize: 12, color: MUTED }}>Kayıt yok.</p>}
    </div>
  );
}
