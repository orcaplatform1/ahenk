'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { DetayAvatar } from './DetayAvatar';
import { PhotoViewer } from './PhotoViewer';
import { gColor } from './MasaRadar';
import { documentLang } from '../../lib/lang';
import { ShareCardModal } from './ShareCard';
import { StdButton } from '../StdButton';

// ── Tipler ──────────────────────────────────────────────────────────────────
export interface DetayParticipant {
  initials: string;
  gender: 'MALE' | 'FEMALE' | string | null;
  isSelf?: boolean;
  photoUrl?: string | null;
  cancelled?: boolean;
  displayName?: string | null; // Görünen ad ("Ahmet Y."), kart açıldıktan sonra sunucudan gelir
  occupation?: string | null; // Kişinin kendi mesleği (adının altında); mesleği olmayan botta boş
  pair?: 'MINE' | 'OTHER'; // Kankamla: kullanıcının kendi çifti / karşı çift
}

export interface VenuePhoto {
  url: string;
  caption?: string;
}

export interface AiReport {
  content: string; // AI yorumu (kullanıcının dilinde)
  uyumSkoru: number; // Masanın genel skoru
  generatedAt: string;
  questions?: string[] | null; // Sohbeti başlatacak 3 soru
  dna?: string | null; // Masa DNA'sı / masa dinamiği
  dnaShort?: string | null; // Paylaşım kartındaki kısa özet
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
  senderPhotoUrl?: string | null; // Onaylı profil fotoğrafı; yoksa cinsiyet renkli baş harf
  reportedByMe: boolean;
  pending?: boolean; // Gönderiliyor (sunucu yanıtı bekleniyor; denetimde bekletilen mesaj)
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
  reviewHref?: string; // Aktif kartta "Değerlendir": değerlendirme açılınca (ertesi gün 08:00) gidilen adres
  // Önizleme (masa kurulmadan): aynı kart, gerçek veri yok. dateLabel tarih satırında (gün adı + saat); sohbet pasif
  // (mesaj çekilmez, giriş alanı, emoji ve gönder ikonu kapalı); acil yardım ve gelmeyen işaretleme yok; Değerlendir pasif
  preview?: { dateLabel: string };
}

function jsonHeaders(token?: string): Record<string, string> {
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Accept-Language': documentLang() }
    : { 'Content-Type': 'application/json', 'Accept-Language': documentLang() };
}

// Yapay Zekâ Masa Raporu alt başlıkları
const AI_SUB: React.CSSProperties = {
  margin: '0 0 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
  fontFamily: 'Inter, sans-serif', color: 'rgba(180,200,255,0.75)',
};

// ── Renkler ─────────────────────────────────────────────────────────────────
const GREEN      = '#27ae60';

// Katılımcı satırları (satırda en fazla 2 kişi): Grup ve Baş Başa'da her satır 1 erkek + 1 kadın; Kankamla'da üst satır
// kullanıcının kanka çifti, alt satır karşı çift
function participantRows(participants: DetayParticipant[], type?: MasaDetayData['type']): DetayParticipant[][] {
  const chunk = (list: DetayParticipant[]) => {
    const rows: DetayParticipant[][] = [];
    for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2));
    return rows;
  };
  if (type === 'KANKA') {
    const mine = participants.filter(p => p.pair === 'MINE').sort((a, b) => Number(!!b.isSelf) - Number(!!a.isSelf));
    const other = participants.filter(p => p.pair !== 'MINE');
    return [...chunk(mine), ...chunk(other)];
  }
  const males   = participants.filter(p => p.gender === 'MALE');
  const females = participants.filter(p => p.gender === 'FEMALE');
  const others  = participants.filter(p => p.gender !== 'MALE' && p.gender !== 'FEMALE');
  const rows: DetayParticipant[][] = [];
  for (let i = 0; i < Math.max(males.length, females.length); i++) {
    rows.push([males[i], females[i]].filter((p): p is DetayParticipant => !!p));
  }
  return [...rows, ...chunk(others)];
}

// Tarih satırı (gg.aa.yyyy kuralının istisnası; @ahenk/shared formatCardDate ile aynı): TR "18 Kasım, Çarşamba 20:00",
// EN "Wednesday, 18 November 20:00"
// weekdayOnly (Geçmiş Masalarım, archive): tarih kartın başlığında olduğu için yalnız gün adı ve saat, TR "Çarşamba 20:00",
// EN "Wednesday 20:00" (@ahenk/shared formatWeekdayTime ile aynı)
function formatCardDate(isoStr: string, locale = 'tr', weekdayOnly = false): string {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '';
  const loc = locale === 'en' ? 'en-GB' : 'tr-TR';
  const tz = 'Europe/Istanbul';
  const dm = d.toLocaleDateString(loc, { day: 'numeric', month: 'long', timeZone: tz });
  const wd = d.toLocaleDateString(loc, { weekday: 'long', timeZone: tz });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz });
  if (weekdayOnly) return `${wd} ${time}`;
  return locale === 'en' ? `${wd}, ${dm} ${time}` : `${dm}, ${wd} ${time}`;
}

// Değerlendirmenin açıldığı an: buluşma günü 23:59'dan sonra, ertesi gün 00:00 TR (backend meeting-windows reviewWindow ile aynı)
function reviewOpensAt(isoStr: string): Date {
  const tr = new Date(new Date(isoStr).getTime() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() + 1, 0 - 3, 0, 0, 0));
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

// "Değerlendir": İçerde paket kartı rozetindeki altın geçişli hap (premium)
export const GOLD_PILL: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 36, padding: '0 18px', borderRadius: 9999,
  background: 'linear-gradient(135deg, #f5d76e, #c9a227 55%, #a8861a)', color: '#1a1406', border: 'none', cursor: 'pointer',
  fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
  textDecoration: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
};

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
        {/* Tek dokunuşla 112 */}
        <a href="tel:112" style={{ display: 'block', marginTop: 12, textAlign: 'center', fontSize: 11.5, color: 'rgba(255,107,107,0.8)', fontFamily: 'Inter, sans-serif', textDecoration: 'underline' }}>
          {t('masa.sosCall112')}
        </a>
      </motion.div>
    </motion.div>
  );
}

// ── Sohbet Bölümü ─────────────────────────────────────────────────────────
// Başlık "Masa Sohbeti" + katılımcı sayısı; her mesajda gönderenin fotoğrafı (yoksa cinsiyet renkli baş harf) ve adı; saat
// baloncuğun içinde sağ altta; emoji seçici + gönder ikonu; başkasının mesajında sağ tık / ⋯ menüsü → "Şikâyet Et"; altta Masa Kuralları
const EMOJIS = ['😀', '😂', '😊', '😍', '🥰', '😎', '🤔', '😅', '😉', '🙏', '👍', '👏', '🙌', '💪', '🎉', '❤️', '🔥', '✨', '🍷', '🍻', '☕', '🍕', '🌙', '😮', '😢', '👋', '🤝', '😇', '🤗', '😋'];
const REPORT_REASONS = ['INSULT_THREAT', 'HARASSMENT_SEXUAL', 'VENUE_CHANGE', 'CONTACT_SHARE', 'DRUGS', 'FRAUD_MONEY', 'ADVERTISING', 'DISCRIMINATION', 'FAKE_PROFILE', 'OTHER'] as const;

function nameInitials(name: string): string {
  const parts = name.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, '').trim().split(/\s+/);
  const f = parts[0]?.[0] ?? '?';
  const l = (parts[1] ?? '').replace('.', '')[0] ?? '';
  return `${f}.${l ? `${l}.` : ''}`.toLocaleUpperCase('tr-TR');
}

function ChatAvatar({ msg }: { msg: ChatMsg }) {
  const color = gColor(msg.senderGender);
  return msg.senderPhotoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={msg.senderPhotoUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${color}`, flexShrink: 0 }} />
  ) : (
    <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', border: `1.5px solid ${color}`, background: 'rgba(255,255,255,0.04)', color: '#f4f1ec', fontSize: 9.5, fontWeight: 700, fontFamily: 'Inter, sans-serif', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {nameInitials(msg.senderName)}
    </span>
  );
}

function ReportModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reason: string, note: string) => Promise<string | null> }) {
  const t = useTranslations();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const can = !!reason && (reason !== 'OTHER' || note.trim().length > 0) && !busy;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="report-title" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 20 }}>
        <p id="report-title" style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#f4f1ec', fontFamily: 'Inter, sans-serif' }}>{t('masa.reportTitle')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {REPORT_REASONS.map(r => (
            <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, padding: '6px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, color: '#f4f1ec', fontFamily: 'Inter, sans-serif',
              background: reason === r ? 'rgba(192,57,43,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${reason === r ? 'rgba(192,57,43,0.5)' : 'rgba(255,255,255,0.08)'}` }}>
              <input type="radio" name="report-reason" checked={reason === r} onChange={() => setReason(r)} style={{ accentColor: '#c0392b' }} />
              {t(`masa.reason_${r}`)}
            </label>
          ))}
        </div>
        {reason === 'OTHER' && (
          <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 1000))} placeholder={t('masa.reportNote')} rows={3} required
            style={{ marginTop: 10, width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 10, color: '#f5f5f5', fontSize: 13, fontFamily: 'Inter, sans-serif', resize: 'vertical' }} />
        )}
        {err && <p role="alert" style={{ margin: '10px 0 0', fontSize: 12, color: '#ff6b6b', fontFamily: 'Inter, sans-serif' }}>{err}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <StdButton variant="primary" type="button" className="justify-center" disabled={!can} style={{ width: '100%', maxWidth: 280, opacity: can ? 1 : 0.5 }}
            onClick={async () => { if (!reason) return; setBusy(true); setErr(''); const e = await onSubmit(reason, note); setBusy(false); if (e) setErr(e); }}>
            {t('masa.reportAction')}
          </StdButton>
          <StdButton variant="ghost" type="button" className="justify-center" onClick={onClose} style={{ width: '100%', maxWidth: 280 }}>{t('masa.reportCancel')}</StdButton>
        </div>
      </div>
    </div>
  );
}

function ChatSection({ meetingId, apiBase, token, count, preview = false }: { meetingId: string; apiBase: string; token?: string; count?: string; preview?: boolean }) {
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null); // Mesaj menüsü açık olan mesaj
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

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
      // Sunucudan gelenler mevcut listeyle birleştirilir; aynı mesaj iki kez gösterilmez (gönderiliyor durumundakiler korunur)
      setMessages(prev => {
        const byId = new Map(prev.map(m => [m.id, m]));
        for (const m of data.messages ?? []) byId.set(m.id, m);
        return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      });
    } catch { /* ekrandaki veri korunur */ }
  }, [meetingId, apiBase, token]);

  useEffect(() => {
    if (preview) return; // Önizlemede mesaj çekilmez
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
  }, [fetchMessages, preview]);

  // Kapanış saati (22:00 TR) geldiğinde sohbet sayfa yenilenmeden kapanır
  useEffect(() => {
    if (!closeAt || isClosed) return;
    const ms = new Date(closeAt).getTime() - Date.now();
    if (ms <= 0) { setIsClosed(true); return; }
    const t = setTimeout(() => setIsClosed(true), Math.min(ms, 2_147_000_000));
    return () => clearTimeout(t);
  }, [closeAt, isClosed]);

  // Son mesaj görünür: liste kendi içinde en alta kayar (sayfa kaymaz)
  const scrollToEnd = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  useEffect(() => { scrollToEnd(); }, [messages.length, scrollToEnd]);

  // Klavye açılınca (mobil tarayıcı, visualViewport küçülür) son mesajlar ve yazı alanı görünür kalır
  const keepComposerVisible = useCallback(() => {
    scrollToEnd();
    composerRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [scrollToEnd]);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const onResize = () => { if (document.activeElement?.classList.contains('ahenk-chat-input')) keepComposerVisible(); };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [keepComposerVisible]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || sending || isClosed || !isOpen) return;
    setSending(true);
    setSendError('');
    setEmojiOpen(false);
    // Gönderiliyor: sunucu yanıtına (denetimde bekletme dahil) kadar baloncuk "gönderiliyor" durumunda
    const tempId = `pending-${Date.now()}`;
    const mine = [...messages].reverse().find(m => m.isOwn);
    setMessages(prev => [...prev, { id: tempId, content: trimmed, createdAt: new Date().toISOString(), isOwn: true, senderName: mine?.senderName ?? '', senderGender: mine?.senderGender, senderPhotoUrl: mine?.senderPhotoUrl, seatNo: mine?.seatNo ?? null, reportedByMe: false, pending: true }]);
    setInput('');
    try {
      const res = await fetch(`${apiBase}/chat/${meetingId}/messages`, {
        method: 'POST', headers, credentials: 'include',
        body: JSON.stringify({ content: trimmed }),
      });
      if (res.ok) {
        const msg = await res.json() as ChatMsg;
        setMessages(prev => prev.map(m => (m.id === tempId ? msg : m)));
      } else {
        const err = await res.json().catch(() => null) as { message?: string | string[] } | null;
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setSendError((Array.isArray(err?.message) ? err?.message[0] : err?.message) ?? t('masa.sendFailedMsg'));
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setSendError(t('masa.sendFailedMsg'));
    } finally { setSending(false); }
  }

  // Şikâyet: neden + ("Diğer"de zorunlu) açıklama; hata metni döner (başarılıysa null)
  async function submitReport(messageId: string, reason: string, note: string): Promise<string | null> {
    try {
      const res = await fetch(`${apiBase}/chat/messages/${messageId}/report`, {
        method: 'POST', headers, credentials: 'include', body: JSON.stringify({ reason, ...(reason === 'OTHER' ? { note } : {}) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null) as { message?: string | string[] } | null;
        return (Array.isArray(err?.message) ? err?.message[0] : err?.message) ?? t('masa.sendFailedMsg');
      }
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reportedByMe: true } : m));
      setReportFor(null);
      setNotice(t('masa.reportDone'));
      setTimeout(() => setNotice(''), 3000);
      return null;
    } catch { return t('masa.sendFailedMsg'); }
  }

  const dividerStyle: React.CSSProperties = {
    height: 1, background: 'rgba(255,255,255,0.07)', margin: '20px 0',
  };

  return (
    <div>
      <div style={dividerStyle} />
      {reportFor && <ReportModal onClose={() => setReportFor(null)} onSubmit={(r, n) => submitReport(reportFor, r, n)} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: isClosed ? '#555' : GREEN }} />
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Inter, sans-serif', color: isClosed ? '#777' : '#f4f1ec' }}>
            {t('masa.chatTitle')}
          </span>
        </span>
        {count && <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif' }}>{count}</span>}
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10, overflow: 'hidden', position: 'relative',
      }}>
        <div ref={listRef} onClick={() => setMenuFor(null)} style={{ maxHeight: 320, overflowY: 'auto', padding: '12px 12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.length === 0 && (
            <p style={{ margin: 0, fontSize: 12, color: '#f5f5f5', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
              {!isOpen && openAt
                ? t('masa.chatOpensAt', { time: formatMeetingTime(openAt, locale) })
                : isClosed ? t('masa.chatEnded') : t('masa.noMessages')}
            </p>
          )}
          {messages.map((msg, i) => {
            const prev = messages[i - 1];
            // Aynı kişinin art arda mesajlarında fotoğraf ve ad yalnızca serinin ilk mesajında
            const firstOfSeries = !prev || prev.isOwn !== msg.isOwn || prev.seatNo !== msg.seatNo;
            const canReport = !msg.isOwn && !isClosed && !msg.pending;
            return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: msg.isOwn ? 'row-reverse' : 'row', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ width: 28, flexShrink: 0 }}>{firstOfSeries && <ChatAvatar msg={msg} />}</span>
              <div style={{ maxWidth: '72%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: msg.isOwn ? 'flex-end' : 'flex-start', position: 'relative' }}>
                {firstOfSeries && msg.senderName && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: gColor(msg.senderGender), fontFamily: 'Inter, sans-serif', marginBottom: 3 }}>{msg.senderName}</span>
                )}
                <div
                  onContextMenu={canReport ? e => { e.preventDefault(); setMenuFor(msg.id); } : undefined}
                  style={{
                    padding: '7px 10px 5px', borderRadius: msg.isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${gColor(msg.senderGender)}`,
                    fontSize: 13, color: '#f0f0f0', fontFamily: 'Inter, sans-serif', lineHeight: 1.45,
                    wordBreak: 'break-word', overflowWrap: 'anywhere', opacity: msg.pending ? 0.7 : 1,
                  }}
                >
                  {msg.content}
                  {/* Saat baloncuğun içinde sağ altta (WhatsApp gibi), metinden farklı renkte */}
                  <span style={{ float: 'right', margin: '6px 0 0 10px', fontSize: 10, lineHeight: 1, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
                    {msg.pending ? t('masa.msgSending') : msgTime(msg.createdAt)}
                  </span>
                </div>
                {canReport && (
                  <button type="button" aria-label={t('masa.msgMenu')} onClick={e => { e.stopPropagation(); setMenuFor(menuFor === msg.id ? null : msg.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: 14, padding: '0 4px', lineHeight: 1.2 }}>
                    ⋯
                  </button>
                )}
                {menuFor === msg.id && (
                  <div role="menu" onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 5, background: '#1b1b1b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 4, minWidth: 140 }}>
                    <button type="button" role="menuitem" disabled={msg.reportedByMe}
                      onClick={() => { setMenuFor(null); setReportFor(msg.id); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', minHeight: 36, padding: '6px 10px', background: 'none', border: 'none', borderRadius: 8, cursor: msg.reportedByMe ? 'default' : 'pointer', color: msg.reportedByMe ? '#777' : '#ff6b6b', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
                      {msg.reportedByMe ? t('masa.reported') : t('masa.reportAction')}
                    </button>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>

        {isOpen && !isClosed && (
          <div ref={composerRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', boxSizing: 'border-box', width: '100%' }}>
            {emojiOpen && (
              <div role="listbox" aria-label={t('masa.emoji')} style={{ position: 'absolute', bottom: '100%', left: 8, right: 8, zIndex: 5, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))', gap: 2, padding: 8, background: '#1b1b1b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, marginBottom: 6 }}>
                {EMOJIS.map(e => (
                  <button key={e} type="button" onClick={() => setInput(v => (v + e).slice(0, 1000))}
                    style={{ minHeight: 36, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, borderRadius: 8 }}>{e}</button>
                ))}
              </div>
            )}
            <button type="button" aria-label={t('masa.emoji')} aria-expanded={emojiOpen} onClick={() => setEmojiOpen(v => !v)} disabled={preview}
              style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', background: 'none', border: 'none', cursor: preview ? 'not-allowed' : 'pointer', fontSize: 20, lineHeight: 1, opacity: preview ? 0.5 : 1 }}>
              🙂
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value.slice(0, 1000))}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              onFocus={() => setTimeout(keepComposerVisible, 300)}
              disabled={preview}
              placeholder=""
              className="ahenk-chat-input"
              style={{
                flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '8px 10px', fontSize: 16, color: '#f5f5f5',
                fontFamily: 'Inter, sans-serif', outline: 'none', opacity: preview ? 0.5 : 1,
              }}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={preview || !input.trim() || sending}
              aria-label={t('masa.send')}
              style={{ flexShrink: 0, width: 38, height: 38, borderRadius: '50%', border: 'none', background: '#c0392b', color: '#fff', cursor: input.trim() && !sending ? 'pointer' : 'not-allowed', opacity: input.trim() && !sending ? 1 : 0.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        )}
        {sendError && isOpen && !isClosed && (
          <p role="alert" style={{ margin: 0, padding: '0 10px 8px', fontSize: 12, lineHeight: 1.5, color: '#ff6b6b', fontFamily: 'Inter, sans-serif' }}>
            {sendError}
          </p>
        )}
        {notice && <p role="status" style={{ margin: 0, padding: '0 10px 8px', fontSize: 12, color: '#a39c93', fontFamily: 'Inter, sans-serif' }}>{notice}</p>}
      </div>

      {/* Sabit Masa Kuralları kartı */}
      <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)' }}>
        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.55, color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter, sans-serif' }}>
          <strong style={{ color: '#f4f1ec' }}>{t('masa.chatRulesTitle')}</strong> {t('masa.chatRulesText')}
        </p>
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

export function MasaDetayKarti({ masa, apiBase, token, archive = false, reviewHref, preview }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const [lightboxIdx,   setLightboxIdx]   = useState<number | null>(null);
  // Katılımcı profil fotoğrafı tam ekran (kendi fotoğrafında da düzenleme yok; fotoğraf yalnız Profilim'den değişir)
  const [viewer, setViewer] = useState<string | null>(null);
  const openPhoto = (p: { photoUrl?: string | null }) => { if (p.photoUrl) setViewer(p.photoUrl); };
  // "Değerlendir" açılıştan (ertesi gün 00:00) önce basılırsa uyarı
  const [reviewWarn, setReviewWarn] = useState('');
  const reviewAt = reviewOpensAt(masa.scheduledAt);
  function handleReview() {
    if (Date.now() < reviewAt.getTime()) {
      const date = reviewAt.toLocaleDateString(locale === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' });
      setReviewWarn(t('masa.reviewNotYet', { date }));
      setTimeout(() => setReviewWarn(''), 4000);
      return;
    }
    if (reviewHref) window.location.href = reviewHref;
  }
  // "Nasıl çalışır?" penceresi
  const [sosHowOpen, setSosHowOpen] = useState(false);

  const photos     = masa.venuePhotos ?? [];
  const mapLink    = mapsUrl(masa.venueMapsUrl, masa.venueAddress);
  const rows       = participantRows(masa.participants.filter(p => !p.cancelled), masa.type);

  const authHeaders = apiBase ? jsonHeaders(token) : null;
  const [shareOpen, setShareOpen] = useState(false);

  const hasChat = !!apiBase;

  // SOS görünürlük: masa saatinden backend'in verdiği bitiş anına kadar
  const now = new Date();
  const sosVisible = authHeaders && now >= new Date(masa.scheduledAt) && now < new Date(masa.sosEndsAt);

  // SOS state
  const [showSos,    setShowSos]    = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosDone,    setSosDone]    = useState(false);
  const [, setSosReportId] = useState<string | null>(null);
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


  // Kapak, tarih satırı ve katılımcılar
  // Mekânın yalnız ilk fotoğrafı gösterilir (tek fotoğraf; eski kayıtlardaki diğerleri gösterilmez)
  const cover = photos[0] ?? null;

  return (
    <>
      {shareOpen && authHeaders && (
        <ShareCardModal meetingId={masa.id} apiBase={apiBase!} headers={authHeaders} onClose={() => setShareOpen(false)} />
      )}
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
      <PhotoViewer url={viewer} onClose={() => setViewer(null)} />
      <AnimatePresence>
        {sosHowOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSosHowOpen(false)}
            role="dialog" aria-modal="true" aria-labelledby="sos-how-title"
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 380, background: '#0f0808', border: '1.5px solid rgba(192,57,43,0.7)', borderRadius: 16, padding: '24px 20px 20px' }}>
              <button type="button" onClick={() => setSosHowOpen(false)} aria-label={t('masa.close')}
                style={{ position: 'absolute', top: 10, right: 10, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#f5f5f5', fontSize: 18, cursor: 'pointer' }}>
                ×
              </button>
              <p id="sos-how-title" style={{ margin: '0 40px 12px 0', fontSize: 16, fontWeight: 800, color: '#ff6b6b', fontFamily: 'Inter, sans-serif' }}>{t('masa.sosHow')}</p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter, sans-serif' }}>{t('masa.sosHowText')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Ana kart ── Geçmiş masada (archive) kendi kenarı ve köşesi yok: Geçmiş Masalarım dış kartının içinde tek kenarla biter */}
      <motion.div
        className="ll-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ position: 'relative', overflow: 'hidden', padding: 0, background: '#121212', ...(archive ? { border: 'none', borderRadius: 0 } : {}) }}
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

          {/* Alt: mekân adı + ilçe */}
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
          </div>
        </div>

        <div style={{ padding: 18 }}>
          {/* Tarih satırı ("18 Kasım, Çarşamba 20:00"), sağında Haritada Gör */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '12px 14px', borderRadius: 12, marginBottom: 20,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" />
              </svg>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f5', fontFamily: 'Inter, sans-serif' }}>{preview ? preview.dateLabel : formatCardDate(masa.scheduledAt, locale, archive)}</span>
            </div>
            {mapLink && (
              <a
                href={mapLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flexShrink: 0, display: 'inline-flex', alignItems: 'center', minHeight: 36,
                  padding: '0 14px', borderRadius: 9999, background: '#c0392b', color: '#fff',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', fontFamily: 'Inter, sans-serif', textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(192,57,43,0.4)',
                }}
              >
                {t('masa.seeOnMap')}
              </a>
            )}
          </div>

          {/* Masa Katılımcıları: satırda en fazla 2 kişi; fotoğraf, altında görünen ad ("Ahmet Y."), altında kendi mesleği.
              Geçmiş masada (archive) kullanıcının kendisi aynen; diğer katılımcılarda fotoğraf, ad ve meslek yok, "Masanız Kuruldu"
              ekranındaki gibi DetayAvatar (cinsiyet renkli bordür, beyaz kalın baş harfler "M.D.") */}
          <p style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#f5f5f5', fontFamily: 'Inter, sans-serif' }}>
            {t('masa.tableParticipants')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            {rows.map((row, r) => (
              <div key={r} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {row.map((p, i) => {
                  if (archive && !p.isSelf) {
                    return (
                      <div key={`${p.initials}-${i}`} style={{ display: 'flex', justifyContent: 'center' }}>
                        <DetayAvatar participant={{ initials: p.initials, gender: p.gender }} delay={0.52 + (r * 2 + i) * 0.1} size={64} />
                      </div>
                    );
                  }
                  const av = <DetayAvatar participant={p} delay={0.52 + (r * 2 + i) * 0.1} size={64} />;
                  return (
                    <div key={`${p.initials}-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0, textAlign: 'center' }}>
                      {p.photoUrl ? (
                        <button type="button" onClick={() => openPhoto(p)} aria-label={t('masa.enlargePhoto')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>{av}</button>
                      ) : av}
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#f4f1ec', fontFamily: 'Inter, sans-serif', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName ?? p.initials}</span>
                      <span style={{ minHeight: 18, fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.65)', fontFamily: 'Inter, sans-serif', maxWidth: '100%' }}>{p.occupation ?? ''}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

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
                {!!masa.aiReport.questions?.length && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={AI_SUB}>{t('masa.aiQuestions')}</p>
                    <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {masa.aiReport.questions.map((q, i) => (
                        <li key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter, sans-serif', lineHeight: 1.55 }}>{q}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {!!masa.aiReport.dna && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={AI_SUB}>{t('masa.aiDna')}</p>
                    <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.65)', fontFamily: 'Inter, sans-serif', lineHeight: 1.65 }}>{masa.aiReport.dna}</p>
                  </div>
                )}
                {!!masa.aiReport.dna && <p style={AI_SUB}>{t('masa.aiComment')}</p>}
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.65)', fontFamily: 'Inter, sans-serif', lineHeight: 1.65 }}>
                  {masa.aiReport.content}
                </p>
                {!archive && authHeaders && (
                  <StdButton variant="primary" type="button" onClick={() => setShareOpen(true)} className="justify-center" style={{ marginTop: 14, width: '100%' }}>
                    {t('masa.shareOpen')}
                  </StdButton>
                )}
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.62)', fontFamily: 'Inter, sans-serif', lineHeight: 1.65 }}>
                {t('tm.meetupNote')}
              </p>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* ── Alt kart: acil yardım (eski rezervasyon kartı ve Yola Çıktım yerinde), sohbet, gelmeyen işaretleme, Değerlendir.
          Geçmiş masada (archive) bu kart yok ── */}
      {!archive && (authHeaders || preview) && (
      <motion.div
        className="ll-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: 'easeOut' }}
        style={{ marginTop: 12 }}
      >
        {/* SOS Acil Yardım: masa saatinden ertesi gün 08:00'e kadar */}
        {sosVisible && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            style={{ marginBottom: 4 }}
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
                <p style={{ margin: '10px 0 0', fontSize: 11.5, lineHeight: 1.55, color: 'rgba(255,107,107,0.75)', fontFamily: 'Inter, sans-serif' }}>
                  {t('masa.sosHelp')}{' · '}
                  <button type="button" onClick={() => setSosHowOpen(true)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#ff6b6b', fontSize: 11.5, fontWeight: 700, textDecoration: 'underline', fontFamily: 'Inter, sans-serif' }}>
                    {t('masa.sosHow')}
                  </button>
                </p>
              </>
            )}
          </motion.div>
        )}

        {/* Sohbet bölümü */}
        {(hasChat || preview) && (
          <ChatSection meetingId={masa.id} apiBase={apiBase ?? ''} token={token} preview={!!preview}
            count={`${masa.participants.filter(p => !p.cancelled).length}/${masa.maxParticipants ?? masa.participants.filter(p => !p.cancelled).length}`} />
        )}

        {/* Masaya gelmeyen işaretleme */}
        {hasChat && !preview && (
          <NoShowSection meetingId={masa.id} apiBase={apiBase!} token={token} />
        )}

        {/* Değerlendir: değerlendirme ertesi gün 08:00'de açılır; önce basılırsa uyarı */}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={handleReview} disabled={!!preview} style={{ ...GOLD_PILL, ...(preview ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}>{t('tm.review')}</button>
          {reviewWarn && (
            <p role="alert" style={{ margin: 0, fontSize: 12, color: '#ffb347', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>{reviewWarn}</p>
          )}
        </div>
      </motion.div>
      )}
    </>
  );
}
