'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, API_PREFIX } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { ConfirmedRadarView, KankaPairs, MasaDetayKarti, RezervasyonIptal, gColor, type DashboardItem, type MasaDetayData, type MasaTuru, type VenuePhoto } from '@ahenk/ui';
import LiveTabs from '@/components/live/LiveTabs';
import { useMasaTabs } from '@/components/live/useMasaTabs';

// GET /meetings/my-history yanıtı (sadece tamamlanmış masalar)
interface HistoryMeeting {
  id: string;
  date: string;
  type?: 'GROUP' | 'ONE_ON_ONE' | 'KANKA';
  venueName: string | null;
  cityName?: string | null;
  maxParticipants?: number;
  venueAddress?: string | null;
  venueMapsUrl?: string | null;
  venuePhotos?: VenuePhoto[];
  aiReport?: { content: string; uyumSkoru: number; generatedAt: string } | null;
  participants?: { initials: string; gender: string | null; isSelf?: boolean; pair?: 'MINE' | 'OTHER' }[];
  review?: { rating: number; comment: string | null } | null;
  blocked?: { initials: string; gender: string | null }[];
  isReviewed?: boolean;
}

interface UserInfo {
  firstName: string;
  lastName: string;
  gender?: string;
}

function fmtDate(val: string) {
  return new Date(val).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' });
}

/* ── Mock kart renk sabitleri (MasaDetayKarti ile aynı) ── */
const GREEN      = '#27ae60';

const MAV_D    = 48;
const MAV_R    = MAV_D / 2;
const MAV_BR   = MAV_R - 2.5;
const MAV_CIRC = 2 * Math.PI * MAV_BR;

function mockGBg(g?: string | null) {
  return g === 'FEMALE' ? 'rgba(244,143,177,0.12)' : 'rgba(79,195,247,0.12)';
}

/* ── Mock avatar (DetayAvatar ile birebir aynı tasarım) ── */
function MockAvatar({
  initials,
  gender,
  delay = 0,
  showCheck = false,
}: {
  initials: string;
  gender?: string | null;
  delay?: number;
  showCheck?: boolean;
}) {
  const color = gColor(gender);
  const bg    = mockGBg(gender);
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
      style={{ position: 'relative', width: MAV_D, height: MAV_D, flexShrink: 0 }}
    >
      <svg width={MAV_D} height={MAV_D} viewBox={`0 0 ${MAV_D} ${MAV_D}`} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={MAV_R} cy={MAV_R} r={MAV_R - 1} fill={bg} />
        <motion.circle
          cx={MAV_R} cy={MAV_R} r={MAV_BR}
          fill="none" stroke={color} strokeWidth={2.5}
          strokeLinecap="round" strokeDasharray={MAV_CIRC}
          style={{ rotate: '-90deg', transformOrigin: `${MAV_R}px ${MAV_R}px` }}
          initial={{ strokeDashoffset: MAV_CIRC }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ delay: delay + 0.5, duration: 0.8, ease: 'easeOut' }}
        />
        <motion.circle
          cx={MAV_R} cy={MAV_R} r={MAV_BR}
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
        {initials}
      </div>
      {showCheck && (
        <div style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 16, height: 16, borderRadius: '50%',
          background: GREEN,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: '#fff', fontWeight: 700,
          border: '2px solid #111',
        }}>
          ✓
        </div>
      )}
    </motion.div>
  );
}

/* ── Boş/preview kart — MasaDetayKarti tasarımının mock hali ── */
function EmptyMasaCard({
  locked,
  cardType,
  userInfo,
  kanka,
}: {
  locked: boolean;
  cardType: 'group' | 'basbasa' | 'kanka';
  userInfo?: UserInfo;
  kanka?: { initials: string; gender: string | null } | null;
}) {
  const initials = userInfo
    ? `${(userInfo.firstName[0] ?? '?').toUpperCase()}.${(userInfo.lastName[0] ?? '?').toUpperCase()}.`
    : '?';
  const uGender   = userInfo?.gender ?? null;
  const oppGender = uGender === 'FEMALE' ? 'MALE' : 'FEMALE';

  type MockP = { initials: string; gender: string | null; check?: boolean };
  const participants: MockP[] = cardType === 'basbasa'
    ? [
        { initials, gender: uGender },
        { initials: '?', gender: oppGender },
      ]
    : [
        { initials, gender: uGender ?? 'MALE' },
        { initials: '?', gender: oppGender },
        { initials: '?', gender: uGender ?? 'MALE' },
        { initials: '?', gender: oppGender },
        { initials: '?', gender: uGender ?? 'MALE' },
        { initials: '?', gender: oppGender },
      ];

  return (
    <div className="ll-card" style={{ position: 'relative' }}>
      {locked && (
        <>
          <style>{`@keyframes lockShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}50%{transform:translateX(0)}75%{transform:translateX(3px)}}`}</style>
          <img
            src="/lock-icon.png"
            alt="Kilitli"
            width={56}
            height={56}
            style={{ position: 'absolute', top: 16, right: 16, zIndex: 2, opacity: 0.85, animation: 'lockShake 0.8s ease-in-out infinite' }}
          />
        </>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        {/* Shimmer */}
        <motion.div
          initial={{ opacity: 0.6, x: '-100%' }}
          animate={{ opacity: 0, x: '200%' }}
          transition={{ duration: 1.0, ease: 'easeOut', delay: 0.1 }}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
            background: 'linear-gradient(105deg, transparent 30%, rgba(39,174,96,0.15) 50%, transparent 70%)',
          }}
        />

        {/* MASA DETAYI etiketi */}
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}
        >
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: GREEN, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
            MASA DETAYI
          </span>
        </motion.div>

        {/* Mekan adı */}
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={{ marginBottom: 4 }}
        >
          <h2 style={{
            margin: 0,
            fontFamily: 'var(--font-serif, "DM Serif Display", Georgia, serif)',
            fontSize: 26, fontWeight: 400, color: '#f5f5f5',
            letterSpacing: '0.01em', lineHeight: 1.2,
          }}>
            Mekan Adı
          </h2>
        </motion.div>

        {/* Mekan adresi */}
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{ margin: '0 0 16px', fontSize: 13, color: '#666', fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}
        >
          İstanbul
        </motion.p>

        {/* 3 SVG fotoğraf placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
          style={{ marginBottom: 18 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                borderRadius: 8, aspectRatio: '4/3',
                background: 'rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="1" y="5" width="22" height="15" rx="2" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="4" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
                  <path d="M8 5l1.5-3h5L16 5" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Haritada Gör */}
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          style={{ marginBottom: 18 }}
        >
          <button disabled className="btn-primary w-full justify-center">
            HARİTADA GÖR
          </button>
        </motion.div>

        {/* Çizgi */}
        <motion.div
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
          transition={{ delay: 0.35, duration: 0.45, ease: 'easeOut' }}
          style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '0 0 16px', transformOrigin: 'left' }}
        />

        {/* Buluşma saati */}
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#888', fontFamily: 'Inter, sans-serif' }}>Buluşma</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f5', fontFamily: 'Inter, sans-serif', letterSpacing: '0.01em' }}>
            {cardType === 'basbasa' ? 'Cumartesi · 20:00' : cardType === 'kanka' ? 'Pazar · 20:00' : 'Cuma · 20:00'}
          </span>
        </motion.div>

        {/* Katılımcılar */}
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48, duration: 0.4 }}
          style={{ marginBottom: 20 }}
        >
          <p style={{ margin: '0 0 12px', fontSize: 9, fontWeight: 700, color: '#555', letterSpacing: '0.14em', textTransform: cardType === 'kanka' ? 'none' : 'uppercase', fontFamily: 'Inter, sans-serif' }}>
            {cardType === 'basbasa' ? 'BAŞ BAŞA' : cardType === 'kanka' ? 'Kanka Çiftler' : 'KATILIMCILAR'}
          </p>
          {cardType === 'kanka' ? (
            <KankaPairs mine={[{ initials, gender: uGender, isSelf: true }, ...(kanka ? [kanka] : [])]} other={[]} />
          ) : (
          <div style={cardType === 'group' ? { display: 'grid', gridTemplateColumns: 'repeat(4, 48px)', gap: 10 } : { display: 'flex', gap: 10 }}>
            {participants.map((p, i) => (
              <MockAvatar
                key={i}
                initials={p.initials}
                gender={p.gender}
                delay={0.52 + i * 0.1}
                showCheck={p.check}
              />
            ))}
          </div>
          )}
        </motion.div>

        {/* Yapay Zeka Masa Raporu */}
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
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
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.62)', fontFamily: 'Inter, sans-serif', lineHeight: 1.65 }}>
            Masa kurulduktan sonra yapay zeka uyum raporu burada görünecek.
          </p>
        </motion.div>

        {/* Bilgi kutusu */}
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72, duration: 0.4 }}
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '12px 14px', marginBottom: 16,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.62)', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
            Rezervasyonunuz tamamlandı. Girişte görevliye isminizi söylediğinizde masanıza yönlendirileceksiniz. İyi eğlenceler.
          </p>
        </motion.div>

        {/* Yola Çıktım */}
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.78, duration: 0.4 }}
          style={{ marginBottom: 10 }}
        >
          <button disabled className="btn-primary w-full justify-center">
            Yola Çıktım
          </button>
        </motion.div>

        {/* Sohbet bölümü */}
        <div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '0 0 20px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#555' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', color: '#555' }}>
              {cardType === 'basbasa' ? 'BAŞ BAŞA SOHBETİ' : cardType === 'kanka' ? 'KANKAMLA SOHBETİ' : 'GRUP SOHBETİ'}
            </span>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#f5f5f5', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
                Henüz mesaj yok. İlk mesajı sen gönder.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.10)' }}>
              <div style={{
                flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#555',
                fontFamily: 'Inter, sans-serif',
              }}>
              </div>
              <button disabled className="btn-primary">
                Gönder
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Tek masa bloğu ── */
function MasaBlock({
  item,
  locked,
  cardType,
  userInfo,
  kanka,
  onCancelled,
}: {
  item?: DashboardItem;
  locked: boolean;
  cardType: 'group' | 'basbasa' | 'kanka';
  userInfo?: UserInfo;
  kanka?: { initials: string; gender: string | null } | null;
  onCancelled?: () => void;
}) {
  const meeting = item?.meeting;

  let content: React.ReactNode;

  if (locked || !meeting) {
    content = <EmptyMasaCard locked={locked} cardType={cardType} userInfo={userInfo} kanka={kanka} />;
  } else if (item.phase === 'REVEALED' && meeting.venueName) {
    const detayData: MasaDetayData = {
      id: meeting.id,
      type: meeting.type,
      maxParticipants: meeting.maxParticipants,
      scheduledAt: meeting.scheduledAt,
      sosEndsAt: meeting.sosEndsAt,
      venueName: meeting.venueName,
      venueAddress: meeting.venueAddress,
      venueMapsUrl: meeting.venueMapsUrl,
      venuePhotos: meeting.venuePhotos,
      participants: meeting.participants,
      aiReport: meeting.aiReport,
    };
    content = (
      <div className="ll-card">
        <MasaDetayKarti
          masa={detayData}
          apiBase={API_PREFIX}
        />
      </div>
    );
  } else if (meeting.participants.length > 0) {
    const isOneOnOne = meeting.type === 'ONE_ON_ONE';
    content = (
      <div className="ll-card">
        <ConfirmedRadarView
          participants={meeting.participants}
          maxParticipants={meeting.maxParticipants}
          type={meeting.type}
          scheduledAt={meeting.scheduledAt}
          infoText={isOneOnOne
            ? "Cumartesi saat 10:00'da masa detayı burada görünecek, bildirim göndereceğiz."
            : meeting.type === 'KANKA'
              ? "Pazar saat 10:00'da masa detayı burada görünecek, bildirim göndereceğiz."
              : "Cuma saat 10:00'da masa detayı burada görünecek, bildirim göndereceğiz."}
        />
        {meeting.type === 'KANKA' && (
          <div style={{ marginTop: 16 }}>
            <KankaPairs
              mine={meeting.participants.filter(p => p.pair === 'MINE' && !p.cancelled)}
              other={meeting.participants.filter(p => p.pair === 'OTHER' && !p.cancelled)}
            />
          </div>
        )}
        {/* Rezervasyon iptali: kilit günü 20:00'ye kadar (masa kartı açıldığında iptal yok) */}
        <RezervasyonIptal
          meetingId={meeting.id}
          type={meeting.type ?? (cardType === 'basbasa' ? 'ONE_ON_ONE' : cardType === 'kanka' ? 'KANKA' : 'GROUP')}
          scheduledAt={meeting.scheduledAt}
          cancelRightUsed={meeting.cancelRightUsed}
          apiBase={API_PREFIX}
          onCancelled={onCancelled}
          modalPortal={(node) => createPortal(node, document.body)}
        />
      </div>
    );
  } else {
    content = <EmptyMasaCard locked={false} cardType={cardType} userInfo={userInfo} kanka={kanka} />;
  }

  return <div key={meeting?.id ?? cardType}>{content}</div>;
}

const CARD_TITLE: Record<MasaTuru, string> = { GROUP: 'Grup Masa Kartı', ONE_ON_ONE: 'Baş Başa Masa Kartı', KANKA: 'Kankamla Masa Kartı' };
const CARD_TYPE: Record<MasaTuru, 'group' | 'basbasa' | 'kanka'> = { GROUP: 'group', ONE_ON_ONE: 'basbasa', KANKA: 'kanka' };
const HISTORY_TYPE: Record<MasaTuru, string> = { GROUP: 'Grup Masası', ONE_ON_ONE: 'Baş Başa Masası', KANKA: 'Kankamla Masası' };

export function TabMasalar({ userInfo, kycApproved, onGoKyc }: {
  userInfo?: UserInfo;
  kycApproved?: boolean;
  onGoKyc?: () => void;
}) {
  const { ready, kanka, tab, tabItem, selectTab, statuses, reload } = useMasaTabs();
  const [history, setHistory] = useState<HistoryMeeting[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    api.get<HistoryMeeting[]>('/meetings/my-history').then(h => setHistory(Array.isArray(h) ? h : [])).catch(() => {});
  }, []);

  // Bekleme ekranında iptal sonrası (iptal mesajı görünsün diye 2 sn sonra)
  const afterCancel = () => { setTimeout(reload, 2000); };

  if (!ready) return <SkeletonBlock lines={5} />;

  // Hiç hakkı ve masası yoksa kartlar önizlemedir
  const locked = Object.values(statuses).every(s => s === 'NONE');

  return (
    <div className="flex flex-col gap-6">
      {!kycApproved && (
        <div
          className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl"
          style={{
            background: '#000',
            border: '1px solid #722F37',
          }}
        >
          <p className="text-sm leading-snug" style={{ color: 'rgba(192,57,43,0.85)' }}>
            Masaya katılmak için kimlik doğrulaması gereklidir.
          </p>
          <button
            onClick={onGoKyc}
            className="btn-primary whitespace-nowrap shrink-0"
          >
            Doğrula
          </button>
        </div>
      )}
      {locked && (
        <a href="/profil?tab=paket" className="btn-primary w-full justify-center">
          Paket Seç
        </a>
      )}

      {locked && (
        <div style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ color: 'rgba(192,57,43,0.85)', fontSize: 11, lineHeight: 1.5, margin: 0 }}>
            Aşağıda bulunan Masa Detay bilgileri şuanda önizlemedir. Paket alarak eşleştiğinizde, gerçek zamanlı randevu bilgileri yer alacaktır.
          </p>
        </div>
      )}

      <LiveTabs tab={tab} statuses={statuses} onTab={selectTab} />

      <div>
        <div className="ll-head">
          <h2 className="ll-title">{locked ? 'Masa Detay Kartı' : CARD_TITLE[tab]}</h2>
          <button type="button" onClick={() => setHistoryOpen(v => !v)} aria-expanded={historyOpen} className="btn-ghost" style={{ flexShrink: 0 }}>
            Geçmiş Masalarım
          </button>
        </div>
        {historyOpen && <HistoryList history={history} />}
        {tab === 'KANKA' && !tabItem && statuses.KANKA === 'SCANNING' && (
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#c9c2b8', lineHeight: 1.6 }}>
            Kankanla birlikte eşleşme taraması devam ediyor. Karşı cinsten bir kanka çiftiyle eşleştiğinizde masanız burada görünecek;
            detaylar Pazar 10:00&apos;da açıklanır. Tarama Cumartesi 23:59&apos;da kapanır.
          </p>
        )}
        <MasaBlock
          key={tab}
          item={tabItem}
          locked={locked}
          cardType={CARD_TYPE[tab]}
          userInfo={userInfo}
          kanka={kanka}
          onCancelled={afterCancel}
        />
      </div>
    </div>
  );
}

function HistoryList({ history }: { history: HistoryMeeting[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (history.length === 0) {
    return <section className="ll-card" style={{ marginBottom: 16 }}><p style={{ margin: 0, fontSize: 13, color: '#a39c93' }}>Henüz geçmiş masan yok.</p></section>;
  }
  return (
    <section className="ll-card" style={{ marginBottom: 16, padding: '6px 18px' }}>
      {history.map((m, i) => {
        const isOpen = openId === m.id;
        return (
          <div key={m.id} style={{ borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <div className="flex items-center justify-between gap-3" style={{ minHeight: 44, padding: '6px 0' }}>
              <span style={{ fontSize: 13, color: '#f4f1ec', minWidth: 0 }}>
                {[fmtDate(m.date), HISTORY_TYPE[m.type ?? 'GROUP'], m.venueName, m.cityName].filter(Boolean).join(' - ')}
              </span>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : m.id)}
                aria-expanded={isOpen}
                aria-label={isOpen ? 'Masa kartını kapat' : 'Masa kartını aç'}
                style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#a39c93', fontSize: 14, padding: 6, transform: isOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}
              >
                ▾
              </button>
            </div>
            {isOpen && <HistoryCard meeting={m} />}
            {!m.isReviewed && (
              <a href={`/degerlendirme/${m.id}`} className="ll-mono" style={{ display: 'inline-block', margin: '0 0 8px', fontSize: 11, color: '#e8a27a' }}>
                Değerlendir
              </a>
            )}
          </div>
        );
      })}
    </section>
  );
}

// Salt görüntüleme: sohbet yok, yalnızca Haritada Gör çalışır
function HistoryCard({ meeting: m }: { meeting: HistoryMeeting }) {
  const masa: MasaDetayData = {
    id: m.id,
    type: m.type,
    maxParticipants: m.maxParticipants,
    scheduledAt: m.date,
    sosEndsAt: m.date,
    venueName: m.venueName ?? 'Mekân bilgisi yok',
    venueAddress: m.venueAddress,
    venueMapsUrl: m.venueMapsUrl,
    venuePhotos: m.venuePhotos,
    participants: m.participants ?? [],
    aiReport: m.aiReport,
  };
  return (
    <div style={{ paddingBottom: 12 }}>
      <MasaDetayKarti masa={masa} archive />
      {m.review && (
        <div style={{ marginTop: 12 }}>
          <p className="ll-mono" style={{ margin: '0 0 4px', fontSize: 11, color: '#a39c93' }}>DEĞERLENDİRMEN</p>
          <p style={{ margin: 0, fontSize: 13, color: '#f4f1ec' }}>{m.review.rating}/5{m.review.comment ? ` · ${m.review.comment}` : ''}</p>
        </div>
      )}
      {!!m.blocked?.length && (
        <div style={{ marginTop: 12 }}>
          <p className="ll-mono" style={{ margin: '0 0 4px', fontSize: 11, color: '#a39c93' }}>ENGELLEDİKLERİN</p>
          <div className="flex flex-wrap gap-3">
            {m.blocked.map((b, i) => (
              <span key={`${b.initials}-${i}`} className="ll-mono" style={{ fontSize: 14, fontWeight: 600, color: gColor(b.gender) }}>{b.initials}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
