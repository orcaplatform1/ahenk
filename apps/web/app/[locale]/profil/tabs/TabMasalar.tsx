'use client';

import React, { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDayTab, formatNamed, occupationLabel, reviewClosesAt, weekdayName, type Lang } from '@ahenk/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { api, API_PREFIX } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { ConfirmedRadarView, GOLD_PILL, KankaPairs, MasaDetayKarti, gColor, type DashboardItem, type MasaDetayData, type MasaTuru, type VenuePhoto, StdButton } from '@ahenk/ui';
import LiveTabs from '@/components/live/LiveTabs';
import { useMasaTabs } from '@/components/live/useMasaTabs';
import WeeklySelectionModal from '@/components/live/WeeklySelectionModal';
import { ReviewStar } from '@/components/ReviewStar';

// GET /meetings/my-history yanıtı (sadece tamamlanmış masalar)
interface HistoryMeeting {
  id: string;
  date: string;
  type?: 'GROUP' | 'ONE_ON_ONE' | 'KANKA';
  venueName: string | null;
  cityName?: string | null;
  maxParticipants?: number;
  venueAddress?: string | null;
  venueDistrict?: string | null;
  venueMapsUrl?: string | null;
  venuePhotos?: VenuePhoto[];
  aiReport?: { content: string; uyumSkoru: number; generatedAt: string } | null;
  participants?: { initials: string; displayName?: string | null; gender: string | null; isSelf?: boolean; pair?: 'MINE' | 'OTHER'; photoUrl?: string | null; occupation?: string | null }[];
  review?: { rating: number; comment: string | null } | null;
  blocked?: { initials: string; gender: string | null }[];
  isReviewed?: boolean;
}

interface UserInfo {
  firstName: string;
  lastName: string;
  gender?: string;
}

function fmtDate(val: string, locale: Lang = 'tr') {
  return formatNamed(val, locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ── Mock kart renk sabitleri (MasaDetayKarti ile aynı) ── */
const GREEN      = '#27ae60';

const MAV_D    = 44; // Masa detay kartındaki tek satır daire boyu
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
      style={{ position: 'relative', width: MAV_D, height: MAV_D, flexShrink: 0, borderRadius: '50%' }}
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

/* ── Boş/preview kart — MasaDetayKarti yeni düzeninin mock hali: kapak, masa türü rozeti, bilgi şeridi, katılımcılar, alt kart ── */

function EmptyMasaCard({
  locked,
  cardType,
  userInfo,
  kanka,
  photo,
}: {
  locked: boolean;
  cardType: 'group' | 'basbasa' | 'kanka';
  userInfo?: UserInfo;
  kanka?: { initials: string; gender: string | null } | null;
  photo?: VenuePhoto | null; // Masaya bağlı mekânın güncel ilk fotoğrafı (sunucudan geldiyse)
}) {
  const t = useTranslations();
  const locale = useLocale() as Lang;
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
    <div>
      {/* ── Ana kart ── */}
      <div className="ll-card" style={{ position: 'relative', overflow: 'hidden', padding: 0, background: '#121212' }}>
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

          {/* Kapak: mekânın güncel ilk fotoğrafı tam genişlikte 16:9 (object-fit: cover); fotoğraf yoksa fotoğraf alanı yok,
              masa türü ve mekân adı normal akışta (MasaDetayKarti ile aynı) */}
          <div style={photo ? { position: 'relative', aspectRatio: '16 / 9' } : { position: 'relative', display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 14px 0' }}>
            {photo && (
              <>
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.caption ?? t('masa.photoAlt', { n: 1 })} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(18,18,18,0.35) 0%, rgba(18,18,18,0) 30%, rgba(18,18,18,0) 45%, rgba(18,18,18,0.92) 100%)' }} />
              </>
            )}

            {/* Üst satır: sağda kilit (fotoğraf varken kapak üstünde) */}
            <div style={photo ? { display: 'contents' } : { display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 10 }}>

            {locked && (
              <>
                <style>{`@keyframes lockShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}50%{transform:translateX(0)}75%{transform:translateX(3px)}}`}</style>
                <img
                  src="/lock-icon.webp"
                  alt={t('tm.locked')}
                  width={56}
                  height={56}
                  style={{ ...(photo ? { position: 'absolute', top: 12, right: 12 } : {}), zIndex: 2, opacity: 0.85, animation: 'lockShake 0.8s ease-in-out infinite' }}
                />
              </>
            )}
            </div>

            {/* Alt: mekân adı + konum */}
            <div style={{ ...(photo ? { position: 'absolute', left: 14, right: 14, bottom: 12 } : {}), display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{
                  margin: 0,
                  fontFamily: 'var(--font-serif, "DM Serif Display", Georgia, serif)',
                  fontSize: 24, fontWeight: 400, color: '#f5f5f5',
                  letterSpacing: '0.01em', lineHeight: 1.2,
                }}>
                  {t('tm.venueName')}
                </h2>
                <p style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter, sans-serif' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" />
                  </svg>
                  İstanbul
                </p>
              </div>
            </div>
          </div>

          <div style={{ padding: 18 }}>
            {/* MASA DETAYI etiketi */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: GREEN, letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
                {t('masa.detailTitle')}
              </span>
            </div>

            {/* Tarih satırı: buluşma günü/saati, sağında Haritada Gör (pasif) */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '12px 14px', borderRadius: 12, marginBottom: 20,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" />
                </svg>
                <div>
                  <div style={{ fontSize: 11, color: '#888', fontFamily: 'Inter, sans-serif', lineHeight: 1.3 }}>{t('masa.meetup')}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f5', fontFamily: 'Inter, sans-serif', lineHeight: 1.2 }}>
                    {`${weekdayName(cardType === 'basbasa' ? 6 : cardType === 'kanka' ? 0 : 5, locale)}, 20:00`}
                  </div>
                </div>
              </div>
              <button disabled style={{
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', minHeight: 36, padding: '0 14px', borderRadius: 9999,
                background: '#c0392b', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                fontFamily: 'Inter, sans-serif', opacity: 0.5, cursor: 'not-allowed',
              }}>
                {t('masa.seeOnMap')}
              </button>
            </div>

            {/* Katılımcılar */}
            <p style={{ margin: '0 0 12px', fontSize: 9, fontWeight: 700, color: '#555', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
              {cardType === 'basbasa' ? t('masa.oneOnOne') : t('masa.participants')}
            </p>
            <div style={{ marginBottom: 20 }}>
              {cardType === 'kanka' ? (
                <KankaPairs mine={[{ initials, gender: uGender, isSelf: true }, ...(kanka ? [kanka] : [])]} other={[]} />
              ) : (
                <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 8, overflowX: 'auto', padding: 4, margin: -4 }}>
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
            </div>

            {/* Yapay Zeka Masa Raporu */}
            <div style={{
              background: 'rgba(8,18,44,0.75)',
              border: '1px solid rgba(100,130,200,0.18)',
              borderRadius: 12, padding: '14px 16px',
            }}>
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
              {/* Uyum skoru: boş halka "%—" */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
                  <svg width={64} height={64} viewBox="0 0 64 64">
                    <circle cx={32} cy={32} r={29} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
                  </svg>
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#f0f0f0', fontFamily: 'Inter, sans-serif' }}>
                    %—
                  </span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.88)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>
                  {t('masa.aiScore')}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.62)', fontFamily: 'Inter, sans-serif', lineHeight: 1.65 }}>
                {t('tm.meetupNote')}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Alt kart: sohbet ── */}
      <motion.div
        className="ll-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: 'easeOut' }}
        style={{ marginTop: 12 }}
      >
        {/* Sohbet bölümü */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#555' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', color: '#555' }}>
              {t('masa.chatTitle')}
            </span>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#f5f5f5', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
                {t('tm.noMessages')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.10)' }}>
              <div style={{
                flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#555',
                fontFamily: 'Inter, sans-serif',
              }}>
              </div>
              <StdButton variant="primary" disabled>
                {t('masa.send')}
              </StdButton>
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
}: {
  item?: DashboardItem;
  locked: boolean;
  cardType: 'group' | 'basbasa' | 'kanka';
  userInfo?: UserInfo;
  kanka?: { initials: string; gender: string | null } | null;
}) {
  const t = useTranslations();
  const meeting = item?.meeting;

  let content: React.ReactNode;

  if (locked || !meeting) {
    content = <EmptyMasaCard locked={locked} cardType={cardType} userInfo={userInfo} kanka={kanka} photo={meeting?.venuePhotos?.[0]} />;
  } else if (item.phase === 'REVEALED' && meeting.venueName) {
    const detayData: MasaDetayData = {
      id: meeting.id,
      type: meeting.type,
      maxParticipants: meeting.maxParticipants,
      scheduledAt: meeting.scheduledAt,
      sosEndsAt: meeting.sosEndsAt,
      venueName: meeting.venueName,
      venueAddress: meeting.venueAddress,
      venueDistrict: meeting.venueDistrict,
      venueMapsUrl: meeting.venueMapsUrl,
      venuePhotos: meeting.venuePhotos,
      participants: meeting.participants.map((p) => ({ ...p, occupation: p.occupation ? occupationLabel(p.occupation, t) : null })),
      aiReport: meeting.aiReport,
    };
    // Kart kendi ana kartını ve alttaki ayrı kartı (acil yardım, sohbet, Değerlendir) çizer
    content = <MasaDetayKarti masa={detayData} apiBase={API_PREFIX} reviewHref={`/degerlendirme/${meeting.id}`} />;
  } else if (meeting.participants.length > 0) {
    content = (
      <div className="ll-card">
        <ConfirmedRadarView
          participants={meeting.participants}
          maxParticipants={meeting.maxParticipants}
          type={meeting.type}
          scheduledAt={meeting.scheduledAt}
          infoText={t('tm.infoText')}
        />
        {meeting.type === 'KANKA' && (
          <div style={{ marginTop: 16 }}>
            <KankaPairs
              mine={meeting.participants.filter(p => p.pair === 'MINE' && !p.cancelled)}
              other={meeting.participants.filter(p => p.pair === 'OTHER' && !p.cancelled)}
            />
          </div>
        )}
        {/* Seçim iptali ve buluşma türü değişikliği yalnız Eşleşme Paneli'ndeki seçim kartından yapılır */}
      </div>
    );
  } else {
    content = <EmptyMasaCard locked={false} cardType={cardType} userInfo={userInfo} kanka={kanka} photo={meeting?.venuePhotos?.[0]} />;
  }

  return <div key={meeting?.id ?? cardType}>{content}</div>;
}

// Çeviri anahtarları
const CARD_TITLE: Record<MasaTuru, string> = { GROUP: 'tm.cardGroup', ONE_ON_ONE: 'tm.cardOne', KANKA: 'tm.cardKanka' };
const CARD_TYPE: Record<MasaTuru, 'group' | 'basbasa' | 'kanka'> = { GROUP: 'group', ONE_ON_ONE: 'basbasa', KANKA: 'kanka' };
const HISTORY_TYPE: Record<MasaTuru, string> = { GROUP: 'live.wsGroupTitle', ONE_ON_ONE: 'live.wsOneTitle', KANKA: 'live.wsKankaTitle' };

export function TabMasalar({ userInfo, kycApproved, onGoKyc }: {
  userInfo?: UserInfo;
  kycApproved?: boolean;
  onGoKyc?: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Lang;
  const { ready, kanka, tab, tabItem, items, selectTab, statuses, tabAdminCancelled, selection, submitSelection } = useMasaTabs();
  const [history, setHistory] = useState<HistoryMeeting[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dateId, setDateId] = useState<string | null>(null); // Seçili tarih sekmesindeki masa

  useEffect(() => {
    api.get<HistoryMeeting[]>('/meetings/my-history').then(h => setHistory(Array.isArray(h) ? h : [])).catch(() => {});
  }, []);

  if (!ready) return <SkeletonBlock lines={5} />;

  // Hiç hakkı ve masası yoksa kartlar önizlemedir
  const locked = Object.values(statuses).every(s => s === 'NONE');
  // Aktif kaydı (taramada ya da masası kuruluyor) olan kullanıcıya Masalarım'da seçim penceresi açılmaz
  const hasActiveSelection = !!selection?.options.some(o => o.selection || (o.seated && !o.locked));

  // Farklı günlerde birden fazla aktif masa: üstte tarih sekmeleri (aynı güne tek masa olabilir; sekme o masanın türünü seçer)
  const dated = [...items].sort((a, b) => a.meeting.scheduledAt.localeCompare(b.meeting.scheduledAt));
  const dayOf = (iso: string) => formatDayTab(iso, locale);
  const showDates = new Set(dated.map((i) => dayOf(i.meeting.scheduledAt))).size > 1;
  const activeItem = (dateId ? items.find((i) => i.meeting.id === dateId && i.meeting.type === tab) : undefined) ?? tabItem;

  return (
    <div className="flex flex-col gap-6">
      {!hasActiveSelection && <WeeklySelectionModal selection={selection} onSubmit={submitSelection} />}
      {showDates && (
        <div className="flex gap-2 overflow-x-auto" role="tablist">
          {dated.map((i) => {
            const on = activeItem?.meeting.id === i.meeting.id;
            return (
              <StdButton
                variant={on ? 'primary' : 'ghost'}
                key={i.meeting.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => { setDateId(i.meeting.id); selectTab(i.meeting.type ?? 'GROUP'); }}
                style={{ flexShrink: 0 }}
              >
                {dayOf(i.meeting.scheduledAt)}
              </StdButton>
            );
          })}
        </div>
      )}
      <LiveTabs tab={tab} statuses={statuses} onTab={selectTab} noRings />

      {locked && (
        <div style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: 12, padding: '12px 14px' }}>
          <p style={{ color: 'rgba(192,57,43,0.85)', fontSize: 11, lineHeight: 1.5, margin: 0 }}>
            {t('tm.preview')}
          </p>
        </div>
      )}

      {locked && (
        <StdButton variant="primary" as="a" href="/profil?tab=paket" className="w-full justify-center">
          {t('pkg.buy')}
        </StdButton>
      )}

      <div>
        {/* Türe göre başlık, ortalı */}
        <h2 className="ll-title" style={{ textAlign: 'center', marginBottom: 12 }}>{locked ? t('tm.cardDetail') : t(CARD_TITLE[tab])}</h2>
        {tab === 'KANKA' && !activeItem && statuses.KANKA === 'SCANNING' && (
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#c9c2b8', lineHeight: 1.6 }}>
            {t('tm.kankaScanning')}
          </p>
        )}
        {tabAdminCancelled ? (
          <div className="ll-card">
            <p style={{ margin: 0, fontSize: 14, color: '#f5f5f5', fontFamily: 'Inter, sans-serif', lineHeight: 1.6, textAlign: 'center' }}>
              {t('tm.cancelled')}
            </p>
          </div>
        ) : (
        <MasaBlock
          key={activeItem?.meeting.id ?? tab}
          item={activeItem}
          locked={locked}
          cardType={CARD_TYPE[tab]}
          userInfo={userInfo}
          kanka={kanka}
        />
        )}
      </div>

      {/* Geçmiş Masalarım: masa kartı ve sohbetin altında */}
      <div>
        <div className="flex justify-center" style={{ marginBottom: 12 }}>
          <StdButton variant="ghost" type="button" onClick={() => setHistoryOpen(v => !v)} aria-expanded={historyOpen} style={{ flexShrink: 0 }}>
            {t('tm.history')}
          </StdButton>
        </div>
        {historyOpen && <HistoryList history={history} />}
      </div>
    </div>
  );
}

// Değerlendirme penceresi kapanışı (backend meeting-windows.ts reviewWindow ile aynı): açılıştan (buluşmanın ertesi günü 00:00 TR) 7 gün sonra
function reviewExpired(dateIso: string): boolean {
  return Date.now() > reviewClosesAt(dateIso).getTime();
}

// Küçük Değerlendir butonu (altın geçişli hap, GOLD_PILL)
const REVIEW_PILL: React.CSSProperties = { ...GOLD_PILL, minHeight: 28, padding: '0 12px', fontSize: 10.5 };

function HistoryList({ history }: { history: HistoryMeeting[] }) {
  const t = useTranslations();
  const locale = useLocale() as Lang;
  const [openId, setOpenId] = useState<string | null>(null);

  if (history.length === 0) {
    return <section className="ll-card" style={{ marginBottom: 16 }}><p style={{ margin: 0, fontSize: 13, color: '#a39c93' }}>{t('tm.noHistory')}</p></section>;
  }
  return (
    <div className="flex flex-col gap-3" style={{ marginBottom: 16 }}>
      {history.map((m) => {
        const isOpen = openId === m.id;
        const canReview = !m.isReviewed && !m.review && !reviewExpired(m.date);
        return (
          // Her geçmiş masa ayrı kart; açıkken yatay iç boşluk yok, masa detay kartı Masalarım'daki genişlikte
          <section key={m.id} className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="flex items-center justify-between gap-3" style={{ minHeight: 56, padding: '10px 12px 10px 18px' }}>
              <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.45, color: '#f4f1ec', minWidth: 0 }}>
                {`${fmtDate(m.date, locale)} - ${t(HISTORY_TYPE[m.type ?? 'GROUP'])}`}
              </span>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : m.id)}
                aria-expanded={isOpen}
                aria-label={isOpen ? t('tm.closeCard') : t('tm.openCard')}
                style={{ flexShrink: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <span style={{ width: 34, height: 34, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#f4f1ec', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>
            </div>
            {(canReview || m.review) && (
              <div style={{ padding: '0 18px 14px' }}>
                {canReview ? (
                  <a href={`/degerlendirme/${m.id}`} style={REVIEW_PILL}>{t('tm.review')}</a>
                ) : m.review && (
                  <>
                    {/* Gri etiket → verilen puan kadar yıldız → alt satırda yorum */}
                    <span className="ll-mono" style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 9999, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', fontSize: 10, color: '#a39c93' }}>{t('tm.yourReview')}</span>
                    <div role="img" aria-label={t('review.stars', { n: m.review.rating })} style={{ display: 'flex', gap: 2, marginTop: 6 }}>
                      {Array.from({ length: m.review.rating }).map((_, k) => <ReviewStar key={k} filled size={16} />)}
                    </div>
                    {m.review.comment && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#f4f1ec' }}>{m.review.comment}</p>}
                  </>
                )}
              </div>
            )}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="card"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <HistoryCard meeting={m} />
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}

// Salt görüntüleme: sohbet yok, yalnızca Haritada Gör çalışır
function HistoryCard({ meeting: m }: { meeting: HistoryMeeting }) {
  const t = useTranslations();
  const masa: MasaDetayData = {
    id: m.id,
    type: m.type,
    maxParticipants: m.maxParticipants,
    scheduledAt: m.date,
    sosEndsAt: m.date,
    venueName: m.venueName ?? 'Mekân bilgisi yok',
    venueAddress: m.venueAddress,
    venueDistrict: m.venueDistrict,
    venueMapsUrl: m.venueMapsUrl,
    venuePhotos: m.venuePhotos,
    participants: (m.participants ?? []).map((p) => ({ ...p, occupation: p.occupation ? occupationLabel(p.occupation, t) : null })),
    aiReport: m.aiReport,
  };
  return (
    <div>
      <MasaDetayKarti masa={masa} archive />
      {!!m.blocked?.length && (
        <div style={{ marginTop: 12, padding: '0 18px 12px' }}>
          <p className="ll-mono" style={{ margin: '0 0 4px', fontSize: 11, color: '#a39c93' }}>{t('tm.blocked')}</p>
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
