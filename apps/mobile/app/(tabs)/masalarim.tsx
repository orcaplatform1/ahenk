// Sekme 2 — Masalarım: apps/web/app/profil/tabs/TabMasalar.tsx (webdeki içerikle aynı; S-06)
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import Reanimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/venueApi';
import { buildInitials, fmtDate, gColor, type DashboardItem, type MasaTuru } from '@/lib/masa';
import { WeeklySelectionModal } from '@/components/WeeklySelectionModal';
import { useMasaTabs } from '@/lib/useMasaTabs';
import { useKeyboardFieldScroll } from '@/lib/useKeyboardFieldScroll';
import { LiveTabs } from '@/components/LiveTabs';
import { KankaPairs } from '@/components/KankaPairs';
import { DetayAvatar } from '@/components/DetayAvatar';
import { Star } from '@/components/Star';
import { GoldPill, MasaDetayKarti, type MasaDetayData, type VenuePhoto } from '@/components/MasaDetayKarti';
import { ConfirmedRadarView } from '@/components/MasaBekleme';
import { InlineLH, StdButton, Card, Mono, Serif, SkeletonBlock, T, Title, Glow, ScreenGlow } from '@/components/ui';
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
interface UserInfo { firstName: string; lastName: string; gender?: string | null }

// Çeviri anahtarları (ekranda t())
const CARD_TITLE: Record<MasaTuru, string> = { GROUP: 'tm.cardGroup', ONE_ON_ONE: 'tm.cardOne', KANKA: 'tm.cardKanka' };
const CARD_TYPE: Record<MasaTuru, 'group' | 'basbasa' | 'kanka'> = { GROUP: 'group', ONE_ON_ONE: 'basbasa', KANKA: 'kanka' };
const HISTORY_TYPE: Record<MasaTuru, string> = { GROUP: 'hero.group', ONE_ON_ONE: 'live.wsOneTitle', KANKA: 'hero.kanka' };

// framer-motion giriş animasyonları (web EmptyMasaCard): opaklık 0 → 1, y → 0; varsayılan eğri "ease"
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
function FadeUp({ delay = 0, dy = 6, duration = 400, fromOpacity = 0, style, children }: { delay?: number; dy?: number; duration?: number; fromOpacity?: number; style?: ViewStyle; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, delay, duration, easing: EASE, useNativeDriver: true }).start(); }, [v, delay, duration]);
  return <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [fromOpacity, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }] }]}>{children}</Animated.View>;
}
// Parlama: linear-gradient(105deg, şeffaf %30, rgba(39,174,96,.15) %50, şeffaf %70); x -100% → 200%, opaklık 0,6 → 0, 1 sn easeOut, 0,1 sn gecikme
function Shimmer() {
  const v = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  useEffect(() => { if (w) Animated.timing(v, { toValue: 1, delay: 100, duration: 1000, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(); }, [v, w]);
  return (
    <View pointerEvents="none" onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[StyleSheet.absoluteFill, { zIndex: 10 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-w, 2 * w] }) }] }]}>
        <LinearGradient colors={['rgba(39,174,96,0)', 'rgba(39,174,96,0.15)', 'rgba(39,174,96,0)']} locations={[0.3, 0.5, 0.7]} start={{ x: 0, y: 0.37 }} end={{ x: 1, y: 0.63 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}
// Kilit simgesi: lockShake 0,8 sn ease-in-out sonsuz (0 → -3 → 0 → 3 → 0 px)
function LockShake({ inline }: { inline?: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const e = Easing.bezier(0.42, 0, 0.58, 1);
    const step = (to: number) => Animated.timing(v, { toValue: to, duration: 200, easing: e, useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([step(-3), step(0), step(3), step(0)]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.Image source={require('@/assets/lock-icon.webp')} style={{ ...(inline ? {} : { position: 'absolute' as const, top: 16, right: 16 }), zIndex: 2, width: 56, height: 56, opacity: 0.85, transform: [{ translateX: v }] }} />;
}

// Ön izleme kartı: MasaDetayKarti yeni düzeninin mock hali (kapak, tarih satırı + Haritada Gör, katılımcılar, alt kart) — web EmptyMasaCard ile aynı

// photo: masaya bağlı mekânın güncel ilk fotoğrafı (sunucudan geldiyse)
function EmptyMasaCardInner({ locked, cardType, userInfo, kanka, photo }: { locked: boolean; cardType: 'group' | 'basbasa' | 'kanka'; userInfo?: UserInfo; kanka?: { initials: string; gender: string | null } | null; photo?: VenuePhoto | null }) {
  const { t } = useTranslation();
  const initials = userInfo ? buildInitials(userInfo.firstName, userInfo.lastName) : '?';
  const ug = userInfo?.gender ?? null;
  const og = ug === 'FEMALE' ? 'MALE' : 'FEMALE';
  const ps = cardType === 'basbasa'
    ? [{ initials, gender: ug }, { initials: '?', gender: og }]
    : [{ initials, gender: ug ?? 'MALE' }, { initials: '?', gender: og }, { initials: '?', gender: ug ?? 'MALE' }, { initials: '?', gender: og }, { initials: '?', gender: ug ?? 'MALE' }, { initials: '?', gender: og }];
  return (
    <View>
      {/* ── Ana kart ── */}
      <Card style={{ padding: 0, overflow: 'hidden', backgroundColor: tw.bg }}>
        <FadeUp dy={10} duration={500} style={{ overflow: 'hidden' }}>
          <Shimmer />
          {/* Kapak: mekânın güncel ilk fotoğrafı tam genişlikte 16:9 (cover); fotoğraf yoksa fotoğraf alanı yok, masa türü ve mekân adı
              normal akışta (MasaDetayKarti ile aynı) */}
          <View style={photo ? { aspectRatio: masaKart.coverAspect } : { gap: 12, paddingTop: 12, paddingHorizontal: 14 }}>
            {photo && (
              <>
                <Image source={{ uri: mediaUrl(photo.url) }} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityLabel={photo.caption ?? t('masa.photoAlt', { n: 1 })} />
                <LinearGradient pointerEvents="none" colors={masaKart.coverFade} locations={masaKart.coverFadeStops} style={StyleSheet.absoluteFill} />
              </>
            )}
            {/* Üst satır: sağda kilit (fotoğraf varken kapak üstünde) */}
            {locked && !photo && <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><LockShake inline /></View>}
            {locked && photo && <LockShake />}
            {/* Alt: mekân adı + konum */}
            <View style={[photo ? { position: 'absolute', left: 14, right: 14, bottom: 12 } : null, { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Serif style={{ fontSize: 24, lineHeight: 28.8, color: tw.text, letterSpacing: 0.24 }}>{t('tm.venueName')}</Serif>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={tw.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" /><Circle cx={12} cy={10} r={2.5} />
                  </Svg>
                  <T style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>İstanbul</T>
                </View>
              </View>
            </View>
          </View>

          <View style={{ padding: 18 }}>
            <FadeUp delay={100} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.green }} />
              <T w={700} style={{ fontSize: 10, color: c.green, letterSpacing: 1.8 }}>{t('masa.detailTitle')}</T>
            </FadeUp>
            {/* Tarih satırı: buluşma günü/saati, sağında Haritada Gör (pasif) */}
            <FadeUp delay={400} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: masaKart.strip.padV, paddingHorizontal: masaKart.strip.padH,
              borderRadius: masaKart.strip.radius, backgroundColor: masaKart.strip.bg, borderWidth: 1, borderColor: masaKart.strip.border, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={masaKart.strip.icon} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Rect x={3} y={5} width={18} height={16} rx={2} /><Path d="M16 3v4M8 3v4M3 10h18" />
                </Svg>
                <View>
                  <T style={{ fontSize: 11, lineHeight: 14.3, color: c.t888 }}>{t('masa.meetup')}</T>
                  <T w={700} style={{ fontSize: 15, lineHeight: 18 }}>{`${weekdayName(cardType === 'basbasa' ? 6 : cardType === 'kanka' ? 0 : 5, currentLang())}, 20:00`}</T>
                </View>
              </View>
              <View style={{ minHeight: masaKart.mapBtn.minH, justifyContent: 'center', paddingHorizontal: masaKart.mapBtn.padH, borderRadius: masaKart.mapBtn.radius, backgroundColor: masaKart.mapBtn.bg, opacity: 0.5 }}
                accessibilityRole="button" accessibilityState={{ disabled: true }}>
                <T w={700} style={{ fontSize: masaKart.mapBtn.fontSize, color: masaKart.mapBtn.text, letterSpacing: 0.66 }}>{t('masa.seeOnMap')}</T>
              </View>
            </FadeUp>

            {/* Katılımcılar */}
            <FadeUp delay={480} style={{ marginBottom: 20 }}>
              <T w={700} style={{ fontSize: 9, color: c.t555, letterSpacing: 1.26, marginBottom: 12 }}>{cardType === 'basbasa' ? t('masa.oneOnOne') : t('masa.participants')}</T>
              {cardType === 'kanka' ? (
                <KankaPairs mine={[{ initials, gender: ug, isSelf: true }, ...(kanka ? [kanka] : [])]} other={[]} />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: masaKart.avatarGap - 8 }}>
                  {ps.map((p, i) => (
                    <View key={i} style={{ padding: 4 }}>
                      <DetayAvatar participant={p} delay={0.52 + i * 0.1} size={masaKart.avatar} />
                    </View>
                  ))}
                </ScrollView>
              )}
            </FadeUp>

            {/* Yapay Zeka Masa Raporu: boş halka "%—" + bilgi metni */}
            <FadeUp delay={600} style={{ backgroundColor: c.aiBg, borderWidth: 1, borderColor: c.aiBorder, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: c.aiIconBg, borderWidth: 1, borderColor: c.aiIconBorder, alignItems: 'center', justifyContent: 'center' }}><T style={{ fontSize: 16, lineHeight: 16 }}>✦</T></View>
                <T w={700} style={{ fontSize: 10, letterSpacing: 1.6, color: c.aiTitle }}>{t('masa.aiTitle')}</T>
              </View>
              <View style={{ height: 1, backgroundColor: c.aiDivider, marginBottom: 12 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                <View style={{ width: masaKart.ring.d, height: masaKart.ring.d }}>
                  <Svg width={masaKart.ring.d} height={masaKart.ring.d} viewBox={`0 0 ${masaKart.ring.d} ${masaKart.ring.d}`}>
                    <Circle cx={masaKart.ring.d / 2} cy={masaKart.ring.d / 2} r={(masaKart.ring.d - masaKart.ring.stroke) / 2} fill="none" stroke={masaKart.ring.track} strokeWidth={masaKart.ring.stroke} />
                  </Svg>
                  <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                    <T w={700} style={{ fontSize: 15, color: c.tF0 }}>%—</T>
                  </View>
                </View>
                <T w={600} style={{ fontSize: 10, letterSpacing: 1.2, color: 'rgba(255,255,255,0.88)' }}>{t('masa.aiScore')}</T>
              </View>
              <T style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', lineHeight: 21.45 }}>{t('tm.meetupNote')}</T>
            </FadeUp>
          </View>
        </FadeUp>
      </Card>

      {/* ── Alt kart: sohbet ── */}
      <Card style={{ marginTop: masaKart.cardGap }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.t555 }} />
            <T w={700} style={{ fontSize: 10, letterSpacing: 1.4, color: c.t555 }}>{t('masa.chatTitle')}</T>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
            <View style={{ paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center' }}><T style={{ fontSize: 12, lineHeight: 18, textAlign: 'center' }}>{t('masa.noMessages')}</T></View>
            <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)' }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }} />
              <StdButton variant="primary" label={t('masa.send')} disabled />
            </View>
          </View>
        </View>
      </Card>
    </View>
  );
}

function MasaBlock({ item, locked, cardType, userInfo, kanka, width }: {
  item?: DashboardItem; locked: boolean; cardType: 'group' | 'basbasa' | 'kanka'; userInfo?: UserInfo; kanka?: { initials: string; gender: string | null } | null; width: number;
}) {
  const { t } = useTranslation();
  const m = item?.meeting;
  if (locked || !m) return <EmptyMasaCard locked={locked} cardType={cardType} userInfo={userInfo} kanka={kanka} photo={m?.venuePhotos?.[0]} />;
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
  return <EmptyMasaCard locked={false} cardType={cardType} userInfo={userInfo} kanka={kanka} photo={m.venuePhotos?.[0]} />;
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
          <T w={500} style={{ flex: 1, fontSize: masaKart.historyRow.fontSize, lineHeight: masaKart.historyRow.lineHeight, color: ll.text }}>{[fmtDate(m.date), t(HISTORY_TYPE[m.type ?? 'GROUP']), m.venueName, m.cityName].filter(Boolean).join(' - ')}</T>
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
              // Verilen puan kadar dolu yıldız · not
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 4 }}>
                <T w={600} style={{ fontSize: 13, color: ll.text }}>{t('tm.reviewLabel')}</T>
                <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={t('review.stars', { n: m.review.rating })}>
                  {Array.from({ length: m.review.rating }).map((_, k) => <Star key={k} filled size={16} />)}
                </View>
                {!!m.review.comment && <T style={{ fontSize: 13, color: ll.text }}>· {m.review.comment}</T>}
              </View>
            )}
          </View>
        )}
        {open && (
          <Reanimated.View entering={FadeIn.duration(hc.ms)} exiting={FadeOut.duration(hc.ms)} style={{ paddingBottom: 12 }}>
            <MasaDetayKarti masa={masa} archive />
            {!!m.blocked?.length && (
              <View style={{ marginTop: 12, paddingHorizontal: 18 }}>
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
  const userInfo = me ? { firstName: me.firstName, lastName: me.lastName, gender: me.profile?.gender } : undefined;
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
function EmptyMasaCard(props: React.ComponentProps<typeof EmptyMasaCardInner>) { return <InlineLH><EmptyMasaCardInner {...props} /></InlineLH>; }

// Web karşılığı yalnız satır içi stil: satır yüksekliği her boyutta 1.5×
function HistoryList(props: React.ComponentProps<typeof HistoryListInner>) { return <InlineLH><HistoryListInner {...props} /></InlineLH>; }
