'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  type?: 'GROUP' | 'ONE_ON_ONE';
  maxParticipants?: number;
  scheduledAt: string;
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
  reportedByMe: boolean;
}

interface Props {
  masa: MasaDetayData;
  apiBase?: string;
  token?: string;
}

// ── Renkler ─────────────────────────────────────────────────────────────────
const MALE_CLR   = '#4fc3f7';
const FEMALE_CLR = '#f48fb1';
const GREEN      = '#27ae60';
const RED        = '#c0392b';

function gColor(g?: string | null) {
  if (g === 'FEMALE') return FEMALE_CLR;
  return MALE_CLR;
}
function gBg(g?: string | null) {
  if (g === 'FEMALE') return 'rgba(244,143,177,0.12)';
  return 'rgba(79,195,247,0.12)';
}

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

// ── Avatar ─────────────────────────────────────────────────────────────────
const AV_D = 48;
const AV_R = AV_D / 2;
const AV_BR = AV_R - 2.5;
const CIRCUMF = 2 * Math.PI * AV_BR;

function DetayAvatar({ participant, delay }: { participant: DetayParticipant; delay: number }) {
  const color = gColor(participant.gender);
  const bg    = gBg(participant.gender);

  const label = (() => {
    const raw = (participant.initials ?? '').trim();
    if (!raw) return '?.';
    if (/^[A-ZÇĞİÖŞÜa-zçğışöşü]\.[A-ZÇĞİÖŞÜa-zçğışöşü]\.?$/.test(raw)) return raw.toUpperCase();
    if (raw.length === 2 && !raw.includes('.')) return `${raw[0].toUpperCase()}.${raw[1].toUpperCase()}.`;
    return raw.toUpperCase();
  })();

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
      style={{ position: 'relative', width: AV_D, height: AV_D, flexShrink: 0 }}
    >
      <svg width={AV_D} height={AV_D} viewBox={`0 0 ${AV_D} ${AV_D}`} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={AV_R} cy={AV_R} r={AV_R - 1} fill={bg} />
        <motion.circle
          cx={AV_R} cy={AV_R} r={AV_BR}
          fill="none" stroke={color} strokeWidth={2.5}
          strokeLinecap="round" strokeDasharray={CIRCUMF}
          style={{ rotate: '-90deg', transformOrigin: `${AV_R}px ${AV_R}px` }}
          initial={{ strokeDashoffset: CIRCUMF }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ delay: delay + 0.5, duration: 0.8, ease: 'easeOut' }}
        />
        <motion.circle
          cx={AV_R} cy={AV_R} r={AV_BR}
          fill="none" stroke={color} strokeWidth={2.5}
          style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.35, 0.85, 0.35] }}
          transition={{ delay: delay + 1.35, duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#f0f0f0',
        letterSpacing: '0.02em', fontFamily: 'Inter, sans-serif',
        userSelect: 'none', pointerEvents: 'none',
      }}>
        {label}
      </div>
    </motion.div>
  );
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
}: {
  selectedThreats: string[];
  onToggle: (t: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  locError: 'off' | 'denied' | null;
}) {
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
          <span style={{ fontSize: 22 }}>🚨</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#ff6b6b', fontFamily: 'Inter, sans-serif', letterSpacing: '0.02em' }}>
            Acil Yardım
          </span>
        </div>
        <div style={{ height: 1, background: 'rgba(192,57,43,0.3)', margin: '10px 0 16px' }} />

        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(255,107,107,0.7)', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
          Yaşadığın durumu seç (birden fazla seçebilirsin):
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

        <button
          onClick={onConfirm}
          disabled={selectedThreats.length === 0 || loading}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 10, cursor: selectedThreats.length ? 'pointer' : 'not-allowed',
            background: 'linear-gradient(135deg, #7b0000 0%, #c0392b 60%, #ff6b6b 100%)',
            border: 'none',
            color: '#fff', fontSize: 14, fontWeight: 800,
            fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em',
            opacity: (selectedThreats.length === 0 || loading) ? 0.45 : 1,
            transition: 'opacity 0.2s',
            boxShadow: selectedThreats.length ? '0 0 16px rgba(192,57,43,0.5)' : 'none',
          }}
        >
          {loading ? 'Konum alınıyor…' : 'İhbarda Bulun'}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── İptal Modal ───────────────────────────────────────────────────────────
const LEAVE_REASONS = [
  { value: 'VENUE_NOT_SUITABLE', label: 'Mekan uygun değil' },
  { value: 'TIME_CHANGED',       label: 'Zaman değişti' },
  { value: 'PERSONAL',           label: 'Kişisel sebep' },
  { value: 'OTHER',              label: 'Diğer' },
] as const;

function CancelModal({
  onConfirm,
  onClose,
  loading,
}: {
  onConfirm: (reason: string, note: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState<string>('');
  const [note,   setNote]   = useState('');
  const canSubmit = reason !== '' && (reason !== 'OTHER' || note.trim().length > 0);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(20,4,4,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380,
          background: 'rgba(30,8,8,0.97)',
          border: '1px solid rgba(192,57,43,0.35)',
          borderRadius: 16, padding: '28px 22px 22px',
        }}
      >
        <p style={{
          margin: '0 0 18px',
          fontSize: 15, lineHeight: 1.6, fontWeight: 500,
          color: '#f5f5f5', fontFamily: 'Inter, sans-serif', textAlign: 'center',
        }}>
          Bu haftaki eşleşmeden ayrılırsanız önümüzdeki haftaya kadar tekrar eşleşemezsiniz.
        </p>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: 'rgba(245,245,245,0.6)', fontFamily: 'Inter, sans-serif' }}>
          Ayrılma sebebiniz:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {LEAVE_REASONS.map(r => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              style={{
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                background: reason === r.value ? 'rgba(192,57,43,0.25)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${reason === r.value ? 'rgba(192,57,43,0.6)' : 'rgba(255,255,255,0.1)'}`,
                color: reason === r.value ? '#ff6b6b' : '#c0c0c0',
                fontSize: 14, fontFamily: 'Inter, sans-serif', fontWeight: reason === r.value ? 600 : 400,
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        {reason === 'OTHER' && (
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Lütfen açıklayın…"
            maxLength={300}
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 12px', borderRadius: 10, marginBottom: 16,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#f5f5f5', fontSize: 13, fontFamily: 'Inter, sans-serif', resize: 'none',
              outline: 'none',
            }}
          />
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(39,174,96,0.18)', border: '1px solid rgba(39,174,96,0.45)',
              color: '#27ae60', fontSize: 14, fontWeight: 700, fontFamily: 'Inter, sans-serif',
            }}
          >
            Vazgeç
          </button>
          <button
            onClick={() => canSubmit && onConfirm(reason, note)}
            disabled={loading || !canSubmit}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 10,
              cursor: (loading || !canSubmit) ? 'not-allowed' : 'pointer',
              background: 'rgba(192,57,43,0.25)', border: '1px solid rgba(192,57,43,0.55)',
              color: '#ff6b6b', fontSize: 14, fontWeight: 700, fontFamily: 'Inter, sans-serif',
              opacity: (loading || !canSubmit) ? 0.45 : 1,
            }}
          >
            {loading ? '…' : 'İptal Et'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Sohbet Bölümü ─────────────────────────────────────────────────────────
function ChatSection({ meetingId, apiBase, token }: { meetingId: string; apiBase: string; token: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/chat/${meetingId}/messages`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setLoadError(true); return; }
      const data = await res.json() as { isClosed: boolean; messages: ChatMsg[] };
      setIsClosed(data.isClosed);
      setMessages(data.messages);
    } catch { setLoadError(true); }
  }, [meetingId, apiBase, token]);

  useEffect(() => {
    fetchMessages();
    const id = setInterval(fetchMessages, 8000);
    return () => clearInterval(id);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || sending || isClosed) return;
    setSending(true);
    try {
      const res = await fetch(`${apiBase}/chat/${meetingId}/messages`, {
        method: 'POST', headers,
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.ok) {
        const msg = await res.json() as ChatMsg;
        setMessages(prev => [...prev, msg]);
        setInput('');
      }
    } finally { setSending(false); }
  }

  async function reportMessage(messageId: string) {
    await fetch(`${apiBase}/chat/messages/${messageId}/report`, { method: 'POST', headers });
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reportedByMe: true } : m));
  }

  const dividerStyle: React.CSSProperties = {
    height: 1, background: 'rgba(255,255,255,0.07)', margin: '20px 0',
  };

  if (loadError) return null;

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
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.55)', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
              {isClosed ? 'Sohbet sona erdi.' : 'Henüz mesaj yok. İlk mesajı sen gönder.'}
            </p>
          )}
          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: msg.isOwn ? 'row-reverse' : 'row', gap: 6, alignItems: 'flex-end' }}>
              {!msg.isOwn && (
                <span style={{ fontSize: 9, color: '#555', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', marginBottom: 2 }}>
                  {msg.senderInitials}
                </span>
              )}
              <div style={{ maxWidth: '72%' }}>
                <div style={{
                  padding: '8px 11px', borderRadius: msg.isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: msg.isOwn ? 'rgba(192,57,43,0.2)' : 'rgba(255,255,255,0.06)',
                  border: msg.isOwn ? '1px solid rgba(192,57,43,0.3)' : '1px solid rgba(255,255,255,0.07)',
                  fontSize: 13, color: '#f0f0f0', fontFamily: 'Inter, sans-serif', lineHeight: 1.45,
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
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
          ))}
          <div ref={bottomRef} />
        </div>

        {!isClosed && (
          <div style={{ display: 'flex', gap: 8, padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value.slice(0, 1000))}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Mesaj yaz…"
              className="ahenk-chat-input"
              style={{
                flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#f5f5f5',
                fontFamily: 'Inter, sans-serif', outline: 'none',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="btn-primary"
            >
              Gönder
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ana Bileşen ──────────────────────────────────────────────────────────────
export function MasaDetayKarti({ masa, apiBase, token }: Props) {
  const [lightboxIdx,   setLightboxIdx]   = useState<number | null>(null);
  const [onMyWayDone,   setOnMyWayDone]   = useState(false);
  const [onMyWayLoading,setOnMyWayLoading]= useState(false);
  const [showCancel,    setShowCancel]    = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelled,     setCancelled]     = useState(false);

  const isOneOnOne = masa.type === 'ONE_ON_ONE';
  const photos     = masa.venuePhotos ?? [];
  const meetTime   = formatMeetingTime(masa.scheduledAt);
  const mapLink    = mapsUrl(masa.venueMapsUrl, masa.venueAddress);
  const ordered    = buildOrdered(masa.participants);

  const authHeaders = apiBase && token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : null;

  async function handleOnMyWay() {
    if (!authHeaders || onMyWayDone || onMyWayLoading) return;
    setOnMyWayLoading(true);
    try {
      await fetch(`${apiBase}/meetings/${masa.id}/on-my-way`, { method: 'POST', headers: authHeaders });
      setOnMyWayDone(true);
    } finally { setOnMyWayLoading(false); }
  }

  async function handleCancel(reason: string, note: string) {
    if (!authHeaders) return;
    setCancelLoading(true);
    try {
      const res = await fetch(`${apiBase}/meetings/${masa.id}/cancel-registration`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ reason, note: note || undefined }),
      });
      if (res.ok) { setCancelled(true); setShowCancel(false); }
    } finally { setCancelLoading(false); }
  }

  const hasChat = !!(apiBase && token);

  // İptal deadline kontrolü (tarayıcı tarafı - yalnızca buton görünümü için)
  const now = new Date();
  const nowTR = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const dayTRRaw = nowTR.getUTCDay();
  const dayTR  = dayTRRaw === 0 ? 7 : dayTRRaw; // Pazar(0) → 7
  const hourTR = nowTR.getUTCHours();
  const cancelDeadlinePassed = isOneOnOne
    ? (dayTR > 5 || (dayTR === 5 && hourTR >= 20))
    : (dayTR > 4 || (dayTR === 4 && hourTR >= 20));

  // SOS görünürlük: masa saatinden (scheduledAt) sonraki gün 10:00 TR'ye kadar
  const scheduledTR = new Date(new Date(masa.scheduledAt).getTime() + 3 * 60 * 60 * 1000);
  const nextDay10 = new Date(scheduledTR);
  nextDay10.setUTCDate(nextDay10.getUTCDate() + 1);
  nextDay10.setUTCHours(7, 0, 0, 0); // 07:00 UTC = 10:00 TR
  const sosVisible = authHeaders && now >= new Date(masa.scheduledAt) && now < nextDay10;

  // SOS state
  const [showSos,    setShowSos]    = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosDone,    setSosDone]    = useState(false);
  const [sosReportId, setSosReportId] = useState<string | null>(null);
  const [selectedThreats, setSelectedThreats] = useState<string[]>([]);
  const [locError, setLocError] = useState<'off' | 'denied' | null>(null);

  function toggleThreat(t: string) {
    setSelectedThreats(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  async function handleSos() {
    if (!authHeaders || selectedThreats.length === 0 || sosLoading) return;
    setSosLoading(true);
    setLocError(null);

    const doSubmit = async (lat?: number, lng?: number, accuracy?: number) => {
      try {
        const res = await fetch(`${apiBase}/sos/${masa.id}/report`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ threats: selectedThreats, lat, lng, accuracy }),
        });
        if (res.ok) {
          const data = await res.json() as { reportId: string };
          setSosReportId(data.reportId);
          setSosDone(true);
          setShowSos(false);
          if (lat && lng) startLiveLocation(data.reportId);
        }
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

  function startLiveLocation(reportId: string) {
    if (!navigator.geolocation || !authHeaders) return;
    navigator.geolocation.watchPosition(
      async (pos) => {
        await fetch(`${apiBase}/sos/reports/${reportId}/location`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
  }

  // Masa aktifken tüm üyeler için 30s konum takibi (izin varsa)
  useEffect(() => {
    if (!sosVisible || !authHeaders || !navigator.geolocation) return;
    let watchId: number | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let lastPos: GeolocationPosition | null = null;

    watchId = navigator.geolocation.watchPosition(
      (pos) => { lastPos = pos; },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000 },
    );

    intervalId = setInterval(async () => {
      if (!lastPos) return;
      try {
        await fetch(`${apiBase}/sos/${masa.id}/participant-location`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({
            lat: lastPos.coords.latitude,
            lng: lastPos.coords.longitude,
            accuracy: lastPos.coords.accuracy,
          }),
        });
      } catch { /* sessiz */ }
    }, 30000);

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [sosVisible, apiBase, masa.id]); // authHeaders dependency'den çıkarıldı — string ref stabil değil

  return (
    <>
      <AnimatePresence>
        {lightboxIdx !== null && (
          <Lightbox photos={photos} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />
        )}
        {showCancel && (
          <CancelModal
            onConfirm={(reason, note) => handleCancel(reason, note)}
            onClose={() => setShowCancel(false)}
            loading={cancelLoading}
          />
        )}
        {showSos && (
          <SosModal
            selectedThreats={selectedThreats}
            onToggle={toggleThreat}
            onConfirm={handleSos}
            onClose={() => { setShowSos(false); setLocError(null); setSelectedThreats([]); }}
            loading={sosLoading}
            locError={locError}
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
          <div style={isOneOnOne ? { display: 'flex', gap: 10, flexWrap: 'wrap' } : { display: 'grid', gridTemplateColumns: 'repeat(4, 48px)', gap: 10 }}>
            {ordered.map((p, i) => (
              <DetayAvatar key={`${p.initials}-${i}`} participant={p} delay={0.52 + i * 0.1} />
            ))}
          </div>
        </motion.div>

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
        {authHeaders && !cancelled && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: masa.aiReport ? 0.78 : 0.68, duration: 0.4 }}
            style={{ marginBottom: 10 }}
          >
            <button
              onClick={handleOnMyWay}
              disabled={onMyWayDone || onMyWayLoading}
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
          </motion.div>
        )}

        {/* Rezervasyon iptal butonu */}
        {authHeaders && !cancelled && !cancelDeadlinePassed && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: masa.aiReport ? 0.84 : 0.74, duration: 0.4 }}
            style={{ marginBottom: mapLink ? 16 : 10 }}
          >
            <button
              onClick={() => setShowCancel(true)}
              style={{
                width: '100%', padding: '13px 0',
                background: 'rgba(192,57,43,0.2)', border: '1px solid rgba(192,57,43,0.5)',
                borderRadius: 9999, cursor: 'pointer',
                color: '#ff6b6b', fontSize: 12, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif', transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(192,57,43,0.3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(192,57,43,0.2)')}
            >
              Rezervasyon İptal
            </button>
          </motion.div>
        )}

        {cancelled && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)',
              marginBottom: 16, textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: '#c0392b', fontFamily: 'Inter, sans-serif' }}>
              Rezervasyonunuz iptal edildi.
            </p>
          </motion.div>
        )}

        {/* Sohbet bölümü */}
        {hasChat && !cancelled && (
          <ChatSection meetingId={masa.id} apiBase={apiBase!} token={token!} />
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
                  🚨 Acil yardım talebiniz alındı.
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,107,107,0.7)', fontFamily: 'Inter, sans-serif' }}>
                  Konumunuz anlık olarak güncelleniyor. Güvende kalın.
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
