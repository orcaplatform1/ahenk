'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { KankaPairs, type KankaPerson } from './KankaPairs';
import { DetayAvatar } from './DetayAvatar';
import { PhotoViewer } from './PhotoViewer';
import { gColor } from './MasaRadar';
import { documentLang } from '../../lib/lang';

type KankaParticipant = KankaPerson & { pair?: 'MINE' | 'OTHER' };

// ── Tipler ──────────────────────────────────────────────────────────────────
export interface DetayParticipant {
  initials: string;
  gender: 'MALE' | 'FEMALE' | string | null;
  isSelf?: boolean;
  photoUrl?: string | null;
  cancelled?: boolean;
  displayName?: string | null; // Görünen ad ("Ahmet Y."), kart açıldıktan sonra sunucudan gelir
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
  venueDistrict?: string | null; // Kapakta yalnız ilçe adı
  venueMapsUrl?: string | null;
  venuePhotos?: VenuePhoto[];
  participants: DetayParticipant[];
  occupations?: string[]; // Her istekte karışık sıra; kime ait olduğu gösterilmez
  aiReport?: AiReport | null;
}

interface ChatMsg {
  id: string;
  content: string;
  createdAt: string;
  isOwn: boolean;
  senderName: string; // Görünen ad ("Ahmet Y.")
  senderGender?: string | null;
  seatNo?: number | null; // Masaya özel anonim sandalye no (art arda mesaj serisi)
  reportedByMe: boolean;
}

// Mesaj saati: SS:DD (Europe/Istanbul)
function msgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Istanbul' });
}

// Masa kartındaki baş harf rozetinin küçük hali

interface Props {
  masa: MasaDetayData;
  apiBase?: string;
  // Verilirse Bearer başlığı eklenir; web oturumu HttpOnly çerezle gider (credentials: 'include')
  token?: string;
  archive?: boolean; // Geçmiş masa: yalnızca Haritada Gör çalışır, sohbet ve acil yardım yok (apiBase verilmez)
  onEditOwnPhoto?: () => void; // Kendi fotoğrafının tam ekran görünümündeki kalem butonu
}

function jsonHeaders(token?: string): Record<string, string> {
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Accept-Language': documentLang() }
    : { 'Content-Type': 'application/json', 'Accept-Language': documentLang() };
}

// ── Renkler ─────────────────────────────────────────────────────────────────
const GREEN      = '#27ae60';

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

// Gün adı arayüz dilinde, saat 24 saat (bölge saat dilimi)
function formatMeetingTime(isoStr: string, locale = 'tr'): string {
  try {
    const d = new Date(isoStr);
    const tz = 'Europe/Istanbul';
    const day = d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'tr-TR', { weekday: 'long', timeZone: tz });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz });
    return `${day.charAt(0).toLocaleUpperCase(locale === 'en' ? 'en' : 'tr-TR')}${day.slice(1)} · ${time}`;
  } catch { return ''; }
}

// Bilgi şeridi: "Cuma, 20:00" (gün adı arayüz dilinde, 24 saat)
function formatStripTime(isoStr: string, locale = 'tr'): string {
  return formatMeetingTime(isoStr, locale).replace(' · ', ', ');
}

// Kapak üstü hap rozet
const pillStyle = (bg: string, color: string, border: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 9999,
  background: bg, border: `1px solid ${border}`, color, fontSize: 11, fontWeight: 700,
  letterSpacing: '0.04em', fontFamily: 'Inter, sans-serif', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
});

// Genel Uyum halkası (kayıtlı uyumSkoru, 0–100)
function ScoreRing({ score }: { score: number }) {
  const D = 64, SW = 6, R = (D - SW) / 2, C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div style={{ position: 'relative', width: D, height: D, flexShrink: 0 }}>
      <svg width={D} height={D} viewBox={`0 0 ${D} ${D}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={D / 2} cy={D / 2} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={SW} />
        <motion.circle
          cx={D / 2} cy={D / 2} r={R} fill="none" stroke={GREEN} strokeWidth={SW} strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - pct / 100) }}
          transition={{ delay: 0.85, duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#f5f5f5', fontFamily: 'Inter, sans-serif' }}>
        %{pct}
      </span>
    </div>
  );
}

function mapsUrl(url?: string | null, address?: string | null): string | null {
  if (url) return url;
  if (address) return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  return null;
}

// ── Lightbox ──────────────────────────────────────────────────────────────
function Lightbox({ photos, startIdx, onClose }: { photos: VenuePhoto[]; startIdx: number; onClose: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const [idx, setIdx] = useState(startIdx);
  // Telefon genişliğinde (responsive) alttaki noktalar gösterilmez; masaüstünde kalır
  const [narrow, setNarrow] = useState(false);
  const touchX = useRef<number | null>(null);
  const swiped = useRef(false);
  const next = () => setIdx(i => Math.min(i + 1, photos.length - 1));
  const prev = () => setIdx(i => Math.max(i - 1, 0));

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const u = () => setNarrow(mq.matches);
    u();
    mq.addEventListener('change', u);
    return () => mq.removeEventListener('change', u);
  }, []);

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
        onClick={e => {
          e.stopPropagation();
          if (swiped.current) { swiped.current = false; return; }
          // Fotoğrafın sağ yarısı → sonraki, sol yarısı → önceki
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX - r.left >= r.width / 2) next(); else prev();
        }}
        onTouchStart={e => { touchX.current = e.touches[0].clientX; swiped.current = false; }}
        onTouchEnd={e => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) < 40) return;
          swiped.current = true;
          if (dx < 0) next(); else prev();
        }}
        style={{ maxWidth: '90vw', maxHeight: '75vh', cursor: photos.length > 1 ? 'pointer' : undefined, objectFit: 'contain', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)' }}
      />
      {photos[idx].caption && (
        <p style={{ color: '#aaa', fontSize: 13, marginTop: 12, fontFamily: 'Inter, sans-serif' }}>{photos[idx].caption}</p>
      )}
      {photos.length > 1 && !narrow && (
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
  { value: 'LIFE_DANGER',       label: 'masa.threatLife' },
  { value: 'PHYSICAL_VIOLENCE', label: 'masa.threatViolence' },
  { value: 'ABDUCTION',         label: 'masa.threatAbduction' },
  { value: 'HARASSMENT',        label: 'masa.threatHarassment' },
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
  const t = useTranslations();
  const locale = useLocale();
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
            {t('masa.sosFormTitle')}
          </span>
        </div>
        <div style={{ height: 1, background: 'rgba(192,57,43,0.3)', margin: '10px 0 16px' }} />

        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(255,107,107,0.7)', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
          {t('masa.sosPick')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {SOS_THREATS.map(th => {
            const selected = selectedThreats.includes(th.value);
            return (
              <button
                key={th.value}
                onClick={() => onToggle(th.value)}
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
                {t(th.label)}
              </button>
            );
          })}
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif', fontStyle: 'italic', lineHeight: 1.5 }}>
          {t('masa.sosMaybe')}
        </p>
        <p style={{ margin: '0 0 16px', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif', fontStyle: 'italic', lineHeight: 1.5 }}>
          {t('masa.sosShared')}
        </p>

        {locError === 'denied' && (
          <div style={{ padding: '10px 12px', background: 'rgba(255,165,0,0.08)', border: '1px solid rgba(255,165,0,0.3)', borderRadius: 8, marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 11.5, color: '#ffb347', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
              {t('masa.sosDenied')}
            </p>
          </div>
        )}
        {locError === 'off' && (
          <div style={{ padding: '10px 12px', background: 'rgba(255,165,0,0.08)', border: '1px solid rgba(255,165,0,0.3)', borderRadius: 8, marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 11.5, color: '#ffb347', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
              {t('masa.sosOff')}
            </p>
          </div>
        )}
        {error && (
          <div style={{ padding: '10px 12px', background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.5)', borderRadius: 8, marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 11.5, color: '#ff6b6b', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
              {t('masa.sosFailed', { error })}
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
            {t('masa.sosConsent')}
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
          {loading ? t('masa.locating') : error ? t('masa.tryAgain') : t('masa.report')}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Sohbet Bölümü ─────────────────────────────────────────────────────────
function ChatSection({ meetingId, apiBase, token }: { meetingId: string; apiBase: string; token?: string }) {
  const t = useTranslations();
  const locale = useLocale();
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
        headers: token ? { Authorization: `Bearer ${token}`, 'Accept-Language': documentLang() } : { 'Accept-Language': documentLang() },
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
        setSendError(err?.message ?? t('masa.sendFailedMsg'));
      }
    } catch {
      setSendError(t('masa.sendFailedMsg'));
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
          {isClosed ? t('masa.chatClosed') : t('masa.groupChat')}
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
                ? t('masa.chatOpensAt', { time: formatMeetingTime(openAt, locale) })
                : isClosed ? t('masa.chatEnded') : t('masa.noMessages')}
            </p>
          )}
          {messages.map((msg, i) => {
            const prev = messages[i - 1];
            // Aynı kişinin art arda mesajlarında gönderen adı yalnızca serinin ilk mesajında
            const firstOfSeries = !prev || prev.isOwn !== msg.isOwn || prev.seatNo !== msg.seatNo;
            return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'row', justifyContent: msg.isOwn ? 'flex-end' : 'flex-start', gap: 6, alignItems: 'flex-start' }}>
              <div style={{ maxWidth: '72%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: msg.isOwn ? 'flex-end' : 'flex-start' }}>
                {!msg.isOwn && firstOfSeries && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: gColor(msg.senderGender), fontFamily: 'Inter, sans-serif', marginBottom: 3 }}>{msg.senderName}</span>
                )}
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
                    {msg.reportedByMe ? t('masa.reported') : t('masa.reportMsg')}
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
              {t('masa.send')}
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
  const t = useTranslations();
  const locale = useLocale();
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
        setError((Array.isArray(err?.message) ? err?.message[0] : err?.message) ?? t('masa.sendFailedRetry'));
        return;
      }
      setSelected(new Set());
      await load();
    } catch { setError(t('masa.connError')); }
    finally { setSending(false); }
  }

  return (
    <div style={{ marginTop: 24, padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#f5f5f5', fontFamily: 'Inter, sans-serif' }}>
        {t('masa.noShowQ')}
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 11.5, color: '#888', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
        {t('masa.noShowInfo')}
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
              {locked && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#c0392b' }}>{t('masa.notified')}</span>}
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
          {sending ? t('masa.sending') : t('masa.markNoShow')}
        </button>
      )}
    </div>
  );
}

export function MasaDetayKarti({ masa, apiBase, token, archive = false, onEditOwnPhoto }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const [lightboxIdx,   setLightboxIdx]   = useState<number | null>(null);
  // Katılımcı profil fotoğrafı tam ekran; kendi fotoğrafında düzenleme butonu
  const [viewer, setViewer] = useState<{ url: string; self: boolean } | null>(null);
  const openPhoto = (p: { photoUrl?: string | null; isSelf?: boolean }) => { if (p.photoUrl) setViewer({ url: p.photoUrl, self: !!p.isSelf }); };
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

  const photos     = masa.venuePhotos ?? [];
  const mapLink    = mapsUrl(masa.venueMapsUrl, masa.venueAddress);
  const ordered    = buildOrdered(masa.participants);

  const authHeaders = apiBase ? jsonHeaders(token) : null;

  async function handleOnMyWay() {
    if (!authHeaders || onMyWayDone || onMyWayLoading) return;
    if (!onMyWayOpen) {
      setOnMyWayWarn(t('masa.onMyWayLater'));
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
        if (res.status === 429) { setSosError(t('masa.tooMany')); return; }
        const err = await res.json().catch(() => null) as { message?: string | string[] } | null;
        const msg = Array.isArray(err?.message) ? err?.message[0] : err?.message;
        setSosError(msg ?? t('masa.serverError'));
      } catch {
        setSosError(t('masa.netError'));
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


  // Kapak, bilgi şeridi ve katılımcılar
  const chatRef = useRef<HTMLDivElement>(null);
  // Mekânın yalnız ilk fotoğrafı gösterilir (tek fotoğraf; eski kayıtlardaki diğerleri gösterilmez)
  const cover = photos[0] ?? null;
  const present = masa.participants.filter(p => !p.cancelled);
  const femaleCount = present.filter(p => p.gender === 'FEMALE').length;
  const maleCount = present.filter(p => p.gender === 'MALE').length;
  const typeLabel = masa.type === 'ONE_ON_ONE' ? t('masa.typeOne') : masa.type === 'KANKA' ? t('masa.typeKanka') : t('masa.typeGroup');
  const scrollToChat = () => chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <>
      <AnimatePresence>
        {lightboxIdx !== null && (
          <Lightbox photos={cover ? [cover] : []} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />
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
      <PhotoViewer url={viewer?.url ?? null} onClose={() => setViewer(null)}
        onEdit={viewer?.self && onEditOwnPhoto ? () => { setViewer(null); onEditOwnPhoto(); } : undefined} />

      {/* ── Ana kart ── */}
      <motion.div
        className="ll-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ position: 'relative', overflow: 'hidden', padding: 0, background: '#121212' }}
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

        {/* Kapak: mekânın tek fotoğrafı tam genişlikte 16:9 (object-fit: cover); fotoğraf yoksa fotoğraf alanı yok,
            masa türü ve mekân adı normal akışta */}
        <div style={cover ? { position: 'relative', aspectRatio: '16 / 9' } : { position: 'relative', display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 14px 0' }}>
          {cover && (
            <>
              <div onClick={() => setLightboxIdx(0)} style={{ position: 'absolute', inset: 0, cursor: 'pointer', overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
                <img
                  src={cover.url}
                  alt={cover.caption ?? t('masa.photoAlt', { n: 1 })}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.05)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)'; }}
                />
              </div>
              {/* Yazıların okunması için alt geçiş */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(18,18,18,0.35) 0%, rgba(18,18,18,0) 30%, rgba(18,18,18,0) 45%, rgba(18,18,18,0.92) 100%)' }} />
            </>
          )}

          {/* Sol üst masa türü */}
          <span style={{ ...(cover ? { position: 'absolute', top: 12, left: 12 } : { alignSelf: 'flex-start' }), ...pillStyle('rgba(192,57,43,0.85)', '#fff', 'rgba(255,107,107,0.5)') }}>
            {typeLabel}
          </span>

          {/* Alt: mekân adı + ilçe, sağda Haritada Gör */}
          <div style={{ ...(cover ? { position: 'absolute', left: 14, right: 14, bottom: 12 } : {}), display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, pointerEvents: 'none' }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{
                margin: 0,
                fontFamily: 'var(--font-serif, "DM Serif Display", Georgia, serif)',
                fontSize: 24, fontWeight: 400, color: '#f5f5f5',
                letterSpacing: '0.01em', lineHeight: 1.2,
                textShadow: '0 1px 8px rgba(0,0,0,0.6)',
              }}>
                {masa.venueName}
              </h2>
              {masa.venueDistrict && (
                <p style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter, sans-serif' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" />
                  </svg>
                  {masa.venueDistrict}
                </p>
              )}
            </div>
            {mapLink && (
              <a
                href={mapLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  pointerEvents: 'auto', flexShrink: 0, display: 'inline-flex', alignItems: 'center', minHeight: 36,
                  padding: '0 14px', borderRadius: 9999, background: '#c0392b', color: '#fff',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', fontFamily: 'Inter, sans-serif', textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(192,57,43,0.4)',
                }}
              >
                {t('masa.seeOnMap')}
              </a>
            )}
          </div>
        </div>

        <div style={{ padding: 18 }}>
          {/* Bilgi şeridi: gün/saat · kişi sayısı + kadın/erkek */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '12px 14px', borderRadius: 12, marginBottom: 20,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" />
              </svg>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f5', fontFamily: 'Inter, sans-serif' }}>{formatStripTime(masa.scheduledAt, locale)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2c2.1.7 3.5 2.8 3.5 5.8" />
              </svg>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f5', fontFamily: 'Inter, sans-serif', lineHeight: 1.2 }}>{t('masa.peopleCount', { n: present.length })}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif', lineHeight: 1.3 }}>{t('masa.genderCount', { f: femaleCount, m: maleCount })}</div>
              </div>
            </div>
          </div>

          {/* Masa Katılımcıları + Masa Sohbeti */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f5f5f5', fontFamily: 'Inter, sans-serif' }}>
              {t('masa.tableParticipants')}
            </p>
            {hasChat && (
              <button type="button" onClick={scrollToChat} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 12px', borderRadius: 9999, cursor: 'pointer',
                background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.5)', color: '#ff6b6b',
                fontSize: 12, fontWeight: 600, fontFamily: 'Inter, sans-serif',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
                </svg>
                {t('masa.chatJump')}
              </button>
            )}
          </div>
          <div style={{ marginBottom: 20 }}>
            {masa.type === 'KANKA' ? (
              <KankaPairs
                mine={(masa.participants as KankaParticipant[]).filter(p => p.pair === 'MINE')}
                other={(masa.participants as KankaParticipant[]).filter(p => p.pair === 'OTHER')}
                onPhoto={openPhoto}
              />
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 4, margin: -4 }}>
                {ordered.map((p, i) => {
                  const av = p.photoUrl ? (
                    <button type="button" onClick={() => openPhoto(p)} aria-label={t('masa.enlargePhoto')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
                      <DetayAvatar participant={p} delay={0.52 + i * 0.1} size={44} highlight={!!p.isSelf} />
                    </button>
                  ) : (
                    <DetayAvatar participant={p} delay={0.52 + i * 0.1} size={44} highlight={!!p.isSelf} />
                  );
                  // Görünen ad ("Ahmet Y.") avatarın yanında; fotoğrafsızda avatarın içindeki baş harf aynen kalır
                  return (
                    <div key={`${p.initials}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingRight: p.displayName ? 4 : 0 }}>
                      {av}
                      {p.displayName && <span style={{ fontSize: 12, fontWeight: 600, color: '#f4f1ec', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>{p.displayName}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Meslekler: her satırda bir meslek, yalnız yazı; sıra sunucuda her istekte karışık, kime ait olduğu gösterilmez */}
          {!!masa.occupations?.length && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#f5f5f5', fontFamily: 'Inter, sans-serif' }}>{t('masa.occupations')}</p>
              {masa.occupations.map((o, i) => (
                <p key={i} style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.72)', fontFamily: 'Inter, sans-serif' }}>{o}</p>
              ))}
            </div>
          )}

          {/* Yapay Zeka Masa Raporu: kayıtlı uyumSkoru yeşil halkada; rapor yoksa mevcut bilgi metni */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            style={{
              background: 'rgba(8,18,44,0.75)',
              border: '1px solid rgba(100,130,200,0.18)',
              borderRadius: 12, padding: '14px 16px',
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
                {t('masa.aiTitle')}
              </span>
            </div>
            <div style={{ height: 1, background: 'rgba(100,130,200,0.12)', marginBottom: 12 }} />
            {masa.aiReport ? (
              <>
                {typeof masa.aiReport.uyumSkoru === 'number' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                    <ScoreRing score={masa.aiReport.uyumSkoru} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#f5f5f5', fontFamily: 'Inter, sans-serif' }}>{t('masa.aiOverall')}</span>
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.65)', fontFamily: 'Inter, sans-serif', lineHeight: 1.65 }}>
                  {masa.aiReport.content}
                </p>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.62)', fontFamily: 'Inter, sans-serif', lineHeight: 1.65 }}>
                {t('tm.meetupNote')}
              </p>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* ── Alt kart: rezervasyon bilgisi, Yola Çıktım, sohbet (ardından gelmeyen işaretleme ve acil yardım) ── */}
      <motion.div
        className="ll-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: 'easeOut' }}
        style={{ marginTop: 12 }}
      >
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10, padding: '12px 14px',
          marginBottom: (authHeaders || archive) ? 16 : 0,
        }}>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
            {t('masa.reservationDone')}
          </p>
        </div>

        {/* Yola Çıktım butonu */}
        {(authHeaders || archive) && (
          <div style={{ marginBottom: 10 }}>
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
              {onMyWayDone ? t('masa.onMyWayDone') : onMyWayLoading ? t('masa.onMyWayLoading') : t('masa.onMyWay')}
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
          </div>
        )}

        {/* Sohbet bölümü ("Masa Sohbeti" butonu buraya kaydırır) */}
        {hasChat && (
          <div ref={chatRef} style={{ scrollMarginTop: 80 }}>
            <ChatSection meetingId={masa.id} apiBase={apiBase!} token={token} />
          </div>
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
                  {t('masa.sosReceived')}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,107,107,0.7)', fontFamily: 'Inter, sans-serif' }}>
                  {t('masa.stayCalm')}
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
                  {t('masa.sosButton')}
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
                    {t('masa.sosInfo')} <strong style={{ color: 'rgba(255,107,107,0.85)' }}>{t('masa.safetyImportant')}</strong>
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
