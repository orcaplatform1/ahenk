// Sekme 1 — Eşleşme Paneli: apps/web/app/dashboard/page.tsx + components/live/LiveLayer.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, ScrollView, StyleSheet, View } from 'react-native';
import { useReduceMotion } from '@/lib/motion';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { api } from '@/lib/api';
import { gColor, getNextTarget, num, pad, type MasaTuru } from '@/lib/masa';
import { CLOSING_DAY, SCAN_START_DAY, useMasaTabs } from '@/lib/useMasaTabs';
import { WeeklySelectionModal } from '@/components/WeeklySelectionModal';
import { isForeground, useAppRefresh } from '@/lib/useAppRefresh';
import type { LiveOverview, LivePulse, OceanKey } from '@/lib/liveTypes';
import { BtnPrimary, Card, Cta, Glow, Eyebrow, Head, MaintenanceNotice, Mono, Note, Serif, Spinner, T, Title } from '@/components/ui';
import { LiveTabs } from '@/components/LiveTabs';
import { LiveSonar } from '@/components/Sonar';
import { WinbackHost } from '@/components/Winback';
import { LEVELS, ll, llColumn, heat, tw } from '@/theme/theme';
import { KycNoticeCard } from '@/components/KycNoticeCard';

const PULSE_MS = 15_000;
const OVERVIEW_MS = 60_000;
const MEETING_GRACE_MS = 3 * 60 * 60 * 1000;
const CAPACITY: Record<MasaTuru, number> = { GROUP: 6, ONE_ON_ONE: 2, KANKA: 4 };
const TABLE_TEXT: Record<MasaTuru, { title: string; note: string }> = {
  GROUP: { title: 'Grup masası kurulmasına', note: "Perşembe 23:59'da masa kapanır." },
  ONE_ON_ONE: { title: 'Baş Başa masası kurulmasına', note: "Cuma 23:59'da masa kapanır." },
  KANKA: { title: 'Kankamla masası kurulmasına', note: "Cumartesi 23:59'da masa kapanır." },
};
const OCEAN_LABEL: Record<OceanKey, string> = { openness: 'Açıklık', conscientiousness: 'Sorumluluk', extraversion: 'Dışadönüklük', agreeableness: 'Uyumluluk', neuroticism: 'Duygusal Denge' };
const LEVEL_ALPHA = { 1: 'd9', 2: 'a6', 3: '73', 4: '4d' } as const;

function heatColor(index: number, count: number) {
  const band = count <= 1 ? 0 : Math.min(2, Math.floor((index / count) * 3));
  const start = Math.ceil((count * band) / 3);
  const end = Math.ceil((count * (band + 1)) / 3) - 1;
  const t = end > start ? (index - start) / (end - start) : 0;
  const mix = (a: number, b: number) => (a + (b - a) * t).toFixed(3);
  if (band === 0) return `rgba(214,69,58,${mix(0.78, 0.46)})`;
  if (band === 1) return `rgba(200,116,60,${mix(0.48, 0.24)})`;
  return `rgba(255,255,255,${mix(0.08, 0.045)})`;
}

function useLivePoll<T>(path: string, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const load = useCallback(() => { if (!isForeground()) return; api.get<T>(path).then((d) => { if (d) setData(d); }).catch(() => undefined); }, [path]);
  useEffect(() => { load(); const id = setInterval(load, intervalMs); return () => clearInterval(id); }, [load, intervalMs]);
  useAppRefresh(load);
  return data;
}

// .ll-blink: opaklık 1 → 0,45 → 1, 1,4 sn ease-in-out; Hareketi Azalt açıkken durağan (web prefers-reduced-motion)
function Blink({ children }: { children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    const e = Easing.bezier(0.42, 0, 0.58, 1);
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 0.45, duration: 700, easing: e, useNativeDriver: true }), Animated.timing(v, { toValue: 1, duration: 700, easing: e, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  return <Animated.View style={{ opacity: v }}>{children}</Animated.View>;
}

function Countdown({ day, targetAt }: { day: number; targetAt?: number | null }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, (targetAt ?? getNextTarget(day).getTime()) - Date.now()));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [day, targetAt]);
  const units = [
    { label: 'GÜN', value: Math.floor(left / 86_400_000) },
    { label: 'SAAT', value: Math.floor((left % 86_400_000) / 3_600_000) },
    { label: 'DAKİKA', value: Math.floor((left % 3_600_000) / 60_000) },
    { label: 'SANİYE', value: Math.floor((left % 60_000) / 1000) },
  ];
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 8, marginVertical: 14 }}>
      {units.map((u, i) => (
        <View key={u.label} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          {i > 0 && <Serif style={{ fontSize: 40, lineHeight: 40, color: '#6e6860' }}>:</Serif>}
          <View style={{ alignItems: 'center', minWidth: 52 }}>
            {u.label === 'SANİYE' ? <Blink><Serif style={{ fontSize: 40, lineHeight: 40, color: ll.red3 }}>{pad(u.value)}</Serif></Blink> : <Serif style={{ fontSize: 40, lineHeight: 40, color: ll.text }}>{pad(u.value)}</Serif>}
            <T style={{ fontSize: 10, color: ll.label, marginTop: 6 }}>{u.label}</T>
          </View>
        </View>
      ))}
    </View>
  );
}

function Bar({ ratio, colors, height }: { ratio: number; colors: string[]; height: number }) {
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <LinearGradient colors={colors as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, height: '100%' }} />
    </View>
  );
}

function label(initials: string) {
  const raw = initials.trim();
  return raw.length === 2 && !raw.includes('.') ? `${raw[0]}.${raw[1]}.`.toLocaleUpperCase('tr-TR') : raw.toLocaleUpperCase('tr-TR');
}

export default function EslesmePaneli() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ready, me, kanka, tab, tabItem: rawTabItem, selectTab, statuses, tabPastClosing, scanning, selfParticipant, tabAdminCancelled, selection, submitSelection } = useMasaTabs();
  const overview = useLivePoll<LiveOverview>('/meetings/live/overview', OVERVIEW_MS);
  const pulse = useLivePoll<LivePulse>('/meetings/live/pulse', PULSE_MS);
  const tabItem = rawTabItem && Date.now() < Date.parse(rawTabItem.meeting.scheduledAt) + MEETING_GRACE_MS ? rawTabItem : undefined;

  if (!ready) return <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}><Glow /><Spinner /></View>;

  const hasTabTable = !!tabItem;
  const tabSeatsLeft = tabItem ? Math.max(0, (tabItem.meeting.maxParticipants ?? 0) - tabItem.meeting.participants.filter(p => !p.cancelled).length) : null;
  const meetingAt = tabItem && statuses[tab] === 'TABLE' ? tabItem.meeting.scheduledAt : null;
  const waitingScan = tabPastClosing && !hasTabTable;
  const meetingTarget = hasTabTable && meetingAt ? Date.parse(meetingAt) : null;
  const seats = overview?.groupSeatsLeft ?? null;
  const scanOff = tabAdminCancelled || statuses[tab] === 'KYC' || statuses[tab] === 'KANKA';

  const seated = [...(tabItem?.meeting.participants ?? [])].sort((a, b) => (a.joinedAt ?? '').localeCompare(b.joinedAt ?? ''));
  const waiting = tab === 'KANKA' && scanning && selfParticipant && kanka ? [selfParticipant, kanka] : [];
  const people = tabItem ? seated : waiting;
  const total = tabItem?.meeting.maxParticipants ?? CAPACITY[tab];

  return (
    <View style={{ flex: 1, backgroundColor: ll.bg }}>
      {/* web dashboard: position fixed, radial-gradient(ellipse 50% 40% at 70% 30%, rgba(192,57,43,.1) 0%, transparent 70%) — kaydırmayla kaymaz */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs><RadialGradient id="dashfix" cx="70%" cy="30%" rx="50%" ry="40%"><Stop offset="0" stopColor="rgb(192,57,43)" stopOpacity={0.1} /><Stop offset="0.7" stopColor="rgb(192,57,43)" stopOpacity={0} /></RadialGradient></Defs>
        <Rect width="100%" height="100%" fill="url(#dashfix)" />
      </Svg>
      <WeeklySelectionModal selection={selection} onSubmit={submitSelection} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: 16 }}>
          <View style={{ marginTop: 16, marginBottom: 16 }}><KycNoticeCard /></View>
          {me?.kyc?.status === 'REJECTED' && (
            <View style={{ marginBottom: 16, borderRadius: 16, padding: 16, backgroundColor: 'rgba(192,57,43,0.12)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.35)' }}>
              <T w={600} style={{ fontSize: 14, color: tw.accent, marginBottom: 4 }}>Kimlik doğrulamanız reddedildi</T>
              {!!me.kyc.rejectReason && <T style={{ fontSize: 14, color: '#ccc' }}>Red nedeni: {me.kyc.rejectReason}</T>}
              <T style={{ fontSize: 12, color: '#888', marginTop: 8 }}>Profilim → Kimlik Doğrulama sekmesinden yeniden başvurabilirsiniz.</T>
            </View>
          )}
          {me?.maintenanceMode && <MaintenanceNotice />}
        </View>
        <WinbackHost badge auto={false} />
        <View style={{ overflow: 'hidden' }}>
          <Glow />
          <View style={st.column}>
            <LiveTabs tab={tab} statuses={statuses} onTab={selectTab} />

            {/* Geri sayım */}
            <View style={[st.card, { borderColor: 'rgba(232,162,122,0.22)', overflow: 'hidden' }]}>
              <LinearGradient colors={['rgba(214,69,58,0.14)', 'rgba(255,255,255,0.02)']} locations={[0, 0.6]} start={{ x: 0.33, y: 0.03 }} end={{ x: 0.67, y: 0.97 }} style={StyleSheet.absoluteFill} />
              {hasTabTable && statuses[tab] === 'FORMING' && <Image source={require('@/assets/maskot/jantihaydar_run.webp')} style={st.maskot} resizeMode="contain" />}
              {!hasTabTable && <Image source={require('@/assets/maskot/jantihaydar_stop.webp')} style={st.maskot} resizeMode="contain" />}
              <Eyebrow>{meetingTarget !== null ? 'Buluşmanıza kalan süre' : waitingScan ? 'Yeni tarama başlamasına' : TABLE_TEXT[tab].title}</Eyebrow>
              <Countdown day={waitingScan ? SCAN_START_DAY : CLOSING_DAY[tab]} targetAt={meetingTarget} />
              <T style={{ fontSize: 13, color: ll.text2, lineHeight: 19.5 }}>
                {waitingScan ? "Pazar 23:59'da yeni tarama başlar." : TABLE_TEXT[tab].note}
                {!waitingScan && tabSeatsLeft !== null && !(meetingTarget !== null && tabSeatsLeft === 0)
                  ? `\n${tabSeatsLeft > 0 ? `Masanızda ${num(tabSeatsLeft)} boş koltuk kaldı.` : 'Masanızda kontenjan doldu.'}` : ''}
              </T>
            </View>


            <LiveSonar sonar={pulse?.sonar ?? null} scanOff={scanOff} />

            {/* Katılım */}
            <Card style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10, rowGap: 6 }}>
              <Title>{people.length > 0 ? `Katılım ${people.length}/${total}:` : 'Katılım:'}</Title>
              {people.map((p, i) => (
                <T key={`${p.initials}-${i}`} w={700} style={{ fontSize: 14, lineHeight: 21, letterSpacing: 0.28, color: gColor(p.gender) }}>{label(p.initials)}</T>
              ))}
            </Card>

            {/* Canlı Akış */}
            <Card>
              <Head title="Canlı Akış" right={<Note>Son 20 olay</Note>} />
              {/* Son 20 olay tutulur; aynı anda en fazla 15 olay görünür, kalanı kart içinde kaydırılır */}
              <ScrollView style={{ maxHeight: FEED_VISIBLE_HEIGHT }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {(pulse?.feed.events ?? []).length === 0 ? (
                <T style={{ fontSize: 13, color: ll.label }}>Henüz olay yok.</T>
              ) : (pulse?.feed.events ?? []).slice(0, 20).map((e) => (
                <View key={e.key} style={st.feedRow}>
                  <Mono style={{ fontSize: 10, color: ll.time, width: 38 }}>{new Date(e.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}</Mono>
                  <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                    {e.segments.map((sg, i) => sg.t === 'person' ? (
                      <View key={i} style={{ paddingHorizontal: 5, borderRadius: 99, borderWidth: 1, borderColor: gColor(sg.g) }}>
                        <T w={600} style={{ fontSize: 10.5, lineHeight: 15.225, color: ll.text }}>{sg.v}</T>
                      </View>
                    ) : <T key={i} style={{ fontSize: 11.5, lineHeight: 17.25, color: ll.text }}>{sg.v}</T>)}
                  </View>
                </View>
              ))}
              </ScrollView>
            </Card>

            {/* Isı haritası */}
            <View>
              <Head title="Semt Masa Yoğunluğu" />
              {overview?.density ? (
                <View style={st.heat}>
                  {overview.density.districts.map((d) => (
                    <View key={d.name} style={[st.heatCell, { backgroundColor: `${LEVELS[d.level].color}${LEVEL_ALPHA[d.level]}` }]}>
                      <T w={700} numberOfLines={1} style={{ fontSize: 12, lineHeight: 18 }}>{d.name}</T>
                      <Mono style={{ fontSize: d.percent === null ? 11 : 15, color: tw.text }}>{d.percent === null ? LEVELS[d.level].label : `%${d.percent}`}</Mono>
                    </View>
                  ))}
                </View>
              ) : overview?.heatmap.length ? (
                <View style={st.heat}>
                  {overview.heatmap.map((d, i) => (
                    <View key={d.name} style={[st.heatCell, { backgroundColor: heatColor(i, overview.heatmap.length) }]}>
                      <T w={700} numberOfLines={1} style={{ fontSize: 12, lineHeight: 18 }}>{d.name}</T>
                      <Mono style={{ fontSize: 15, color: tw.text }}>%{d.percent}</Mono>
                    </View>
                  ))}
                </View>
              ) : <T style={{ fontSize: 13, color: ll.label }}>Bu hafta için ilçe verisi henüz yok.</T>}
            </View>

            {/* Uyum sinyali */}
            {overview && (
              <Card>
                <Eyebrow>UYUM SİNYALİ</Eyebrow>
                <Serif style={{ fontSize: 26, lineHeight: 32.5, marginTop: 10, marginBottom: 16, color: ll.text }}>
                  Profiline yakın <Serif style={{ color: ll.red3 }}>{num(overview.signal.closeCount)} kişi</Serif> bu hafta havuzda.
                </Serif>
                <View style={{ gap: 10 }}>
                  {overview.signal.top.map((d) => (
                    <View key={d.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <T style={{ width: 104, fontSize: 12, lineHeight: 18, color: ll.text2 }}>{OCEAN_LABEL[d.key]}</T>
                      <View style={{ flex: 1 }}><Bar ratio={d.score / 100} colors={['#d6453a', '#e8a27a']} height={6} /></View>
                      <Mono style={{ width: 28, fontSize: 11, textAlign: 'right' }}>{d.score}</Mono>
                    </View>
                  ))}
                </View>
                {overview.signal.commonDimension && (
                  <T style={{ marginTop: 14, fontSize: 13, color: ll.text2 }}>
                    Masandaki kişilerle en güçlü ortak noktan: <T w={700} style={{ color: ll.text }}>{OCEAN_LABEL[overview.signal.commonDimension]}</T>
                  </T>
                )}
              </Card>
            )}

            <Cta
              label={overview?.hasTable ? 'Masanı Gör' : seats !== null ? `Masanı Ayır · ${num(seats)} koltuk kaldı` : 'Masanı Ayır'}
              onPress={() => router.push(overview?.hasTable || me?.activePlan ? '/(tabs)/masalarim' : '/(tabs)/paketim')}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// 15 tek satırlık olay: feedRow 6+6 dolgu + 17,25 satır + 1 çizgi
const FEED_VISIBLE_HEIGHT = 15 * (12 + 17.25 + 1);

const st = StyleSheet.create({
  column: { width: '100%', maxWidth: llColumn.maxWidth, alignSelf: 'center', paddingTop: llColumn.padTop, paddingHorizontal: llColumn.padH, paddingBottom: llColumn.padBottom, gap: llColumn.gap },
  card: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 18 },
  maskot: { width: 80, height: 80 * 1639 / 960, alignSelf: 'center' },
  feedRow: { flexDirection: 'row', gap: 8, alignItems: 'baseline', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  heat: { flexDirection: 'row', flexWrap: 'wrap', gap: heat.gap },
  heatCell: { width: '31.9%', height: heat.height, borderRadius: heat.radius, padding: heat.padding, justifyContent: 'space-between' },
});
