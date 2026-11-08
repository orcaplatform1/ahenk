'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KankaPairs, type KankaPerson } from './KankaPairs';
import { DetayAvatar } from './DetayAvatar';
import { gColor } from './MasalarDashboard';

type KankaParticipant = KankaPerson & { pair?: 'MINE' | 'OTHER' };

// ── Tipler ──────────────────────────────────────────────────────────────────
export interface DetayParticipant {
  initials: string;
  gender: 'MALE' | 'FEMALE' | string | null;
}

export interface VenuePhoto {
  url: string;
  caption?: string;
}

export interface AiReport {
  content: string;
  uyumSkoru: number;
  generatedAt: string;
}

export interface MasaDetayData {
  id: string;
  type?: 'GROUP' | 'ONE_ON_ONE' | 'KANKA';
  maxParticipants?: number;
  scheduledAt: string;
  sosEndsAt: string; // Acil yardımın bittiği an (backend tek kaynak)
  venueName: string;
  venueAddress?: string | null;
  venueMapsUrl?: string | null;
  venuePhotos?: VenuePhoto[];
  participants: DetayParticipant[];
  aiReport?: AiReport | null;
}

interface ChatMsg {
  id: string;
  content: string;
  createdAt: string;
  isOwn: boolean;
  senderInitials: string;
  senderGender?: string | null;
  seatNo?: number | null; // Masaya özel anonim sandalye no (art arda mesaj serisi)
  reportedByMe: boolean;
}

// Mesaj saati: SS:DD (Europe/Istanbul)
function msgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
}

// Masa kartındaki baş harf rozetinin küçük hali
function ChatBadge({ initials, gender }: { initials: string; gender?: string | null }) {
  return (
    <span style={{
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: gender === 'FEMALE' ? 'rgba(244,143,177,0.12)' : 'rgba(79,195,247,0.12)',
      border: `1.5px solid ${gColor(gender)}`,
      // Rozet boyutu sabit; üst simge numaralı (uzun) metinde yazı küçülür, rozet dışına taşmaz
      fontSize: initials.length > 4 ? 7.5 : 8.5, fontWeight: 700, color: '#f0f0f0', fontFamily: 'Inter, sans-serif', letterSpacing: '0.02em',
      overflow: 'hidden', whiteSpace: 'nowrap',
    }}>
      {initials.toUpperCase()}
    </span>
  );
}

interface Props {
  masa: MasaDetayData;
  apiBase?: string;
  // Verilirse Bearer başlığı eklenir; web oturumu HttpOnly çerezle gider (credentials: 'include')
  token?: string;
  archive?: boolean; // Geçmiş masa: yalnızca Haritada Gör çalışır, sohbet ve acil yardım yok (apiBase verilmez)
}

function jsonHeaders(token?: string): Record<string, string> {
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

// ── Renkler ─────────────────────────────────────────────────────────────────
const GREEN      = '#27ae60';
const RED        = '#c0392b';

function buildOrdered(participants: DetayParticipant[]): DetayParticipant[] {
  const males   = participants.filter(p => p.gender === 'MALE');
  const females = participants.filter(p => p.gender === 'FEMALE');
  const others  = participants.filter(p => p.gender !== 'MALE' && p.gender !== 'FEMALE');
  const ordered: DetayParticipant[] = [];
  const len = Math.max(males.length, females.length);
  for (let i = 0; i < len; i++) {
    if (i < males.length)   ordered.push(males[i]);
    if (i < females.length) ordered.push(females[i]);
  }
  return [...ordered, ...others];
}

function formatMeetingTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const trMs   = d.getTime() + 3 * 3600 * 1000;
    const trDate = new Date(trMs);
    const h = trDate.getUTCHours().toString().padStart(2, '0');
    const m = trDate.getUTCMinutes().toString().padStart(2, '0');
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return `${days[trDate.getUTCDay()]} · ${h}:${m}`;
  } catch { return ''; }
}

function mapsUrl(url?: string | null, address?: string | null): string | null {
  if (url) return url;
  if (address) return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  return null;
}

// ── Lightbox ──────────────────────────────────────────────────────────────
function Lightbox({ photos, startIdx, onClose }: { photos: VenuePhoto[]; startIdx: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIdx);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowRight')  setIdx(i => Math.min(i + 1, photos.length - 1));
      if (e.key === 'ArrowLeft')   setIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [photos.length, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <motion.img
        key={idx} src={photos[idx].url} alt={photos[idx].caption ?? ''}
        initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '75vh', objectFit: 'contain', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)' }}
      />
      {photos[idx].caption && (
        <p style={{ color: '#aaa', fontSize: 13, marginTop: 12, fontFamily: 'Inter, sans-serif' }}>{photos[idx].caption}</p>
      )}
      {photos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }} onClick={e => e.stopPropagation()}>
          {photos.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0, transition: 'background 0.2s',
                background: i === idx ? '#f5f5f5' : 'rgba(255,255,255,0.25)' }} />
          ))}
        </div>
      )}
      <button onClick={onClose}
        style={{ position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#f5f5f5', borderRadius: '50%', width: 36, height: 36,
          cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        ×
      </button>
    </motion.div>
  );
}

// ── SOS Modal ─────────────────────────────────────────────────────────────
const SOS_THREATS = [
  { value: 'LIFE_DANGER',       label: 'Hayatım tehlikede' },
  { value: 'PHYSICAL_VIOLENCE', label: 'Fiziksel şiddet gördüm' },
  { value: 'ABDUCTION',         label: 'Zorla alıkoyuluyorum' },
  { value: 'HARASSMENT',        label: 'Taciz veya istismara uğradım' },
] as const;

function SosModal({
  selectedThreats,
  onToggle,
  onConfirm,
  onClose,
  loading,
  locError,
  error,
}: {
  selectedThreats: string[];
  onToggle: (t: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  locError: 'off' | 'denied' | null;
  error: string;
}) {
  // Sahte ihbar beyanı işaretlenmeden ve en az bir tehdit türü seçilmeden talep gönderilemez
  const [accepted, setAccepted] = useState(false);
  const canSubmit = selectedThreats.length > 0 && accepted && !loading;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(10,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380,
          background: '#0f0808',
          border: '1.5px solid rgba(192,57,43,0.7)',
          borderRadius: 16, padding: '24px 20px 20px',
          boxShadow: '0 0 40px rgba(192,57,43,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#ff6b6b', fontFamily: 'Inter, sans-serif', letterSpacing: '0.02em' }}>
            ACİL YARDIM TALEP FORMU
          </span>
        </div>
        <div style={{ height: 1, background: 'rgba(192,57,43,0.3)', margin: '10px 0 16px' }} />

        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(255,107,107,0.7)', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
          Yaşadığın durumu seç:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {SOS_THREATS.map(t => {
            const selected = selectedThreats.includes(t.value);
            return (
              <button
                key={t.value}
                onClick={() => onToggle(t.value)}
                style={{
                  textAlign: 'left', padding: '11px 14px', borderRadius: 9, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: selected ? 600 : 400,
                  background: selected ? 'rgba(192,57,43,0.2)' : 'rgba(255,255,255,0.04)',
                  border: selected ? '1px solid rgba(192,57,43,0.6)' : '1px solid rgba(255,255,255,0.08)',
                  color: selected ? '#ff6b6b' : '#ccc',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: selected ? '1.5px solid #ff6b6b' : '1.5px solid rgba(255,255,255,0.2)',
                  background: selected ? 'rgba(192,57,43,0.3)' : 'transparent',
                  fontSize: 10,
                }}>
                  {selected ? '✓' : ''}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif', fontStyle: 'italic', lineHeight: 1.5 }}>
          Yukarıdaki eylemlerin ihtimali olsa dahi lütfen işaretleyin (birden fazla seçeneği işaretleyebilirsin)
        </p>

        {locError === 'denied' && (
          <div style={{ padding: '10px 12px', background: 'rgba(255,165,0,0.08)', border: '1px solid rgba(255,165,0,0.3)', borderRadius: 8, marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 11.5, color: '#ffb347', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
              ⚠ Konuma erişim engellendi. Tarayıcı adres çubuğundaki kilit simgesine tıklayarak konum iznini ver, ardından tekrar dene.
            </p>
          </div>
        )}
        {locError === 'off' && (
          <div style={{ padding: '10px 12px', background: 'rgba(255,165,0,0.08)', border: '1px solid rgba(255,165,0,0.3)', borderRadius: 8, marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 11.5, color: '#ffb347', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
              ⚠ Cihaz konumu kapalı. Konum servisini açtıktan sonra tekrar dene.
            </p>
          </div>
        )}
        {error && (
          <div style={{ padding: '10px 12px', background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.5)', borderRadius: 8, marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 11.5, color: '#ff6b6b', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
              ⚠ Talep gönderilemedi: {error}
            </p>
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={e => setAccepted(e.target.checked)}
            style={{ marginTop: 2, accentColor: '#c0392b', flexShrink: 0 }}
          />
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
            Acil yardım talebimin sahte olmadığını ve ihbardan kaynaklı doğacak tüm yasal sorumluluğu kabul ediyorum.
          </span>
        </label>

        <button
          onClick={onConfirm}
          disabled={!canSubmit}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 10, cursor: canSubmit ? 'pointer' : 'not-allowed',
            background: 'linear-gradient(135deg, #7b0000 0%, #c0392b 60%, #ff6b6b 100%)',
            border: 'none',
            color: '#fff', fontSize: 14, fontWeight: 800,
            fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em',
            opacity: canSubmit ? 1 : 0.45,
            transition: 'opacity 0.2s',
            boxShadow: canSubmit ? '0 0 16px rgba(192,57,43,0.5)' : 'none',
          }}
        >
          {loading ? 'Konum alınıyor…' : error ? 'Tekrar dene' : 'İhbarda Bulun'}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Sohbet Bölümü ─────────────────────────────────────────────────────────
function ChatSection({ meetingId, apiBase, token }: { meetingId: string; apiBase: string; token?: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [openAt, setOpenAt] = useState<string | null>(null);
  const [closeAt, setCloseAt] = useState<string | null>(null); // Buluşma günü 22:00 TR (backend)
  const [sendError, setSendError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const headers = jsonHeaders(token);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/chat/${meetingId}/messages`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      // Başarısız yenilemede (arka plandan dönüş, bağlantı kopması) ekrandaki mesajlar ve bölüm olduğu gibi kalır
      if (!res.ok) return;
      const data = await res.json() as { isOpen: boolean; isClosed: boolean; openAt: string; closeAt?: string; messages: ChatMsg[] };
      setIsOpen(data.isOpen);
      setOpenAt(data.openAt);
      setCloseAt(data.closeAt ?? null);
      setIsClosed(data.isClosed || (!!data.closeAt && Date.now() >= new Date(data.closeAt).getTime()));
      // Sunucudan gelenler mevcut listeyle birleştirilir; aynı mesaj iki kez gösterilmez
      setMessages(prev => {
        const byId = new Map(prev.map(m => [m.id, m]));
        for (const m of data.messages ?? []) byId.set(m.id, m);
        return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      });
    } catch { /* ekrandaki veri korunur */ }
  }, [meetingId, apiBase, token]);

  useEffect(() => {
    fetchMessages();
    const id = setInterval(fetchMessages, 8000);
    // Sayfa tekrar görünür olduğunda, pencere odaklandığında ve internet geri geldiğinde yeniden çekilir
    const onVisible = () => { if (!document.hidden) fetchMessages(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', fetchMessages);
    window.addEventListener('online', fetchMessages);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', fetchMessages);
      window.removeEventListener('online', fetchMessages);
    };
  }, [fetchMessages]);

  // Kapanış saati (22:00 TR) geldiğinde sohbet sayfa yenilenmeden kapanır
  useEffect(() => {
    if (!closeAt || isClosed) return;
    const ms = new Date(closeAt).getTime() - Date.now();
    if (ms <= 0) { setIsClosed(true); return; }
    const t = setTimeout(() => setIsClosed(true), Math.min(ms, 2_147_000_000));
    return () => clearTimeout(t);
  }, [closeAt, isClosed]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || sending || isClosed || !isOpen) return;
    setSending(true);
    setSendError('');
    try {
      const res = await fetch(`${apiBase}/chat/${meetingId}/messages`, {
        method: 'POST', headers, credentials: 'include',
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.ok) {
        const msg = await res.json() as ChatMsg;
        setMessages(prev => [...prev, msg]);
        setInput('');
      } else {
        const err = await res.json().catch(() => null) as { message?: string } | null;
        setSendError(err?.message ?? 'Mesaj gönderilemedi');
      }
    } catch {
      setSendError('Mesaj gönderilemedi');
    } finally { setSending(false); }
  }

  async function reportMessage(messageId: string) {
    await fetch(`${apiBase}/chat/messages/${messageId}/report`, { method: 'POST', headers, credentials: 'include' });
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reportedByMe: true } : m));
  }

  const dividerStyle: React.CSSProperties = {
    height: 1, background: 'rgba(255,255,255,0.07)', margin: '20px 0',
  };

  return (
    <div>
      <div style={dividerStyle} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: isClosed ? '#555' : GREEN }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', color: isClosed ? '#555' : GREEN }}>
          {isClosed ? 'SOHBET KAPANDI' : 'GRUP SOHBETİ'}
        </span>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{ maxHeight: 260, overflowY: 'auto', padding: '12px 12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.length === 0 && (
            <p style={{ margin: 0, fontSize: 12, color: '#f5f5f5', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
              {!isOpen && openAt
                ? `Sohbet ${formatMeetingTime(openAt)} itibarıyla açılacak.`
                : isClosed ? 'Sohbet sona erdi.' : 'Henüz mesaj yok. İlk mesajı sen gönder.'}
            </p>
          )}
          {messages.map((msg, i) => {
            const prev = messages[i - 1];
            // Aynı kişinin art arda mesajlarında rozet yalnızca serinin ilk mesajında
            const firstOfSeries = !prev || prev.isOwn !== msg.isOwn || prev.seatNo !== msg.seatNo;
            return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'row', justifyContent: msg.isOwn ? 'flex-end' : 'flex-start', gap: 6, alignItems: 'flex-start' }}>
              {!msg.isOwn && (
                firstOfSeries
                  ? <ChatBadge initials={msg.senderInitials} gender={msg.senderGender} />
                  : <span style={{ width: 28, flexShrink: 0 }} aria-hidden />
              )}
              <div style={{ maxWidth: '72%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: msg.isOwn ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  padding: '8px 11px', borderRadius: msg.isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${gColor(msg.senderGender)}`,
                  fontSize: 13, color: '#f0f0f0', fontFamily: 'Inter, sans-serif', lineHeight: 1.45,
                  wordBreak: 'break-word', overflowWrap: 'anywhere',
                }}>
                  {msg.content}
                </div>
                <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter, sans-serif', marginTop: 2 }}>
                  {msgTime(msg.createdAt)}
                </span>
                {!msg.isOwn && !isClosed && (
                  <button
                    onClick={() => !msg.reportedByMe && reportMessage(msg.id)}
                    style={{
                      background: 'none', border: 'none', cursor: msg.reportedByMe ? 'default' : 'pointer',
                      fontSize: 10, color: msg.reportedByMe ? '#333' : '#444', fontFamily: 'Inter, sans-serif',
                      padding: '2px 0', marginTop: 2,
                    }}
                  >
                    {msg.reportedByMe ? '✓ Şikayet edildi' : 'Şikayet et'}
                  </button>
                )}
              </div>
            </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {isOpen && !isClosed && (
          <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', boxSizing: 'border-box', width: '100%' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value.slice(0, 1000))}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder=""
              className="ahenk-chat-input"
              style={{
                flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#f5f5f5',
                fontFamily: 'Inter, sans-serif', outline: 'none',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="btn-primary"
              style={{ fontSize: 10, paddingLeft: 10, paddingRight: 10, gap: 5, flexShrink: 0, minWidth: 0 }}
            >
              Gönder
            </button>
          </div>
        )}
        {sendError && isOpen && !isClosed && (
          <p style={{ margin: 0, padding: '0 10px 8px', fontSize: 12, color: '#ff6b6b', fontFamily: 'Inter, sans-serif' }}>
            {sendError}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Ana Bileşen ──────────────────────────────────────────────────────────────
// ── Masaya gelmeyen işaretleme (22:00 → ertesi gün 10:00; sonra değerlendirme formunda) ──
interface NoShowMarking {
  open: boolean;
  participants: { userId: string; initials: string; gender: string | null }[];
  markedIds: string[];
}

function NoShowSection({ meetingId, apiBase, token }: { meetingId: string; apiBase: string; token?: string }) {
  const [data, setData] = useState<NoShowMarking | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const headers = jsonHeaders(token);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/meetings/${meetingId}/no-show`, { headers, credentials: 'include' });
      if (res.ok) setData(await res.json() as NoShowMarking);
    } catch { /* sessiz */ }
  }, [apiBase, meetingId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', load);
    window.addEventListener('online', load);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', load);
      window.removeEventListener('online', load);
    };
  }, [load]);

  if (!data?.open || data.participants.length === 0) return null;
  const marked = new Set(data.markedIds);

  async function send() {
    if (selected.size === 0 || sending) return;
    setSending(true); setError('');
    try {
      const res = await fetch(`${apiBase}/meetings/${meetingId}/no-show`, {
        method: 'POST', headers, credentials: 'include', body: JSON.stringify({ userIds: [...selected] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null) as { message?: string | string[] } | null;
        setError((Array.isArray(err?.message) ? err?.message[0] : err?.message) ?? 'Gönderilemedi, tekrar dene.');
        return;
      }
      setSelected(new Set());
      await load();
    } catch { setError('Bağlantı hatası, tekrar dene.'); }
    finally { setSending(false); }
  }

  return (
    <div style={{ marginTop: 24, padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#f5f5f5', fontFamily: 'Inter, sans-serif' }}>
        Masana gelmeyen oldu mu?
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 11.5, color: '#888', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
        Gelmeyen kişileri işaretleyip gönder. Gönderilen bildirim geri alınamaz.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.participants.map(p => {
          const locked = marked.has(p.userId);
          const checked = locked || selected.has(p.userId);
          return (
            <label key={p.userId} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
              cursor: locked ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif',
              background: checked ? 'rgba(192,57,43,0.08)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${checked ? 'rgba(192,57,43,0.3)' : 'rgba(255,255,255,0.1)'}`,
            }}>
              <input
                type="checkbox"
                checked={checked}
                disabled={locked}
                onChange={() => setSelected(prev => {
                  const next = new Set(prev);
                  next.has(p.userId) ? next.delete(p.userId) : next.add(p.userId);
                  return next;
                })}
                style={{ accentColor: '#c0392b' }}
              />
              {/* Canlı Akış ile birebir aynı rozet: cinsiyet renkli border, sondaki nokta yazılmaz ("N.Y", "N.Y²") */}
              <span style={{ display: 'inline-block', padding: '0 5px', borderRadius: 99, border: `1px solid ${gColor(p.gender)}`, fontSize: 10.5, fontWeight: 600, lineHeight: 1.45, color: '#f4f1ec' }}>
                {p.initials.replace(/\.(?=[⁰¹²³⁴⁵⁶⁷⁸⁹]*$)/, '')}
              </span>
              {locked && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#c0392b' }}>Bildirildi</span>}
            </label>
          );
        })}
      </div>
      {error && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#ff6b6b', fontFamily: 'Inter, sans-serif' }}>{error}</p>}
      {selected.size > 0 && (
        <button onClick={send} disabled={sending} style={{
          marginTop: 12, width: '100%', padding: '11px 0', borderRadius: 10, cursor: sending ? 'not-allowed' : 'pointer',
          background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.5)', color: '#ff6b6b',
          fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif', opacity: sending ? 0.6 : 1,
        }}>
          {sending ? 'Gönderiliyor…' : 'Gelmedi olarak bildir'}
        </button>
      )}
    </div>
  );
}

export function MasaDetayKarti({ masa, apiBase, token, archive = false }: Props) {
  const [lightboxIdx,   setLightboxIdx]   = useState<number | null>(null);
  const [onMyWayDone,   setOnMyWayDone]   = useState(false);
  const [onMyWayLoading,setOnMyWayLoading]= useState(false);
  const [onMyWayWarn,   setOnMyWayWarn]   = useState('');
  // Yola Çıktım: buluşmadan 1 saat önce aktif olur; o ana gelince sayfa yenilenmeden açılsın
  const onMyWayOpensAt = new Date(masa.scheduledAt).getTime() - 60 * 60 * 1000;
  const [onMyWayOpen, setOnMyWayOpen] = useState(() => Date.now() >= onMyWayOpensAt);
  useEffect(() => {
    if (onMyWayOpen) return;
    const id = setInterval(() => { if (Date.now() >= onMyWayOpensAt) setOnMyWayOpen(true); }, 15000);
    return () => clearInterval(id);
  }, [onMyWayOpen, onMyWayOpensAt]);

  const isOneOnOne = masa.type === 'ONE_ON_ONE';
  const photos     = masa.venuePhotos ?? [];
  const meetTime   = formatMeetingTime(masa.scheduledAt);
  const mapLink    = mapsUrl(masa.venueMapsUrl, masa.venueAddress);
  const ordered    = buildOrdered(masa.participants);

  const authHeaders = apiBase ? jsonHeaders(token) : null;

  async function handleOnMyWay() {
    if (!authHeaders || onMyWayDone || onMyWayLoading) return;
    if (!onMyWayOpen) {
      setOnMyWayWarn('Yola çıkış bildirimi, buluşma saatinden 1 saat önce kullanıma açılır.');
      setTimeout(() => setOnMyWayWarn(''), 4000);
      return;
    }
    setOnMyWayLoading(true);
    try {
      const res = await fetch(`${apiBase}/meetings/${masa.id}/on-my-way`, { method: 'POST', headers: authHeaders, credentials: 'include' });
      if (res.ok) setOnMyWayDone(true);
      else {
        const err = await res.json().catch(() => null) as { message?: string | string[] } | null;
        const msg = Array.isArray(err?.message) ? err?.message[0] : err?.message;
        if (msg) { setOnMyWayWarn(msg); setTimeout(() => setOnMyWayWarn(''), 4000); }
      }
    } finally { setOnMyWayLoading(false); }
  }

  const hasChat = !!apiBase;

  // SOS görünürlük: masa saatinden backend'in verdiği bitiş anına kadar
  const now = new Date();
  const sosVisible = authHeaders && now >= new Date(masa.scheduledAt) && now < new Date(masa.sosEndsAt);

  // SOS state
  const [showSos,    setShowSos]    = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosDone,    setSosDone]    = useState(false);
  const [sosReportId, setSosReportId] = useState<string | null>(null);
  const [selectedThreats, setSelectedThreats] = useState<string[]>([]);
  const [locError, setLocError] = useState<'off' | 'denied' | null>(null);
  const [sosError, setSosError] = useState('');

  function toggleThreat(t: string) {
    setSelectedThreats(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  async function handleSos() {
    if (!authHeaders || selectedThreats.length === 0 || sosLoading) return;
    setSosLoading(true);
    setLocError(null);
    setSosError('');

    // Konumsuz talep oluşturulmaz: konum alınamazsa kullanıcıdan konumu açması istenir
    const doSubmit = async (lat: number, lng: number, accuracy: number) => {
      try {
        const res = await fetch(`${apiBase}/sos/${masa.id}/report`, {
          method: 'POST', headers: authHeaders, credentials: 'include',
          body: JSON.stringify({ threats: selectedThreats, lat, lng, accuracy }),
        });
        if (res.ok) {
          const data = await res.json() as { reportId: string };
          setSosReportId(data.reportId);
          setSosDone(true);
          setShowSos(false);
          window.dispatchEvent(new Event('ahenk-sos-opened'));
          return;
        }
        if (res.status === 429) { setSosError('Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar dene.'); return; }
        const err = await res.json().catch(() => null) as { message?: string | string[] } | null;
        const msg = Array.isArray(err?.message) ? err?.message[0] : err?.message;
        setSosError(msg ?? 'Sunucu hatası. Lütfen tekrar dene.');
      } catch {
        setSosError('Bağlantı hatası. İnternet bağlantını kontrol edip tekrar dene.');
      } finally { setSosLoading(false); }
    };

    if (!navigator.geolocation) {
      setLocError('off');
      setSosLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => doSubmit(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      (err) => {
        setSosLoading(false);
        if (err.code === 1) setLocError('denied');
        else setLocError('off');
      },
      { timeout: 8000, enableHighAccuracy: true },
    );
  }

  // Canlı konum ve kart dışı talep ekranı site genelindeki SosOpenReport'ta; talep kapanınca kart da normale döner
  useEffect(() => {
    const onClosed = () => { setSosDone(false); setSosReportId(null); };
    window.addEventListener('ahenk-sos-closed', onClosed);
    return () => window.removeEventListener('ahenk-sos-closed', onClosed);
  }, []);

  // Sayfa yenilenince açık talep kartta geri yüklenir
  useEffect(() => {
    if (!sosVisible || !authHeaders) return;
    fetch(`${apiBase}/sos/meetings/${masa.id}/my-report`, { headers: authHeaders, credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { reportId: string | null } | null) => {
        if (!d?.reportId) return;
        setSosReportId(d.reportId);
        setSosDone(true);
      })
      .catch(() => {});
  }, [sosVisible, apiBase, masa.id]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <>
      <AnimatePresence>
        {lightboxIdx !== null && (
          <Lightbox photos={photos} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />
        )}
        {showSos && (
          <SosModal
            selectedThreats={selectedThreats}
            onToggle={toggleThreat}
            onConfirm={handleSos}
            onClose={() => { setShowSos(false); setLocError(null); setSosError(''); setSelectedThreats([]); }}
            loading={sosLoading}
            locError={locError}
            error={sosError}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        <motion.div
          initial={{ opacity: 0.6, x: '-100%' }}
          animate={{ opacity: 0, x: '200%' }}
          transition={{ duration: 1.0, ease: 'easeOut', delay: 0.1 }}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
            background: 'linear-gradient(105deg, transparent 30%, rgba(39,174,96,0.15) 50%, transparent 70%)',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}
        >
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: GREEN, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
            MASA DETAYI
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={{ marginBottom: masa.venueAddress ? 4 : 16 }}
        >
          <h2 style={{
            margin: 0,
            fontFamily: 'var(--font-serif, "DM Serif Display", Georgia, serif)',
            fontSize: 26, fontWeight: 400, color: '#f5f5f5',
            letterSpacing: '0.01em', lineHeight: 1.2,
          }}>
            {masa.venueName}
          </h2>
        </motion.div>

        {masa.venueAddress && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(255,255,255,0.72)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}
          >
            {masa.venueAddress}
          </motion.p>
        )}

        {photos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.45 }}
            style={{ marginBottom: 18 }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: photos.length === 1 ? '1fr' : '1fr 1fr 1fr',
              gap: 6,
            }}>
              {photos.slice(0, 3).map((photo, i) => (
                <div
                  key={i}
                  onClick={() => setLightboxIdx(i)}
                  style={{
                    cursor: 'pointer', borderRadius: 8, overflow: 'hidden',
                    aspectRatio: '4/3', background: 'rgba(255,255,255,0.04)', position: 'relative',
                  }}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption ?? `Fotoğraf ${i + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s, filter 0.3s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'; }}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {mapLink && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            style={{ marginBottom: 18 }}
          >
            <a
              href={mapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              HARİTADA GÖR
            </a>
          </motion.div>
        )}

        <motion.div
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
          transition={{ delay: 0.35, duration: 0.45, ease: 'easeOut' }}
          style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 0 16px', transformOrigin: 'left' }}
        />

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', fontFamily: 'Inter, sans-serif' }}>Buluşma</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f5', fontFamily: 'Inter, sans-serif', letterSpacing: '0.01em' }}>
            {meetTime}
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48, duration: 0.4 }}
          style={{ marginBottom: 20 }}
        >
          <p style={{ margin: '0 0 12px', fontSize: 9, fontWeight: 700, color: '#f5f5f5', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
            {isOneOnOne ? 'BAŞ BAŞA' : 'KATILIMCILAR'}
          </p>
          {masa.type === 'KANKA' ? (
            <KankaPairs
              mine={(masa.participants as KankaParticipant[]).filter(p => p.pair === 'MINE')}
              other={(masa.participants as KankaParticipant[]).filter(p => p.pair === 'OTHER')}
            />
          ) : (
          <div style={isOneOnOne ? { display: 'flex', gap: 10, flexWrap: 'wrap' } : { display: 'grid', gridTemplateColumns: 'repeat(4, 48px)', gap: 10 }}>
            {ordered.map((p, i) => (
              <DetayAvatar key={`${p.initials}-${i}`} participant={p} delay={0.52 + i * 0.1} />
            ))}
          </div>
          )}
        </motion.div>

        {!masa.aiReport && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            style={{
              background: 'rgba(8,18,44,0.75)',
              border: '1px solid rgba(100,130,200,0.18)',
              borderRadius: 12, padding: '14px 16px', marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: 'rgba(100,130,200,0.14)', border: '1px solid rgba(100,130,200,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>✦</span>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif', color: 'rgba(180,200,255,0.75)',
              }}>
                YAPAY ZEKA MASA RAPORU
              </span>
            </div>
            <div style={{ height: 1, background: 'rgba(100,130,200,0.12)', marginBottom: 12 }} />
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.88)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>
                  UYUM SKORU
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', fontFamily: 'Inter, sans-serif' }}>
                  %—
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.12)' }} />
            </div>
          </motion.div>
        )}

        {masa.aiReport && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            style={{
              background: 'rgba(8, 18, 44, 0.75)',
              border: '1px solid rgba(100,130,200,0.18)',
              borderRadius: 12, padding: '14px 16px', marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: 'rgba(100,130,200,0.14)', border: '1px solid rgba(100,130,200,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>✦</span>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif', color: 'rgba(180,200,255,0.75)',
              }}>
                YAPAY ZEKA MASA RAPORU
              </span>
            </div>
            <div style={{ height: 1, background: 'rgba(100,130,200,0.12)', marginBottom: 12 }} />
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>
                  UYUM SKORU
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', fontFamily: 'Inter, sans-serif' }}>
                  %{masa.aiReport.uyumSkoru}
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                  transition={{ delay: 0.85, duration: 0.9, ease: 'easeOut' }}
                  style={{
                    height: '100%', width: `${masa.aiReport.uyumSkoru}%`,
                    background: 'linear-gradient(90deg, #4fc3f7 0%, #f48fb1 100%)',
                    borderRadius: 99, transformOrigin: 'left',
                  }}
                />
              </div>
            </div>
            <p style={{
              margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.65)',
              fontFamily: 'Inter, sans-serif', lineHeight: 1.65,
            }}>
              {masa.aiReport.content}
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: masa.aiReport ? 0.72 : 0.62, duration: 0.4 }}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '12px 14px',
            marginBottom: 16,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
            Rezervasyonunuz tamamlandı. Girişte görevliye isminizi söylediğinizde masanıza yönlendirileceksiniz. İyi eğlenceler.
          </p>
        </motion.div>

        {/* Yola Çıktım butonu */}
        {(authHeaders || archive) && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: masa.aiReport ? 0.78 : 0.68, duration: 0.4 }}
            style={{ marginBottom: 10 }}
          >
            <button
              onClick={handleOnMyWay}
              disabled={archive || onMyWayDone || onMyWayLoading}
              aria-disabled={!onMyWayOpen || undefined}
              className={onMyWayDone ? undefined : 'btn-primary'}
              style={onMyWayDone ? {
                width: '100%', padding: '13px 0',
                background: 'rgba(39,174,96,0.12)',
                border: '1px solid rgba(39,174,96,0.35)',
                borderRadius: 9999,
                color: '#27ae60', fontSize: 12, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif', cursor: 'default',
              } : { width: '100%', justifyContent: 'center' }}
            >
              {onMyWayDone ? '✓ Yola çıktığını bildirdin' : onMyWayLoading ? 'Bildiriliyor…' : 'Yola Çıktım'}
            </button>
            {onMyWayWarn && (
              <div role="alert" style={{
                marginTop: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, padding: '12px 14px',
              }}>
                <p style={{ margin: 0, fontSize: 12, color: '#ffb347', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
                  {onMyWayWarn}
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Sohbet bölümü */}
        {hasChat && (
          <ChatSection meetingId={masa.id} apiBase={apiBase!} token={token} />
        )}

        {/* Masaya gelmeyen işaretleme */}
        {hasChat && (
          <NoShowSection meetingId={masa.id} apiBase={apiBase!} token={token} />
        )}

        {/* SOS Acil Yardım */}
        {sosVisible && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            style={{ marginTop: 24 }}
          >
            {sosDone ? (
              <div style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'rgba(192,57,43,0.12)', border: '1.5px solid rgba(192,57,43,0.5)',
                textAlign: 'center',
              }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#ff6b6b', fontFamily: 'Inter, sans-serif' }}>
                  ACİL YARDIM TALEBİNİZ ALINDI
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,107,107,0.7)', fontFamily: 'Inter, sans-serif' }}>
                  Sakin olun ve güvende kalmaya çalışın.
                </p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowSos(true)}
                  style={{
                    width: '100%', padding: '15px 0', borderRadius: 12,
                    background: 'linear-gradient(135deg, #7b0000 0%, #c0392b 50%, #ff6b6b 100%)',
                    border: 'none', cursor: 'pointer',
                    color: '#fff', fontSize: 14, fontWeight: 800,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    fontFamily: 'Inter, sans-serif',
                    boxShadow: '0 0 20px rgba(192,57,43,0.45)',
                  }}
                >
                  Acil Yardım
                </button>
                <div style={{
                  marginTop: 10, padding: '10px 12px',
                  background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.22)',
                  borderRadius: 8,
                }}>
                  <p style={{
                    margin: 0, fontSize: 10.5, lineHeight: 1.55,
                    color: 'rgba(255,107,107,0.65)', fontFamily: 'Inter, sans-serif',
                  }}>
                    Masada veya masadan sonrasında, masadaki birisi tarafından fiziksel şiddet, alıkoyulma, taciz veya istismar eylemiyle karşı karşıya kalırsan ya da kalma ihtimali yaşarsan hemen butona bas ve eylemin türünü seçerek onayla. Konum bilgisi ve masadaki kişilerin kimlik bilgileri emniyet birimleriyle anında paylaşılır. <strong style={{ color: 'rgba(255,107,107,0.85)' }}>Güvenliğin bizim için çok önemli.</strong>
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </motion.div>
    </>
  );
}
