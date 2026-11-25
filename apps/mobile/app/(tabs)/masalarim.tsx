// Sekme 2 — Masalarım: apps/web/app/profil/tabs/TabMasalar.tsx (webdeki içerikle aynı; S-06)
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Reanimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { api } from '@/lib/api';
import { buildInitials, fmtDate, gColor, type DashboardItem, type MasaTuru } from '@/lib/masa';
import { WeeklySelectionModal } from '@/components/WeeklySelectionModal';
import { useMasaTabs } from '@/lib/useMasaTabs';
import { useKeyboardFieldScroll } from '@/lib/useKeyboardFieldScroll';
import { LiveTabs } from '@/components/LiveTabs';
import { KankaPairs } from '@/components/KankaPairs';
import { Star } from '@/components/Star';
import { GoldPill, MasaDetayKarti, type DetayParticipant, type MasaDetayData, type VenuePhoto } from '@/components/MasaDetayKarti';
import { ConfirmedRadarView } from '@/components/MasaBekleme';
import { InlineLH, StdButton, Card, Mono, SkeletonBlock, T, Title, Glow, ScreenGlow } from '@/components/ui';
import { c, ll, llColumn, masaKart, tw } from '@/theme/theme';
import { KycNoticeCard } from '@/components/KycNoticeCard';

import { formatDayTab, reviewClosesAt, weekdayName } from '@ahenk/shared';
import { currentLang } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
interface HistoryMeeting {
  id: string; date: string; type?: MasaTuru; venueName: string | null; cityName?: string | null; maxParticipants?: number;
  venueAddress?: string | null; venueDistrict?: string | null; venueMapsUrl?: string | null; venuePhotos?: VenuePhoto[];
  aiReport?: { content: string; uyumSkoru: number; generatedAt: string } | null;
  participants?: { initials: string; displayName?: string | null; gender: string | null; isSelf?: boolean; pair?: 'MINE' | 'OTHER'; photoUrl?: string | null; occupation?: string | null }[];
  review?: { rating: number; comment: string | null } | null; blocked?: { initials: string; gender: string | null }[]; isReviewed?: boolean;
}
interface UserInfo { firstName: string; lastName: string; gender?: string | null; photoUrl?: string | null }

// Çeviri anahtarları (ekranda t())
const CARD_TITLE: Record<MasaTuru, string> = { GROUP: 'tm.cardGroup', ONE_ON_ONE: 'tm.cardOne', KANKA: 'tm.cardKanka' };
const CARD_TYPE: Record<MasaTuru, 'group' | 'basbasa' | 'kanka'> = { GROUP: 'group', ONE_ON_ONE: 'basbasa', KANKA: 'kanka' };
const HISTORY_TYPE: Record<MasaTuru, string> = { GROUP: 'hero.group', ONE_ON_ONE: 'live.wsOneTitle', KANKA: 'hero.kanka' };

// Önizleme kartı (masa kurulmadan): gerçek MasaDetayKarti preview modunda, gerçek veri yok (web TabMasalar EmptyMasaCard ile aynı).
// Mekân adı yer tutucu, tarih satırında buluşma günü + 20:00; kullanıcının kendisi fotoğrafı ve adıyla, diğer yerler "?" cinsiyet
// renkli avatarla; sohbet pasif
function EmptyMasaCard({ cardType, userInfo, kanka }: { cardType: 'group' | 'basbasa' | 'kanka'; userInfo?: UserInfo; kanka?: { initials: string; gender: string | null } | null }) {
  const { t } = useTranslation();
  const first = userInfo?.firstName ?? '';
  const last = userInfo?.lastName ?? '';
  const initials = userInfo ? buildInitials(first, last) : '?';
  const ug = userInfo?.gender ?? 'MALE';
  const og = ug === 'FEMALE' ? 'MALE' : 'FEMALE';
  const self: DetayParticipant = { initials, gender: ug, isSelf: true, photoUrl: userInfo?.photoUrl ?? null, pair: 'MINE',
    displayName: last ? `${first} ${last[0].toLocaleUpperCase('tr-TR')}.` : first || initials };
  const empty = (gender: string, pair?: 'MINE' | 'OTHER'): DetayParticipant => ({ initials: '?', gender, displayName: '', ...(pair ? { pair } : {}) });
  const type: MasaTuru = cardType === 'basbasa' ? 'ONE_ON_ONE' : cardType === 'kanka' ? 'KANKA' : 'GROUP';
  const participants: DetayParticipant[] = cardType === 'basbasa'
    ? [self, empty(og)]
    : cardType === 'kanka'
      ? [self, kanka ? { ...kanka, displayName: '', pair: 'MINE' } : empty(ug, 'MINE'), empty(og, 'OTHER'), empty(og, 'OTHER')]
      : [self, empty(og), empty(ug), empty(og), empty(ug), empty(og)];
  const nowIso = new Date().toISOString();
  const masa: MasaDetayData = { id: `preview-${cardType}`, type, maxParticipants: participants.length, scheduledAt: nowIso, sosEndsAt: nowIso,
    venueName: t('tm.venueName'), venuePhotos: [], participants, aiReport: null };
  const dateLabel = `${weekdayName(cardType === 'basbasa' ? 6 : cardType === 'kanka' ? 0 : 5, currentLang())} 20:00`;
  return <MasaDetayKarti masa={masa} preview={{ dateLabel }} />;
}

function MasaBlock({ item, locked, cardType, userInfo, kanka, width }: {
  item?: DashboardItem; locked: boolean; cardType: 'group' | 'basbasa' | 'kanka'; userInfo?: UserInfo; kanka?: { initials: string; gender: string | null } | null; width: number;
}) {
  const { t } = useTranslation();
  const m = item?.meeting;
  if (locked || !m) return <EmptyMasaCard cardType={cardType} userInfo={userInfo} kanka={kanka} />;
  if (item.phase === 'REVEALED' && m.venueName) {
    const d: MasaDetayData = { id: m.id, type: m.type, maxParticipants: m.maxParticipants, scheduledAt: m.scheduledAt, sosEndsAt: m.sosEndsAt, venueName: m.venueName,
      venueAddress: m.venueAddress, venueDistrict: m.venueDistrict, venueMapsUrl: m.venueMapsUrl, venuePhotos: m.venuePhotos, participants: m.participants, aiReport: m.aiReport };
    // Kart kendi ana kartını ve alttaki ayrı kartı (acil yardım, sohbet, Değerlendir) çizer
    return <MasaDetayKarti masa={d} />;
  }
  if (m.participants.length > 0) {
    return (
      <Card>
        <ConfirmedRadarView width={width - 36} participants={m.participants} maxParticipants={m.maxParticipants} type={m.type} scheduledAt={m.scheduledAt}
          infoText={t('tm.infoText')} />
        {m.type === 'KANKA' && (
          <View style={{ marginTop: 16 }}>
            <KankaPairs mine={m.participants.filter(p => p.pair === 'MINE' && !p.cancelled)} other={m.participants.filter(p => p.pair === 'OTHER' && !p.cancelled)} />
          </View>
        )}
        {/* Seçim iptali ve buluşma türü değişikliği yalnız Eşleşme Paneli'ndeki seçim kartından yapılır */}
      </Card>
    );
  }
  return <EmptyMasaCard cardType={cardType} userInfo={userInfo} kanka={kanka} />;
}

// Değerlendirme penceresi kapanışı (backend meeting-windows.ts reviewWindow ile aynı): açılıştan (buluşmanın ertesi günü 00:00 TR) 7 gün sonra
function reviewExpired(dateIso: string): boolean {
  return Date.now() > reviewClosesAt(dateIso).getTime();
}

function HistoryListInner({ history }: { history: HistoryMeeting[] }) {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);
  if (history.length === 0) return <Card style={{ marginBottom: 16 }}><T style={{ fontSize: 13, color: ll.label }}>{t('tm.noHistory')}</T></Card>;
  return (
    <View style={{ marginBottom: 16, gap: 12 }}>
      {history.map((m) => (
        <HistoryItem key={m.id} m={m} open={openId === m.id} onToggle={() => setOpenId(openId === m.id ? null : m.id)} />
      ))}
    </View>
  );
}

// Her geçmiş masa ayrı kart; açıkken yatay iç boşluk yok, masa detay kartı Masalarım'daki genişlikte
function HistoryItem({ m, open, onToggle }: { m: HistoryMeeting; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const hc = masaKart.historyChevron;
  const rot = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(rot, { toValue: open ? 1 : 0, duration: hc.ms, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [open, rot, hc.ms]);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const canReview = !m.isReviewed && !m.review && !reviewExpired(m.date);
  const masa: MasaDetayData = { id: m.id, type: m.type, maxParticipants: m.maxParticipants, scheduledAt: m.date, sosEndsAt: m.date, venueName: m.venueName ?? t('masa.noVenue'),
    venueAddress: m.venueAddress, venueDistrict: m.venueDistrict, venueMapsUrl: m.venueMapsUrl, venuePhotos: m.venuePhotos, participants: m.participants ?? [], aiReport: m.aiReport };
  return (
    <Reanimated.View layout={LinearTransition.duration(hc.ms)}>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: masaKart.historyRow.minH, paddingVertical: 10, paddingLeft: 18, paddingRight: 12 }}>
          <T w={500} style={{ flex: 1, fontSize: masaKart.historyRow.fontSize, lineHeight: masaKart.historyRow.lineHeight, color: ll.text }}>{`${fmtDate(m.date)} - ${t(HISTORY_TYPE[m.type ?? 'GROUP'])}`}</T>
          <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={open ? t('tm.closeCard') : t('tm.openCard')} accessibilityState={{ expanded: open }}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ width: hc.size, height: hc.size, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', backgroundColor: hc.bg, borderWidth: 1, borderColor: hc.border, transform: [{ rotate }] }}>
              <Svg width={hc.icon} height={hc.icon} viewBox="0 0 24 24" fill="none" stroke={ll.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M6 9l6 6 6-6" />
              </Svg>
            </Animated.View>
          </Pressable>
        </View>
        {(canReview || !!m.review) && (
          <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
            {canReview ? (
              <View style={{ alignItems: 'flex-start' }}><GoldPill small label={t('tm.review')} onPress={() => router.push(`/degerlendirme/${m.id}`)} /></View>
            ) : m.review && (
              // [Gri etiket + sağında verilen puan kadar yıldız] → alt satırda yorum (web TabMasalar ile aynı)
              <View style={{ alignItems: 'flex-start' }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <View style={{ paddingVertical: 2, paddingHorizontal: 8, borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
                    <Mono style={{ fontSize: 10, color: ll.label }}>{t('tm.yourReview')}</Mono>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 2 }} accessible accessibilityRole="image" accessibilityLabel={t('review.stars', { n: m.review.rating })}>
                    {Array.from({ length: m.review.rating }).map((_, k) => <Star key={k} filled size={16} />)}
                  </View>
                </View>
                {!!m.review.comment && <T style={{ marginTop: 6, fontSize: 13, color: ll.text }}>{m.review.comment}</T>}
              </View>
            )}
          </View>
        )}
        {open && (
          <Reanimated.View entering={FadeIn.duration(hc.ms)} exiting={FadeOut.duration(hc.ms)}>
            <MasaDetayKarti masa={masa} archive />
            {!!m.blocked?.length && (
              <View style={{ marginTop: 12, paddingHorizontal: 18, paddingBottom: 12 }}>
                <Mono style={{ marginBottom: 4, fontSize: 11, color: ll.label }}>{t('tm.blocked')}</Mono>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {m.blocked.map((b, j) => <Mono key={`${b.initials}-${j}`} w={600} style={{ fontSize: 14, color: gColor(b.gender) }}>{b.initials}</Mono>)}
                </View>
              </View>
            )}
          </Reanimated.View>
        )}
      </Card>
    </Reanimated.View>
  );
}

export default function Masalarim() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { ready, me, items, kanka, tab, tabItem, selectTab, statuses, tabAdminCancelled, selection, submitSelection } = useMasaTabs();
  const [history, setHistory] = useState<HistoryMeeting[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dateId, setDateId] = useState<string | null>(null); // Seçili tarih sekmesindeki masa
  // Klavye açılınca odaklı alan (sohbet yazı alanı) klavyenin üstünde kalır; son mesajlar sohbet listesinde en altta
  const kb = useKeyboardFieldScroll();

  useEffect(() => { api.get<HistoryMeeting[]>('/meetings/my-history').then(h => setHistory(Array.isArray(h) ? h : [])).catch(() => {}); }, []);

  const colW = Math.min(width, llColumn.maxWidth) - 32;
  const userInfo = me ? { firstName: me.firstName, lastName: me.lastName, gender: me.profile?.gender, photoUrl: me.profilePhotoUrl } : undefined;
  const locked = Object.values(statuses).every(s => s === 'NONE');
  // Aktif kaydı (taramada ya da masası kuruluyor) olan kullanıcıya Masalarım'da seçim penceresi açılmaz
  const hasActiveSelection = !!selection?.options.some(o => o.selection || (o.seated && !o.locked));
  // Farklı günlerde birden fazla aktif masa: üstte tarih sekmeleri (aynı güne tek masa olabilir; sekme o masanın türünü seçer)
  const dated = [...items].sort((a, b) => a.meeting.scheduledAt.localeCompare(b.meeting.scheduledAt));
  const dayOf = (iso: string) => formatDayTab(iso, currentLang());
  const showDates = new Set(dated.map((i) => dayOf(i.meeting.scheduledAt))).size > 1;
  const activeItem = (dateId ? items.find((i) => i.meeting.id === dateId && i.meeting.type === tab) : undefined) ?? tabItem;

  return (
    <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden' }}>
      <ScreenGlow />
      {!hasActiveSelection && <WeeklySelectionModal selection={selection} onSubmit={submitSelection} />}
      <ScrollView ref={kb.ref} onScroll={kb.onScroll} scrollEventThrottle={kb.scrollEventThrottle} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: 32, gap: 24, maxWidth: 896, width: '100%', alignSelf: 'center' }}>
        <Glow />
        {/* Grup / Baş Başa / Kankamla halkaları Eşleşme Paneli'ndekiyle aynı yükseklikte: üst boşluk yalnız durum çubuğu kadar;
            KYC kartı görünürken Eşleşme Paneli'ndeki gibi üstte ve altta 16 boşluk */}
        <View>
          {me?.kyc?.status !== 'APPROVED' && <View style={{ marginTop: 16, marginBottom: 16 }}><KycNoticeCard /></View>}
          {ready && showDates && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
              {dated.map((i) => {
                const on = activeItem?.meeting.id === i.meeting.id;
                return <StdButton variant={on ? 'primary' : 'ghost'} key={i.meeting.id} label={dayOf(i.meeting.scheduledAt)} accessibilityState={{ selected: on }}
                  onPress={() => { setDateId(i.meeting.id); selectTab(i.meeting.type ?? 'GROUP'); }} />;
              })}
            </ScrollView>
          )}
          {!ready ? <SkeletonBlock lines={5} /> : <LiveTabs tab={tab} statuses={statuses} onTab={selectTab} noRings />}
        </View>
        {ready && (
          <>
            {locked && (
              <View style={{ backgroundColor: 'rgba(192,57,43,0.08)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.25)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
                <T style={{ color: 'rgba(192,57,43,0.85)', fontSize: 11, lineHeight: 16.5 }}>{t('tm.preview')}</T>
              </View>
            )}
            {locked && <StdButton variant="primary" label={t('pkg.buy')} full onPress={() => router.navigate('/(tabs)/paketim')} />}
            <View>
              {/* Türe göre başlık, ortalı */}
              <Title style={{ textAlign: 'center', marginBottom: 12 }}>{locked ? t('tm.cardDetail') : t(CARD_TITLE[tab])}</Title>
              {tab === 'KANKA' && !activeItem && statuses.KANKA === 'SCANNING' && (
                <T style={{ marginBottom: 12, fontSize: 13, color: ll.text2, lineHeight: 20.8 }}>
                  {t('tm.kankaScanning')}
                </T>
              )}
              {tabAdminCancelled ? (
                <Card><T style={{ fontSize: 14, lineHeight: 22.4, textAlign: 'center', color: tw.text }}>{t('tm.cancelled')}</T></Card>
              ) : (
                <MasaBlock key={activeItem?.meeting.id ?? tab} item={activeItem} locked={locked} cardType={CARD_TYPE[tab]} userInfo={userInfo} kanka={kanka} width={colW} />
              )}
            </View>
            {/* Geçmiş Masalarım: masa kartı ve sohbetin altında */}
            <View>
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <StdButton variant="ghost" label={t('tm.history')} onPress={() => setHistoryOpen(v => !v)} accessibilityState={{ expanded: historyOpen }} />
              </View>
              {historyOpen && <HistoryList history={history} />}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Web karşılığı yalnız satır içi stil: satır yüksekliği her boyutta 1.5×

// Web karşılığı yalnız satır içi stil: satır yüksekliği her boyutta 1.5×
function HistoryList(props: React.ComponentProps<typeof HistoryListInner>) { return <InlineLH><HistoryListInner {...props} /></InlineLH>; }
