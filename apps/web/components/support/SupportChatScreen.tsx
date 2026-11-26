'use client';

// Canlı Destek kullanıcı ekranı (üye ve mekân sahibi aynı ekran; mobil app/canli-destek.tsx ile aynı akış).
// Anlık iletişim Masa Sohbeti gibi kısa aralıklı yoklama (3 sn). Konu seçimi → sıra → temsilci → sohbet → değerlendirme.
// Kullanıcı geçmiş destek sohbetlerini göremez: sohbet kapanınca ekrandan kalkar. Küçült butonu sohbeti baloncuğa alır (SupportBubble);
// kuyruktayken "Beklerken oyna" Breakout açar, temsilci bağlanınca ya da küçültülünce oyun tamamen kapanır.
// Maskot: kuyrukta sıra satırının üstünde tam sürüm (72 px yükseklik), temsilci bağlanınca başlığın solunda tam sürüm (36 px yükseklik),
// sohbet alanında sabit filigran (tam sürüm, alan genişliğinin %60'ı, ortada, opaklık %8 koyu tema; oyun açıkken gizli).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { StdButton } from '@ahenk/ui';
import { Link } from '@/i18n/navigation';
import { api, API_PREFIX, langHeaders } from '@/lib/api';
import { venueApi } from '@/lib/venueApi';
import { Breakout } from './Breakout';
import { AttachIcon, AutoTextarea, EmojiIcon, SendIcon, StatusPill } from './ChatParts';

// Baloncuk (SupportBubble) sohbet başlatılınca / küçültülünce durumu yeniden okur
export const SUPPORT_EVENT = 'ahenk:support';

type Sender = 'USER' | 'AGENT' | 'SYSTEM';
interface Msg { id: string; sender: Sender; agentNo: string | null; content: string; images: string[]; createdAt: string; pending?: boolean }
interface ChatView {
  id: string; status: 'QUEUED' | 'ACTIVE'; topic: string; agentNo: string | null;
  queue: { position: number; ahead: number; etaMin: number | null; online: boolean } | null;
  agentTyping: boolean; agentOnline: boolean; agentReadAt: string | null; messages: Msg[];
}
interface State { restriction: { expiresAt: string } | null; chat: ChatView | null; pendingRating: string | null }

const TOPICS = ['ACCOUNT', 'PAYMENT', 'MEETING', 'OTHER'] as const;
const EMOJIS = ['😀', '😂', '😊', '😍', '🥰', '😎', '🤔', '😅', '😉', '🙏', '👍', '👏', '🙌', '💪', '🎉', '❤️', '🔥', '✨', '☕', '😮', '😢', '👋', '🤝', '😇', '🤗'];
const TAGS = {
  good: ['CARED', 'SOLUTION', 'POLITE', 'FAST', 'PROCESS_OK'],
  mid: ['MORE_CARING', 'KNOWLEDGE', 'FASTER', 'PROCESS_IMPROVE'],
  bad: ['UNINTERESTED', 'NO_REPLY', 'LACK_KNOWLEDGE', 'RUDE', 'PROCESS_BAD', 'SLOW'],
} as const;
const MAX_IMAGES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const RED = '#c0392b';
const TEXT = '#f4f1ec';
const MUTED = '#a39c93';
// Canlı destek maskotu (public/maskot); filigran opaklığı: uygulama yalnız koyu temada (%8)
const MASCOT_FULL = '/maskot/destek-tam.webp';
// Sohbet başlığı (temsilci ekranı başlığının oranlarında küçük): maskot yüksekliği ve küçült butonunun görünen çapı
const MASCOT_HEADER = 36;
const MIN_BTN = 22;
const WATERMARK_OPACITY = 0.08;
const TYPING_GAP_MS = 300; // yazı önizlemesi en fazla 300 ms aralıkla gönderilir

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Istanbul' });

// Kısıtlamanın kalan süresi ("2 gün 5 saat" / "3 saat 12 dakika")
export function supportRemaining(iso: string, t: (k: string, v?: Record<string, number>) => string) {
  const ms = Math.max(0, new Date(iso).getTime() - Date.now());
  const d = Math.floor(ms / 86_400_000); const h = Math.floor((ms % 86_400_000) / 3_600_000); const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? t('sup.timeDH', { d, h }) : t('sup.timeHM', { h, m });
}

// Üye: /support (üye oturumu); mekân: /venue-panel/support (mekân çerezi)
function clientFor(mode: 'member' | 'venue') {
  const base = mode === 'member' ? `${API_PREFIX}/support` : `${API_PREFIX}/venue-panel/support`;
  return {
    get: <T,>(p: string) => (mode === 'member' ? api.get<T>(`/support${p}`) : venueApi.get<T>(`/support${p}`)),
    post: <T,>(p: string, body: unknown = {}) => (mode === 'member' ? api.post<T>(`/support${p}`, body) : venueApi.post<T>(`/support${p}`, body)),
    form: async <T,>(p: string, fd: FormData): Promise<T> => {
      const res = await fetch(`${base}${p}`, { method: 'POST', body: fd, credentials: 'include', headers: langHeaders() });
      const data = await res.json().catch(() => null) as { message?: string | string[] } | null;
      if (!res.ok) throw new Error((Array.isArray(data?.message) ? data?.message[0] : data?.message) ?? '');
      return data as T;
    },
    image: (chatId: string, file: string) => `${base}/chats/${chatId}/images/${file}`,
  };
}

export function SupportChatScreen({ mode, onExit, onMinimize }: { mode: 'member' | 'venue'; onExit?: () => void; onMinimize?: () => void }) {
  const t = useTranslations();
  const client = useRef(clientFor(mode)).current;
  const [state, setState] = useState<State | null>(null);
  const [rateFor, setRateFor] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const s = await client.get<State>('/state');
      // Sohbet bitince (kullanıcı, temsilci ya da otomatik) değerlendirme ekranı açılır; kötüye kullanımla kapananda açılmaz
      if (!s.chat && s.pendingRating) setRateFor((r) => r ?? s.pendingRating);
      setState(s);
    } catch (e) { setError((e as Error).message || t('sup.error')); }
  }, [client, t]);

  useEffect(() => { load(); const id = setInterval(load, 3000); return () => clearInterval(id); }, [load]);

  async function start(topic: string) {
    setError('');
    try { await client.post('/chats', { topic }); await load(); window.dispatchEvent(new Event(SUPPORT_EVENT)); } catch (e) { setError((e as Error).message || t('sup.error')); }
  }

  if (!state) return <p style={{ color: MUTED, fontSize: 13 }}>…</p>;

  if (thanks) {
    return (
      <div className="ll-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ color: TEXT, fontSize: 15, lineHeight: 1.5 }}>{t('sup.rateThanks')}</p>
        <StdButton variant="primary" onClick={() => { setThanks(false); setRateFor(null); onExit?.(); }} className="w-full">{t('sup.close')}</StdButton>
      </div>
    );
  }
  if (rateFor && !state.chat) return <RatingView client={client} chatId={rateFor} onDone={() => setThanks(true)} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!!error && <p role="alert" style={{ color: '#ff6b6b', fontSize: 13 }}>{error}</p>}
      {state.chat ? (
        <ChatPanel client={client} chat={state.chat} reload={load} onEnded={(id) => setRateFor(id)} onMinimize={() => { window.dispatchEvent(new Event(SUPPORT_EVENT)); onMinimize?.(); }} />
      ) : state.restriction ? (
        <div className="ll-card"><p style={{ color: TEXT, fontSize: 14 }}>{t('sup.restricted', { time: supportRemaining(state.restriction.expiresAt, t) })}</p></div>
      ) : (
        <div className="ll-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="font-serif" style={{ fontSize: 22, color: TEXT }}>{t('sup.header')}</p>
          <p style={{ fontSize: 13, color: MUTED }}>{t('sup.chooseTopic')}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {TOPICS.map((k) => (
              <button key={k} type="button" onClick={() => start(k)}
                style={{ minHeight: 48, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: TEXT, fontSize: 14, cursor: 'pointer' }}>
                {t(`sup.topic${k}`)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type Client = ReturnType<typeof clientFor>;

function ChatPanel({ client, chat, reload, onEnded, onMinimize }: { client: Client; chat: ChatView; reload: () => void; onEnded: (id: string) => void; onMinimize: () => void }) {
  const t = useTranslations();
  const [msgs, setMsgs] = useState<Msg[]>(chat.messages);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [emoji, setEmoji] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingAt = useRef(0);
  // Oyun yalnız kuyruktayken; temsilci bağlanınca tamamen kapanır
  const [game, setGame] = useState(false);
  const [endAsk, setEndAsk] = useState(false);
  useEffect(() => { if (chat.status !== 'QUEUED') setGame(false); }, [chat.status]);

  useEffect(() => {
    setMsgs((prev) => [...chat.messages, ...prev.filter((m) => m.pending)]);
  }, [chat.messages]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs.length]);

  // Yazı önizlemesi: atanmış temsilci gönderilmeden önce görür (sunucuda yalnız bellekte, 5 sn). En fazla 300 ms aralıkla son metin
  // gönderilir; çubuk tamamen silinince hemen boş gider (önizleme ve yazıyor kalkar)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const draftRef = useRef('');
  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current); }, []);
  function pushTyping() { typingAt.current = Date.now(); client.post(`/chats/${chat.id}/typing`, { text: draftRef.current }).catch(() => undefined); }
  function onType(v: string) {
    const val = v.slice(0, 2000);
    setText(val);
    draftRef.current = val;
    const wait = TYPING_GAP_MS - (Date.now() - typingAt.current);
    if (!val.trim() || wait <= 0) { if (typingTimer.current) { clearTimeout(typingTimer.current); typingTimer.current = undefined; } pushTyping(); return; }
    if (!typingTimer.current) typingTimer.current = setTimeout(() => { typingTimer.current = undefined; pushTyping(); }, wait);
  }

  function pick(list: FileList | null) {
    setErr('');
    const next = [...files];
    for (const f of Array.from(list ?? [])) {
      if (!OK_TYPES.includes(f.type)) { setErr(t('sup.imgType')); continue; }
      if (f.size > MAX_BYTES) { setErr(t('sup.imgSize')); continue; }
      if (next.length >= MAX_IMAGES) { setErr(t('sup.imgLimit')); break; }
      next.push(f);
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function send() {
    const content = text.trim();
    if ((!content && !files.length) || busy) return;
    setBusy(true); setErr(''); setEmoji(false);
    const temp: Msg = { id: `p-${Date.now()}`, sender: 'USER', agentNo: null, content, images: [], createdAt: new Date().toISOString(), pending: true };
    setMsgs((p) => [...p, temp]);
    const fd = new FormData();
    if (content) fd.append('content', content);
    files.forEach((f) => fd.append('images', f));
    setText(''); setFiles([]);
    // Gönderilince bekleyen önizleme gönderimi iptal (sunucu mesajla birlikte önizlemeyi siler)
    if (typingTimer.current) { clearTimeout(typingTimer.current); typingTimer.current = undefined; }
    draftRef.current = '';
    try { await client.form(`/chats/${chat.id}/messages`, fd); setMsgs((p) => p.filter((m) => m.id !== temp.id)); reload(); }
    catch (e) { setMsgs((p) => p.filter((m) => m.id !== temp.id)); setErr((e as Error).message || t('sup.error')); }
    finally { setBusy(false); }
  }

  async function end() {
    try { await client.post(`/chats/${chat.id}/close`); onEnded(chat.id); reload(); } catch (e) { setErr((e as Error).message || t('sup.error')); }
  }

  // Okundu: yalnız kendi mesajlarından temsilcinin okuduğu sonuncusunun altında
  const readId = chat.agentReadAt ? [...msgs].reverse().find((m) => m.sender === 'USER' && !m.pending && m.createdAt <= chat.agentReadAt!)?.id : undefined;
  const status = chat.agentTyping ? 'typing' : chat.agentOnline ? 'online' : 'offline';

  return (
    <div className="ll-card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', height: 'min(72dvh, 680px)' }}>
      {/* Başlık (kuyrukta ve bağlıyken; temsilci ekranı başlığının oranlarında küçük): bağlıyken solda maskot tam sürüm, sağında
          1. satır "Müşteri Temsilcisi", 2. satır Temsilci No + durum etiketi ve en sağda SONLANDIR; küçült butonu kartın sağ üst köşesinde.
          Hiçbir yazı kesilmez; dar ekranda 2. satır kendi içinde alt satıra geçer. Temsilcinin adı ve cinsiyeti hiçbir yerde gösterilmez */}
      <div style={{ position: 'relative', padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {chat.status === 'ACTIVE' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={MASCOT_FULL} alt="" aria-hidden height={MASCOT_HEADER} style={{ height: MASCOT_HEADER, width: 'auto', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, lineHeight: '18px', paddingRight: MIN_BTN + 4 }}>{t('sup.agentTitle')}</p>
          <div style={{ display: 'flex', alignItems: 'center', columnGap: 6, rowGap: 4, flexWrap: 'wrap' }}>
            {chat.status === 'ACTIVE' && !!chat.agentNo && (<>
              <span style={{ fontSize: 10, fontWeight: 400, color: MUTED, whiteSpace: 'nowrap' }}>{t('sup.agentNo', { no: chat.agentNo })}</span>
              <StatusPill small status={status} label={status === 'typing' ? t('sup.typing') : status === 'online' ? t('sup.online') : t('sup.offlineStatus')} />
            </>)}
            <button type="button" className="btn-ghost" onClick={() => setEndAsk(true)} style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 9, lineHeight: 1.5, gap: 6, whiteSpace: 'nowrap' }}>{t('sup.endShort')}</button>
          </div>
        </div>
        {/* Küçült: kartın sağ üst köşesinde çerçeveli küçük yuvarlak buton (yatay çizgi) */}
        <button type="button" aria-label={t('sup.minimize')} title={t('sup.minimize')} onClick={onMinimize}
          style={{ position: 'absolute', top: 6, right: 8, width: MIN_BTN, height: MIN_BTN, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={TEXT} strokeWidth={2.4} strokeLinecap="round" aria-hidden><path d="M5 12h14" /></svg>
        </button>
      </div>
      {/* Sonlandır onayı (site paleti): Evet → mevcut sonlandırma akışı (değerlendirme dahil), Hayır / dışarı basma / Esc → işlem yok */}
      {endAsk && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }} role="dialog" aria-modal="true" aria-labelledby="sup-end-title"
          onClick={() => setEndAsk(false)} onKeyDown={(e) => { if (e.key === 'Escape') setEndAsk(false); }}>
          <div className="ll-card w-full max-w-md flex flex-col gap-4" style={{ background: '#121212' }} onClick={(e) => e.stopPropagation()}>
            <h3 id="sup-end-title" style={{ margin: 0, textAlign: 'center', fontSize: 17, lineHeight: 1.35, fontWeight: 700, color: TEXT }}>{t('sup.endConfirm')}</h3>
            <div className="flex gap-3">
              <StdButton variant="ghost" autoFocus onClick={() => setEndAsk(false)} className="justify-center" style={{ flex: 1 }}>{t('sup.no')}</StdButton>
              <StdButton variant="primary" onClick={() => { setEndAsk(false); void end(); }} className="justify-center" style={{ flex: 1 }}>{t('sup.yes')}</StdButton>
            </div>
          </div>
        </div>
      )}
      {chat.status === 'QUEUED' && chat.queue && (
        <div style={{ padding: game ? '6px 16px' : '10px 16px', background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
          {/* Oyun açıkken sıra ve tahmin satırı üstte küçük */}
          {!chat.queue.online && !game && <p style={{ fontSize: 13, color: TEXT, lineHeight: 1.5, marginBottom: 4 }}>{t('sup.offline')}</p>}
          {/* Sıra bilgisinin hemen üstünde maskot (tam sürüm, 72 px yükseklik); oyun açıkken sıra satırı küçük kaldığı için gösterilmez */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {!game && <img src={MASCOT_FULL} alt="" aria-hidden height={72} style={{ display: 'block', height: 72, width: 'auto', marginBottom: 4 }} />}
          <p style={{ fontSize: game ? 11 : 13, color: chat.queue.online && !game ? TEXT : MUTED, lineHeight: 1.5 }}>
            {chat.queue.etaMin !== null ? t('sup.queue', { n: chat.queue.ahead, m: chat.queue.etaMin }) : t('sup.queueNoEta', { n: chat.queue.ahead })}
          </p>
          {!game && <StdButton variant="ghost" onClick={() => setGame(true)} style={{ marginTop: 8 }}>{t('sup.play')}</StdButton>}
        </div>
      )}
      {game ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          <Breakout />
          {/* Oyunu kapat: oyun tamamen kapanır (bileşen kaldırılır), sıra ekranına dönülür; hiçbir oyun verisi saklanmaz */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><StdButton variant="ghost" onClick={() => setGame(false)}>{t('sup.closeGame')}</StdButton></div>
        </div>
      ) : (<>
      {/* Filigran: sohbet alanının ortasında sabit (mesajlar üstünden kayar), dokunma almaz; renkler korunur */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MASCOT_FULL} alt="" aria-hidden style={{ position: 'absolute', top: '50%', left: '50%', width: '60%', height: 'auto', transform: 'translate(-50%, -50%)', opacity: WATERMARK_OPACITY, pointerEvents: 'none', userSelect: 'none' }} />
        <div ref={listRef} style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {msgs.map((m) => (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <Bubble m={m} chatId={chat.id} client={client} onImage={setViewer} />
              {m.id === readId && <p style={{ alignSelf: 'flex-end', fontSize: 10, color: MUTED, marginTop: 2 }}>{t('sup.read')}</p>}
            </div>
          ))}
        </div>
      </div>
      {!!err && <p role="alert" style={{ padding: '0 14px 6px', fontSize: 12, color: '#ff6b6b' }}>{err}</p>}
      {files.length > 0 && (
        <div style={{ display: 'flex', gap: 8, padding: '0 14px 8px' }}>
          {files.map((f, i) => (
            <div key={i} style={{ position: 'relative', width: 56, height: 56 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(f)} alt={t('sup.image')} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
              <button type="button" aria-label={t('sup.removeImage')} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, border: 'none', background: RED, color: '#fff', fontSize: 12, cursor: 'pointer' }}>×</button>
            </div>
          ))}
        </div>
      )}
      {emoji && (
        <div style={{ display: 'flex', flexWrap: 'wrap', padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {EMOJIS.map((e) => <button key={e} type="button" onClick={() => setText((v) => (v + e).slice(0, 2000))} style={{ width: 40, height: 40, fontSize: 22, background: 'none', border: 'none', cursor: 'pointer' }}>{e}</button>)}
        </div>
      )}
      {/* Mesaj kutusu: dosya, emoji, yazı alanı ve gönder ikonu kutunun içinde (temsilci ekranıyla aynı düzen) */}
      <div style={{ padding: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', minHeight: 48, borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', padding: '2px 2px' }}>
          <button type="button" aria-label={t('sup.attach')} onClick={() => fileRef.current?.click()} style={ICON_BTN}><AttachIcon color={RED} /></button>
          <button type="button" aria-label={t('sup.emoji')} onClick={() => setEmoji((v) => !v)} style={ICON_BTN}><EmojiIcon color={RED} /></button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => pick(e.target.files)} />
          <AutoTextarea value={text} onChange={onType} onEnter={send} />
          <button type="button" aria-label={t('sup.send')} onClick={send} disabled={busy || (!text.trim() && !files.length)} style={{ ...ICON_BTN, opacity: busy || (!text.trim() && !files.length) ? 0.5 : 1 }}>
            <SendIcon />
          </button>
        </div>
      </div>
      </>)}
      {viewer && (
        <div role="dialog" aria-modal="true" onClick={() => setViewer(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewer} alt={t('sup.image')} style={{ maxWidth: '94vw', maxHeight: '90vh', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}

const ICON_BTN: React.CSSProperties = { width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' };

function Bubble({ m, chatId, client, onImage }: { m: Msg; chatId: string; client: Client; onImage: (u: string) => void }) {
  const t = useTranslations();
  if (m.sender === 'SYSTEM' && m.content !== 'GREETING') {
    return (
      <div style={{ alignSelf: 'center', maxWidth: '90%', padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, textAlign: 'center' }}>
          {m.content === 'NOTICE' ? (
            <>{t('sup.sysNoticePre')}<Link href="/kvkk" target="_blank" rel="noopener noreferrer" style={{ color: TEXT, textDecoration: 'underline' }}>{t('sup.sysNoticeLink')}</Link>{t('sup.sysNoticePost')}</>
          ) : m.content === 'TRANSFERRED' ? t('sup.sysTransferred') : m.content === 'IDLE_WARNING' ? t('sup.sysIdle') : m.content}
        </p>
        {/* Kayıt bildirimi (NOTICE) saatsiz */}
        {m.content !== 'NOTICE' && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 2 }}>{time(m.createdAt)}</p>}
      </div>
    );
  }
  const own = m.sender === 'USER';
  const body = m.sender === 'SYSTEM' ? t('sup.sysGreeting') : m.content;
  return (
    <div style={{ alignSelf: own ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
      <div style={{ padding: '7px 10px 5px', borderRadius: 12, borderBottomRightRadius: own ? 2 : 12, borderBottomLeftRadius: own ? 12 : 2, background: own ? 'rgba(192,57,43,0.16)' : 'rgba(255,255,255,0.05)', border: `1px solid ${own ? 'rgba(192,57,43,0.4)' : 'rgba(255,255,255,0.1)'}`, opacity: m.pending ? 0.7 : 1 }}>
        {m.images.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: body ? 6 : 0 }}>
            {m.images.map((f) => {
              const url = client.image(chatId, f);
              // eslint-disable-next-line @next/next/no-img-element
              return <img key={f} src={url} alt={t('sup.image')} onClick={() => onImage(url)} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, cursor: 'zoom-in' }} />;
            })}
          </div>
        )}
        {!!body && <p style={{ fontSize: 14, color: TEXT, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{body}</p>}
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textAlign: 'right', marginTop: 2 }}>{m.pending ? t('sup.sending') : time(m.createdAt)}</p>
      </div>
    </div>
  );
}

function RatingView({ client, chatId, onDone }: { client: Client; chatId: string; onDone: () => void }) {
  const t = useTranslations();
  const [helped, setHelped] = useState<boolean | null>(null);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const group = stars >= 4 ? 'good' : stars >= 2 ? 'mid' : stars === 1 ? 'bad' : null;
  const can = helped !== null && stars > 0 && !busy;
  useEffect(() => { setTags([]); }, [group]);

  async function submit() {
    if (!can) return;
    setBusy(true); setErr('');
    try { await client.post(`/chats/${chatId}/rating`, { helped, stars, tags, comment: comment.trim() || undefined }); onDone(); }
    catch (e) { setErr((e as Error).message || t('sup.error')); }
    finally { setBusy(false); }
  }

  const pill = (on: boolean): React.CSSProperties => ({ minHeight: 44, padding: '0 14px', borderRadius: 22, cursor: 'pointer', fontSize: 13, color: on ? '#fff' : TEXT, background: on ? RED : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? RED : 'rgba(255,255,255,0.12)'}` });
  return (
    <div className="ll-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 10 }}>{t('sup.rateHelped')}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={pill(helped === true)} onClick={() => setHelped(true)}>{t('sup.yes')}</button>
          <button type="button" style={pill(helped === false)} onClick={() => setHelped(false)}>{t('sup.no')}</button>
        </div>
      </div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 10 }}>{t('sup.rateStars')}</p>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={t('sup.star', { n })} onClick={() => setStars(n)} style={{ width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', fontSize: 30, color: n <= stars ? '#e0a526' : 'rgba(255,255,255,0.2)' }}>★</button>
          ))}
        </div>
      </div>
      {group && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 10 }}>{t(group === 'good' ? 'sup.rateGood' : group === 'mid' ? 'sup.rateMid' : 'sup.rateBad')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TAGS[group].map((k) => {
              const on = tags.includes(k);
              return <button key={k} type="button" style={pill(on)} onClick={() => setTags((p) => (on ? p.filter((x) => x !== k) : [...p, k]))}>{t(`sup.tag${k}`)}</button>;
            })}
          </div>
        </div>
      )}
      <textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 1000))} placeholder={t('sup.rateComment')} rows={3}
        style={{ resize: 'vertical', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: TEXT, fontSize: 14, outline: 'none' }} />
      {!!err && <p role="alert" style={{ fontSize: 12, color: '#ff6b6b' }}>{err}</p>}
      <StdButton variant="primary" onClick={submit} disabled={!can} className="w-full disabled:opacity-40">{t('sup.rateSubmit')}</StdButton>
    </div>
  );
}
