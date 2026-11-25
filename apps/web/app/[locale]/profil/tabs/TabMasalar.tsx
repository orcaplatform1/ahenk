'use client';

import React, { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDayTab, formatNamed, occupationLabel, reviewClosesAt, type Lang } from '@ahenk/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { api, API_PREFIX } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { ConfirmedRadarView, GOLD_PILL, KankaPairs, MasaDetayKarti, gColor, type DashboardItem, type MasaDetayData, type MasaTuru, type VenuePhoto, StdButton } from '@ahenk/ui';
import LiveTabs from '@/components/live/LiveTabs';
import { useMasaTabs } from '@/components/live/useMasaTabs';
import WeeklySelectionModal from '@/components/live/WeeklySelectionModal';
import { ReviewStar } from '@/components/ReviewStar';
import type { KankaInfo } from '@/components/live/useMasaTabs';

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
  photoUrl?: string | null; // Onaylı profil fotoğrafı (önizleme kartında kullanıcının kendisi)
  occupationSector?: string | null; // Meslek (önizleme kartında kullanıcının adının altında)
}

function fmtDate(val: string, locale: Lang = 'tr') {
  return formatNamed(val, locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ── Önizleme kartı (masa kurulmadan): gerçek MasaDetayKarti preview modunda, gerçek veri yok. Kapakta varsayılan mekân görseli
   (/share-bg/datenight.webp) ve yalnız konum ikonu, masa kilitliyken sallanan kilit; mekân adı yer tutucu; tarih satırında buluşma
   günü + 20:00 ve pasif Haritada Gör. Katılımcılar kullanıcının cinsiyetine göre: Baş Başa solda kendisi, sağda karşı cins "?";
   Grup sol sütunda kendisi + 2 aynı cins "?", sağ sütunda 3 karşı cins "?"; Kankamla üst satırda kendisi ve kankası (fotoğraf + ad),
   alt satırda 2 karşı cins "?". Sohbet pasif ── */
function EmptyMasaCard({
  locked,
  cardType,
  userInfo,
  kanka,
}: {
  locked: boolean;
  cardType: 'group' | 'basbasa' | 'kanka';
  userInfo?: UserInfo;
  kanka?: KankaInfo | null;
}) {
  const t = useTranslations();
  const locale = useLocale() as Lang;
  const first = userInfo?.firstName ?? '';
  const last = userInfo?.lastName ?? '';
  const initials = userInfo ? `${(first[0] ?? '?').toUpperCase()}.${(last[0] ?? '?').toUpperCase()}.` : '?';
  const uGender = userInfo?.gender ?? 'MALE';
  const oppGender = uGender === 'FEMALE' ? 'MALE' : 'FEMALE';
  const self: MasaDetayData['participants'][number] = {
    initials, gender: uGender, isSelf: true, photoUrl: userInfo?.photoUrl ?? null,
    displayName: last ? `${first} ${last[0].toLocaleUpperCase('tr-TR')}.` : first || initials,
    occupation: userInfo?.occupationSector ? occupationLabel(userInfo.occupationSector, t) : null,
  };
  const empty = (gender: string) => ({ initials: '?', gender, displayName: '' });
  const type: MasaTuru = cardType === 'basbasa' ? 'ONE_ON_ONE' : cardType === 'kanka' ? 'KANKA' : 'GROUP';
  // Satır satır sıra (önizlemede satırda 2 kişi, verilen sırayla): sol sütun kullanıcının cinsiyeti
  const participants = cardType === 'basbasa'
    ? [self, empty(oppGender)]
    : cardType === 'kanka'
      ? [self, kanka ? { initials: kanka.initials, gender: kanka.gender, displayName: kanka.displayName ?? '', photoUrl: kanka.photoUrl ?? null } : empty(uGender), empty(oppGender), empty(oppGender)]
      : [self, empty(oppGender), empty(uGender), empty(oppGender), empty(uGender), empty(oppGender)];
  const masa: MasaDetayData = {
    id: `preview-${cardType}`,
    type,
    maxParticipants: participants.length,
    scheduledAt: new Date().toISOString(),
    sosEndsAt: new Date().toISOString(),
    venueName: t('tm.venueName'),
    venuePhotos: [{ url: '/share-bg/datenight.webp' }],
    participants,
    aiReport: null,
  };
  // Tarih satırında tüm masa türlerinde sabit yer tutucu ("Gün & Saat")
  return <MasaDetayKarti masa={masa} preview={{ dateLabel: t('masa.previewDate'), locked }} />;
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
  kanka?: KankaInfo | null;
}) {
  const t = useTranslations();
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
            {/* Kullanıcı ve kankası masa kurulana kadar da fotoğraf + "Ahmet Y." ile görünür (showMine) */}
            <KankaPairs
              mine={meeting.participants.filter(p => p.pair === 'MINE' && !p.cancelled).map(p => (p.isSelf
                ? { ...p, photoUrl: userInfo?.photoUrl ?? null, displayName: userInfo ? (userInfo.lastName ? `${userInfo.firstName} ${userInfo.lastName[0].toLocaleUpperCase('tr-TR')}.` : userInfo.firstName) : p.displayName }
                : { ...p, photoUrl: kanka?.photoUrl ?? null, displayName: kanka?.displayName ?? p.displayName }))}
              other={meeting.participants.filter(p => p.pair === 'OTHER' && !p.cancelled)}
              showMine
            />
          </div>
        )}
        {/* Seçim iptali ve buluşma türü değişikliği yalnız Eşleşme Paneli'ndeki seçim kartından yapılır */}
      </div>
    );
  } else {
    content = <EmptyMasaCard locked={false} cardType={cardType} userInfo={userInfo} kanka={kanka} />;
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
                    {/* [Gri etiket + sağında verilen puan kadar yıldız] → alt satırda yorum */}
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <span className="ll-mono" style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 9999, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', fontSize: 10, color: '#a39c93' }}>{t('tm.yourReview')}</span>
                      <div role="img" aria-label={t('review.stars', { n: m.review.rating })} style={{ display: 'flex', gap: 2 }}>
                        {Array.from({ length: m.review.rating }).map((_, k) => <ReviewStar key={k} filled size={16} />)}
                      </div>
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
