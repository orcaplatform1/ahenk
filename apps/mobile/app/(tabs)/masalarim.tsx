// Sekme 2 — Masalarım: apps/web/app/profil/tabs/TabMasalar.tsx (webdeki içerikle aynı; S-06)
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/venueApi';
import { buildInitials, fmtDate, gColor, type DashboardItem, type MasaTuru } from '@/lib/masa';
import { WeeklySelectionModal } from '@/components/WeeklySelectionModal';
import { useMasaTabs } from '@/lib/useMasaTabs';
import { LiveTabs } from '@/components/LiveTabs';
import { KankaPairs } from '@/components/KankaPairs';
import { DetayAvatar } from '@/components/DetayAvatar';
import { Star } from '@/components/Star';
import { MasaDetayKarti, type MasaDetayData, type VenuePhoto } from '@/components/MasaDetayKarti';
import { ConfirmedRadarView } from '@/components/MasaBekleme';
import { InlineLH, Btn, BtnGhost, BtnPrimary, Card, Head, Mono, Serif, SkeletonBlock, T, Glow, ScreenGlow } from '@/components/ui';
import { c, ll, llColumn, masaKart, tw } from '@/theme/theme';
import { KycNoticeCard } from '@/components/KycNoticeCard';

import { weekdayName } from '@ahenk/shared';
import { currentLang } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
interface HistoryMeeting {
  id: string; date: string; type?: MasaTuru; venueName: string | null; cityName?: string | null; maxParticipants?: number;
  venueAddress?: string | null; venueDistrict?: string | null; venueMapsUrl?: string | null; venuePhotos?: VenuePhoto[];
  aiReport?: { content: string; uyumSkoru: number; generatedAt: string } | null;
  participants?: { initials: string; displayName?: string | null; gender: string | null; isSelf?: boolean; pair?: 'MINE' | 'OTHER'; photoUrl?: string | null }[];
  occupations?: string[];
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

// Ön izleme kartı: MasaDetayKarti yeni düzeninin mock hali (kapak, masa türü rozeti, bilgi şeridi, katılımcılar, alt kart) — web EmptyMasaCard ile aynı
const CARD_TYPE_LABEL: Record<'group' | 'basbasa' | 'kanka', string> = { group: 'masa.typeGroup', basbasa: 'masa.typeOne', kanka: 'masa.typeKanka' };

// photo: masaya bağlı mekânın güncel ilk fotoğrafı (sunucudan geldiyse)
function EmptyMasaCardInner({ locked, cardType, userInfo, kanka, scrollRef, photo }: { locked: boolean; cardType: 'group' | 'basbasa' | 'kanka'; userInfo?: UserInfo; kanka?: { initials: string; gender: string | null } | null; scrollRef?: React.RefObject<ScrollViewInstance | null>; photo?: VenuePhoto | null }) {
  const { t } = useTranslation();
  const chatRef = useRef<React.ComponentRef<typeof View>>(null);
  const initials = userInfo ? buildInitials(userInfo.firstName, userInfo.lastName) : '?';
  const ug = userInfo?.gender ?? null;
  const og = ug === 'FEMALE' ? 'MALE' : 'FEMALE';
  const ps = cardType === 'basbasa'
    ? [{ initials, gender: ug }, { initials: '?', gender: og }]
    : [{ initials, gender: ug ?? 'MALE' }, { initials: '?', gender: og }, { initials: '?', gender: ug ?? 'MALE' }, { initials: '?', gender: og }, { initials: '?', gender: ug ?? 'MALE' }, { initials: '?', gender: og }];
  // Bilgi şeridi: ön izlemedeki yuva sayısı (grup 6, baş başa 2, Kankamla 4), kadın/erkek yarı yarıya
  const seats = cardType === 'basbasa' ? 2 : cardType === 'kanka' ? 4 : 6;
  function scrollToChat() {
    const sv = scrollRef?.current;
    const inner = sv?.getInnerViewRef?.();
    if (!sv || !inner || !chatRef.current) return;
    chatRef.current.measureLayout(inner, (_x: number, y: number) => sv.scrollTo({ y: Math.max(0, y - 16), animated: true }), () => undefined);
  }
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
            {/* Üst satır: solda masa türü, sağda kilit (fotoğraf varken kapak üstünde) */}
            <View style={photo ? null : { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <View style={[{ paddingVertical: masaKart.pill.padV, paddingHorizontal: masaKart.pill.padH, borderRadius: masaKart.pill.radius,
                backgroundColor: masaKart.typePill.bg, borderWidth: 1, borderColor: masaKart.typePill.border }, photo ? { position: 'absolute', top: 12, left: 12 } : { alignSelf: 'flex-start' }]}>
                <T w={700} style={{ fontSize: masaKart.pill.fontSize, color: masaKart.typePill.text, letterSpacing: 0.44 }}>{t(CARD_TYPE_LABEL[cardType])}</T>
              </View>
              {locked && !photo && <LockShake inline />}
            </View>
            {locked && photo && <LockShake />}
            {/* Alt: mekân adı + konum, sağda Haritada Gör (pasif) */}
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
              <View style={{ minHeight: masaKart.mapBtn.minH, justifyContent: 'center', paddingHorizontal: masaKart.mapBtn.padH, borderRadius: masaKart.mapBtn.radius, backgroundColor: masaKart.mapBtn.bg, opacity: 0.5 }}
                accessibilityRole="button" accessibilityState={{ disabled: true }}>
                <T w={700} style={{ fontSize: masaKart.mapBtn.fontSize, color: masaKart.mapBtn.text, letterSpacing: 0.66 }}>{t('masa.seeOnMap')}</T>
              </View>
            </View>
          </View>

          <View style={{ padding: 18 }}>
            <FadeUp delay={100} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.green }} />
              <T w={700} style={{ fontSize: 10, color: c.green, letterSpacing: 1.8 }}>{t('masa.detailTitle')}</T>
            </FadeUp>
            {/* Bilgi şeridi: buluşma günü/saati + kişi sayısı */}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={masaKart.strip.icon} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Circle cx={9} cy={8} r={3.5} /><Path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><Path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2c2.1.7 3.5 2.8 3.5 5.8" />
                </Svg>
                <View style={{ alignItems: 'flex-end' }}>
                  <T w={700} style={{ fontSize: 14, lineHeight: 16.8 }}>{t('masa.peopleCount', { n: seats })}</T>
                  <T style={{ fontSize: 11, lineHeight: 14.3, color: 'rgba(255,255,255,0.6)' }}>{t('masa.genderCount', { f: seats / 2, m: seats / 2 })}</T>
                </View>
              </View>
            </FadeUp>

            {/* Katılımcılar + Masa Sohbeti */}
            <FadeUp delay={480} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                <T w={700} style={{ fontSize: 9, color: c.t555, letterSpacing: 1.26, flexShrink: 1 }}>{cardType === 'basbasa' ? t('masa.oneOnOne') : t('masa.participants')}</T>
                <Pressable onPress={scrollToChat} accessibilityRole="button" hitSlop={6}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: masaKart.chatBtn.minH, paddingHorizontal: masaKart.chatBtn.padH, borderRadius: masaKart.chatBtn.radius,
                    backgroundColor: masaKart.chatBtn.bg, borderWidth: 1, borderColor: masaKart.chatBtn.border }}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={masaKart.chatBtn.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
                  </Svg>
                  <T w={600} style={{ fontSize: masaKart.chatBtn.fontSize, color: masaKart.chatBtn.text }}>{t('masa.chatJump')}</T>
                </Pressable>
              </View>
              {cardType === 'kanka' ? (
                <KankaPairs mine={[{ initials, gender: ug, isSelf: true }, ...(kanka ? [kanka] : [])]} other={[]} />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: masaKart.avatarGap - 8 }}>
                  {ps.map((p, i) => (
                    <View key={i} style={{ padding: 2, borderRadius: 999, borderWidth: 2, borderColor: i === 0 ? masaKart.selfRing : 'transparent', backgroundColor: i === 0 ? masaKart.selfRingGap : 'transparent' }}>
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

      {/* ── Alt kart: rezervasyon bilgisi, Yola Çıktım, sohbet ── */}
      <Card style={{ marginTop: masaKart.cardGap }}>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16 }}>
          <T style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', lineHeight: 19.2 }}>{t('masa.reservationDone')}</T>
        </View>
        <View style={{ marginBottom: 10 }}><BtnPrimary label={t('masa.onMyWay')} full disabled /></View>
        <View ref={chatRef} collapsable={false}>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 20 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.t555 }} />
            <T w={700} style={{ fontSize: 10, letterSpacing: 1.4, color: c.t555 }}>{cardType === 'basbasa' ? t('tm.chatOne') : cardType === 'kanka' ? t('tm.chatKanka') : t('masa.groupChat')}</T>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
            <View style={{ paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center' }}><T style={{ fontSize: 12, lineHeight: 18, textAlign: 'center' }}>{t('masa.noMessages')}</T></View>
            <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)' }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }} />
              <BtnPrimary label={t('masa.send')} disabled />
            </View>
          </View>
        </View>
      </Card>
    </View>
  );
}

function MasaBlock({ item, locked, cardType, userInfo, kanka, width, scrollRef }: {
  item?: DashboardItem; locked: boolean; cardType: 'group' | 'basbasa' | 'kanka'; userInfo?: UserInfo; kanka?: { initials: string; gender: string | null } | null; width: number;
  scrollRef?: React.RefObject<ScrollViewInstance | null>;
}) {
  const { t } = useTranslation();
  const m = item?.meeting;
  if (locked || !m) return <EmptyMasaCard locked={locked} cardType={cardType} userInfo={userInfo} kanka={kanka} scrollRef={scrollRef} photo={m?.venuePhotos?.[0]} />;
  if (item.phase === 'REVEALED' && m.venueName) {
    const d: MasaDetayData = { id: m.id, type: m.type, maxParticipants: m.maxParticipants, scheduledAt: m.scheduledAt, sosEndsAt: m.sosEndsAt, venueName: m.venueName,
      venueAddress: m.venueAddress, venueDistrict: m.venueDistrict, venueMapsUrl: m.venueMapsUrl, venuePhotos: m.venuePhotos, participants: m.participants, occupations: m.occupations, aiReport: m.aiReport };
    // Kart kendi ana kartını ve alttaki ayrı kartı (rezervasyon, Yola Çıktım, sohbet) çizer
    return <MasaDetayKarti masa={d} scrollRef={scrollRef} />;
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
  return <EmptyMasaCard locked={false} cardType={cardType} userInfo={userInfo} kanka={kanka} scrollRef={scrollRef} photo={m.venuePhotos?.[0]} />;
}

function HistoryListInner({ history }: { history: HistoryMeeting[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  if (history.length === 0) return <Card style={{ marginBottom: 16 }}><T style={{ fontSize: 13, color: ll.label }}>{t('tm.noHistory')}</T></Card>;
  return (
    <Card style={{ marginBottom: 16, paddingVertical: 6, paddingHorizontal: 18 }}>
      {history.map((m, i) => {
        const open = openId === m.id;
        const masa: MasaDetayData = { id: m.id, type: m.type, maxParticipants: m.maxParticipants, scheduledAt: m.date, sosEndsAt: m.date, venueName: m.venueName ?? t('masa.noVenue'),
          venueAddress: m.venueAddress, venueDistrict: m.venueDistrict, venueMapsUrl: m.venueMapsUrl, venuePhotos: m.venuePhotos, participants: m.participants ?? [], occupations: m.occupations, aiReport: m.aiReport };
        return (
          <View key={m.id} style={{ borderBottomWidth: i < history.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44, paddingVertical: 6 }}>
              <T style={{ flex: 1, fontSize: 13, color: ll.text }}>{[fmtDate(m.date), t(HISTORY_TYPE[m.type ?? 'GROUP']), m.venueName, m.cityName].filter(Boolean).join(' - ')}</T>
              <Btn variant="chevron" accessibilityLabel={open ? t('tm.closeCard') : t('tm.openCard')} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} label="▾" onPress={() => setOpenId(open ? null : m.id)} />
            </View>
            {open && (
              <View style={{ paddingBottom: 12 }}>
                {!m.isReviewed && (
                  <Btn variant="monoTag" label={t('tm.review')} onPress={() => router.push(`/degerlendirme/${m.id}`)} />
                )}
                {/* Değerlendirme: masa detay kartının en üstünde, Canlı Akış kartı (Card + ll.text) stilinde; puan kadar dolu yıldız · not */}
                {m.review && (
                  <Card style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 4 }}>
                      <T w={600} style={{ fontSize: 13, color: ll.text }}>{t('tm.reviewLabel')}</T>
                      <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={t('review.stars', { n: m.review.rating })}>
                        {Array.from({ length: m.review.rating }).map((_, k) => <Star key={k} filled size={16} />)}
                      </View>
                      {!!m.review.comment && <T style={{ fontSize: 13, color: ll.text }}>· {m.review.comment}</T>}
                    </View>
                  </Card>
                )}
                <MasaDetayKarti masa={masa} archive />
                {!!m.blocked?.length && (
                  <View style={{ marginTop: 12 }}>
                    <Mono style={{ marginBottom: 4, fontSize: 11, color: ll.label }}>{t('tm.blocked')}</Mono>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                      {m.blocked.map((b, j) => <Mono key={`${b.initials}-${j}`} w={600} style={{ fontSize: 14, color: gColor(b.gender) }}>{b.initials}</Mono>)}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
    </Card>
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
  const scrollRef = useRef<ScrollViewInstance>(null);

  useEffect(() => { api.get<HistoryMeeting[]>('/meetings/my-history').then(h => setHistory(Array.isArray(h) ? h : [])).catch(() => {}); }, []);

  const colW = Math.min(width, llColumn.maxWidth) - 32;
  const userInfo = me ? { firstName: me.firstName, lastName: me.lastName, gender: me.profile?.gender } : undefined;
  const locked = Object.values(statuses).every(s => s === 'NONE');
  // Aktif kaydı (taramada ya da masası kuruluyor) olan kullanıcıya Masalarım'da seçim penceresi açılmaz
  const hasActiveSelection = !!selection?.options.some(o => o.selection || (o.seated && !o.locked));

  return (
    <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden' }}>
      <ScreenGlow />
      {!hasActiveSelection && <WeeklySelectionModal selection={selection} onSubmit={submitSelection} />}
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: 32, gap: 24, maxWidth: 896, width: '100%', alignSelf: 'center' }}>
        <Glow />
        {/* Grup / Baş Başa / Kankamla halkaları Eşleşme Paneli'ndekiyle aynı yükseklikte: üst boşluk yalnız durum çubuğu kadar;
            KYC kartı görünürken Eşleşme Paneli'ndeki gibi üstte ve altta 16 boşluk */}
        <View>
          {me?.kyc?.status !== 'APPROVED' && <View style={{ marginTop: 16, marginBottom: 16 }}><KycNoticeCard /></View>}
          {!ready ? <SkeletonBlock lines={5} /> : <LiveTabs tab={tab} statuses={statuses} onTab={selectTab} />}
        </View>
        {ready && (
          <>
            {locked && (
              <View style={{ backgroundColor: 'rgba(192,57,43,0.08)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.25)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
                <T style={{ color: 'rgba(192,57,43,0.85)', fontSize: 11, lineHeight: 16.5 }}>{t('tm.preview')}</T>
              </View>
            )}
            {locked && <BtnPrimary label={t('pkg.buy')} full onPress={() => router.navigate('/(tabs)/paketim')} />}
            <View>
              <Head title={locked ? t('tm.cardDetail') : t(CARD_TITLE[tab])} right={<BtnGhost label={t('tm.history')} onPress={() => setHistoryOpen(v => !v)} accessibilityState={{ expanded: historyOpen }} />} />
              {historyOpen && <HistoryList history={history} />}
              {tab === 'KANKA' && !tabItem && statuses.KANKA === 'SCANNING' && (
                <T style={{ marginBottom: 12, fontSize: 13, color: ll.text2, lineHeight: 20.8 }}>
                  {t('tm.kankaScanning')}
                </T>
              )}
              {tabAdminCancelled ? (
                <Card><T style={{ fontSize: 14, lineHeight: 22.4, textAlign: 'center', color: tw.text }}>{t('tm.cancelled')}</T></Card>
              ) : (
                <MasaBlock key={tab} item={tabItem} locked={locked} cardType={CARD_TYPE[tab]} userInfo={userInfo} kanka={kanka} width={colW} scrollRef={scrollRef} />
              )}
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
