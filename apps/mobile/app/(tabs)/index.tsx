// Sekme 1 — Eşleşme Paneli: apps/web/app/dashboard/page.tsx + components/live/LiveLayer.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { api } from '@/lib/api';
import { gColor, num, type MasaTuru } from '@/lib/masa';
import { CLOSING_DAY, SCAN_START_DAY, useMasaTabs } from '@/lib/useMasaTabs';
import { WeeklySelectionModal } from '@/components/WeeklySelectionModal';
import { Countdown } from '@/components/Countdown';
import { SelectionCard } from '@/components/SelectionCard';
import { isForeground, useAppRefresh } from '@/lib/useAppRefresh';
import type { LiveOverview, LivePulse, OceanKey } from '@/lib/liveTypes';
import { StdButton, Card, Cta, Glow, Eyebrow, Head, MaintenanceNotice, Mono, Note, Serif, Spinner, T, Title } from '@/components/ui';
import { LiveTabs } from '@/components/LiveTabs';
import { LiveSonar, LEVEL_KEY } from '@/components/Sonar';
import { WinbackHost } from '@/components/Winback';
import { LEVELS, ll, llColumn, heat, tw } from '@/theme/theme';
import { KycNoticeCard } from '@/components/KycNoticeCard';

import { formatTime } from '@ahenk/shared';
import { useTranslation } from 'react-i18next';
const PULSE_MS = 15_000;
const OVERVIEW_MS = 60_000;
const MEETING_GRACE_MS = 3 * 60 * 60 * 1000;
const CAPACITY: Record<MasaTuru, number> = { GROUP: 6, ONE_ON_ONE: 2, KANKA: 4 };
// Çeviri anahtarları (ekranda t())
const TABLE_TEXT: Record<MasaTuru, { title: string; note: string }> = {
  GROUP: { title: 'live.untilGROUP', note: 'live.closesGROUP' },
  ONE_ON_ONE: { title: 'live.untilONE_ON_ONE', note: 'live.closesONE_ON_ONE' },
  KANKA: { title: 'live.untilKANKA', note: 'live.closesKANKA' },
};
const OCEAN_LABEL: Record<OceanKey, string> = { openness: 'live.oceanOpenness', conscientiousness: 'live.oceanConscientiousness', extraversion: 'live.oceanExtraversion', agreeableness: 'live.oceanAgreeableness', neuroticism: 'live.oceanNeuroticism' };
const LEVEL_ALPHA = { 1: 'd9', 2: 'a6', 3: '73', 4: '4d' } as const;
// Tarama bekleme durumu: yoğunluk kartları "Düşük" kartının grisinde, yazı "Tarama bekleniyor"
const WAIT_CELL = `${LEVELS[4].color}${LEVEL_ALPHA[4]}`;
const WAIT_TEXT = 'live.waitScan';

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
  // Yalnız Eşleşme Paneli odaktayken yoklanır (başka sekmedeyken istek atılmaz); sekmeye dönülünce hemen yenilenir
  const focused = useIsFocused();
  useEffect(() => { if (!focused) return undefined; load(); const id = setInterval(load, intervalMs); return () => clearInterval(id); }, [load, intervalMs, focused]);
  useAppRefresh(load);
  return data;
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
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ready, me, kanka, tab, tabItem: rawTabItem, selectTab, statuses, tabPastClosing, scanning, selfParticipant, selection, submitSelection, changeSelection, cancelSelection, noPackage } = useMasaTabs();
  const [selectOpen, setSelectOpen] = useState(false);
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
  // PASİF: tarama başlamadı (geri sayım kartında "Yeni tarama başlamasına"); CANLI: tarama başlamış. Rozet, radar ve yoğunluk
  // kartları yalnız bu tek durumdan okunur
  const scanIdle = meetingTarget === null && waitingScan;

  const seated = [...(tabItem?.meeting.participants ?? [])].sort((a, b) => (a.joinedAt ?? '').localeCompare(b.joinedAt ?? ''));
  const waiting = tab === 'KANKA' && scanning && selfParticipant && kanka ? [selfParticipant, kanka] : [];
  const people = tabItem ? seated : waiting;
  const total = tabItem?.meeting.maxParticipants ?? CAPACITY[tab];

  return (
    <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden' }}>
      {/* web dashboard: position fixed, radial-gradient(ellipse 50% 40% at 70% 30%, rgba(192,57,43,.1) 0%, transparent 70%) — kaydırmayla kaymaz */}
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs><RadialGradient id="dashfix" cx="70%" cy="30%" rx="50%" ry="40%"><Stop offset="0" stopColor="rgb(192,57,43)" stopOpacity={0.1} /><Stop offset="0.7" stopColor="rgb(192,57,43)" stopOpacity={0} /></RadialGradient></Defs>
        <Rect width="100%" height="100%" fill="url(#dashfix)" />
      </Svg>
      <WeeklySelectionModal selection={selection} onSubmit={submitSelection} open={selectOpen} onClose={() => setSelectOpen(false)} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top }}>
        {/* Işıma kaydırılan içeriğin ilk çocuğu: diğer sekmeler gibi durum çubuğunun arkasına kadar uzanır */}
        <Glow />
        <View style={{ paddingHorizontal: 16 }}>
          {/* KYC kartı yalnız KYC onaysızken (kart görünürken) yer ve boşluk kaplar; kart yokken halkalar durum çubuğunun hemen altından başlar */}
          {me?.kyc?.status !== 'APPROVED' && <View style={{ marginTop: 16, marginBottom: 16 }}><KycNoticeCard /></View>}
          {me?.kyc?.status === 'REJECTED' && (
            <View style={{ marginBottom: 16, borderRadius: 16, padding: 16, backgroundColor: 'rgba(192,57,43,0.12)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.35)' }}>
              <T w={600} style={{ fontSize: 14, color: tw.accent, marginBottom: 4 }}>{t('kyc.rejectedTitle')}</T>
              {!!me.kyc.rejectReason && <T style={{ fontSize: 14, color: '#ccc' }}>{t('kyc.rejectReason', { reason: me.kyc.rejectReason })}</T>}
              <T style={{ fontSize: 12, color: '#888', marginTop: 8 }}>{t('kyc.reapply')}</T>
            </View>
          )}
          {me?.maintenanceMode && <MaintenanceNotice />}
        </View>
        <WinbackHost badge auto={false} />
        <View>
          {/* Halkalar yukarıda: sütunun üst boşluğu bu ekranda yok */}
          <View style={[st.column, { paddingTop: 0 }]}>
            <LiveTabs tab={tab} statuses={statuses} onTab={selectTab} noRings even />
            {/* Seçim kartı halkaların altında: KYC kartı yokken halkalar durum çubuğunun hemen altından başlar */}
            <SelectionCard selection={selection} onOpen={() => setSelectOpen(true)} onChange={changeSelection} onCancel={cancelSelection} />

            {/* Geri sayım; hiç paketi olmayan ya da hakları biten kullanıcıda aynı yerde, aynı kart görünümünde paket alma kartı (web LiveLayer).
                HIG: buton en az 44 pt, başlık serif */}
            {noPackage ? (
              <View style={[st.card, { borderColor: 'rgba(232,162,122,0.22)', overflow: 'hidden', gap: 12 }]}>
                <LinearGradient colors={['rgba(214,69,58,0.14)', 'rgba(255,255,255,0.02)']} locations={[0, 0.6]} start={{ x: 0.33, y: 0.03 }} end={{ x: 0.67, y: 0.97 }} style={StyleSheet.absoluteFill} />
                <Serif style={{ fontSize: 23, lineHeight: 27.6, color: ll.text }}>{t('live.pkgCardTitle')}</Serif>
                <T style={{ fontSize: 13, color: ll.text2, lineHeight: 19.5 }}>{t('live.pkgCardText')}</T>
                <StdButton variant="primary" label={t('live.pkgCardBtn')} full onPress={() => router.navigate('/(tabs)/paketim')} />
              </View>
            ) : (
              <View style={[st.card, { borderColor: 'rgba(232,162,122,0.22)', overflow: 'hidden' }]}>
                <LinearGradient colors={['rgba(214,69,58,0.14)', 'rgba(255,255,255,0.02)']} locations={[0, 0.6]} start={{ x: 0.33, y: 0.03 }} end={{ x: 0.67, y: 0.97 }} style={StyleSheet.absoluteFill} />
                <Eyebrow>{meetingTarget !== null ? t('live.untilMeeting') : waitingScan ? t('live.untilScan') : t(TABLE_TEXT[tab].title)}</Eyebrow>
                <Countdown day={waitingScan ? SCAN_START_DAY : CLOSING_DAY[tab]} targetAt={meetingTarget} />
                <T style={{ fontSize: 13, color: ll.text2, lineHeight: 19.5 }}>
                  {waitingScan ? t('live.scanStarts') : t(TABLE_TEXT[tab].note)}
                  {!waitingScan && tabSeatsLeft !== null && !(meetingTarget !== null && tabSeatsLeft === 0)
                    ? `\n${tabSeatsLeft > 0 ? t('live.seatsLeft', { count: num(tabSeatsLeft) }) : t('live.tableFull')}` : ''}
                </T>
              </View>
            )}


            <LiveSonar sonar={pulse?.sonar ?? null} idle={scanIdle} />

            {/* Katılım */}
            {tab === 'GROUP' ? (
              // Grup: başlık tek başına, isimler bir alt satırda; her kısaltma cinsiyet renkli çerçeveli yuvarlak dairede
              <Card>
                <Title>{people.length > 0 ? t('live.participationCount', { count: people.length, total }) : t('live.participation')}</Title>
                {people.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {people.map((p, i) => (
                      <View key={`${p.initials}-${i}`} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: gColor(p.gender), alignItems: 'center', justifyContent: 'center' }}>
                        <T w={700} style={{ fontSize: 12, letterSpacing: 0.24, color: gColor(p.gender) }}>{label(p.initials)}</T>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            ) : (
              <Card style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10, rowGap: 6 }}>
                <Title>{people.length > 0 ? t('live.participationCount', { count: people.length, total }) : t('live.participation')}</Title>
                {people.map((p, i) => (
                  <T key={`${p.initials}-${i}`} w={700} style={{ fontSize: 14, lineHeight: 21, letterSpacing: 0.28, color: gColor(p.gender) }}>{label(p.initials)}</T>
                ))}
              </Card>
            )}

            {/* Canlı Akış */}
            <Card>
              <Head title={t('live.feedTitle')} right={<Note>{t('live.feedNote')}</Note>} />
              {/* Son 20 olay tutulur; aynı anda en fazla 15 olay görünür, kalanı kart içinde kaydırılır */}
              <ScrollView style={{ maxHeight: FEED_VISIBLE_HEIGHT }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {(pulse?.feed.events ?? []).length === 0 ? (
                <T style={{ fontSize: 13, color: ll.label }}>{t('live.feedEmpty')}</T>
              ) : (pulse?.feed.events ?? []).slice(0, 20).map((e) => (
                <View key={e.key} style={st.feedRow}>
                  <Mono style={{ fontSize: 10, color: ll.time, width: 38 }}>{formatTime(e.at)}</Mono>
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
              <Head title={t('live.heatTitle')} style={{ alignItems: 'center' }} right={scanIdle ? <T style={{ fontSize: 13, color: '#FFFFFF', opacity: 0.6 }}>{t(WAIT_TEXT)}</T> : undefined} />
              {overview?.density ? (
                <View style={st.heat}>
                  {overview.density.districts.map((d) => (
                    // Tarama başlamadan bütün kartlar "Düşük" grisinde, yoğunluk yazısı yok; canlıyken semtin seviye renginde (radar ile aynı)
                    <View key={d.name} style={[st.heatCell, { backgroundColor: scanIdle ? WAIT_CELL : `${LEVELS[d.level].color}${LEVEL_ALPHA[d.level]}` }]}>
                      <T w={700} style={{ fontSize: 12, lineHeight: 18 }}>{d.name}</T>
                      {!scanIdle && (
                        // Semt adı ile yoğunluk yazısı arasında ince ışın çizgisi (web .ll-heat-rule)
                        <View>
                          <LinearGradient colors={heat.rule.colors as unknown as [string, string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: heat.rule.height, marginVertical: heat.rule.margin }} />
                          <Mono style={{ fontSize: d.percent === null ? 11 : 15, color: tw.text }}>{d.percent === null ? t(LEVEL_KEY[d.level]) : `%${d.percent}`}</Mono>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ) : overview?.heatmap.length ? (
                <View style={st.heat}>
                  {overview.heatmap.map((d, i) => (
                    <View key={d.name} style={[st.heatCell, { backgroundColor: scanIdle ? WAIT_CELL : heatColor(i, overview.heatmap.length) }]}>
                      <T w={700} style={{ fontSize: 12, lineHeight: 18 }}>{d.name}</T>
                      {!scanIdle && <Mono style={{ fontSize: 15, color: tw.text }}>{`%${d.percent}`}</Mono>}
                    </View>
                  ))}
                </View>
              ) : <T style={{ fontSize: 13, color: ll.label }}>{t('live.heatEmpty')}</T>}
            </View>

            {/* Uyum sinyali */}
            {overview && (
              <Card>
                <Eyebrow>{t('live.signal')}</Eyebrow>
                <Serif style={{ fontSize: 26, lineHeight: 32.5, marginTop: 10, marginBottom: 16, color: ll.text }}>
                  {t('live.signalPre')} <Serif style={{ color: ll.red3 }}>{t('live.signalPeople', { count: num(overview.signal.closeCount) })}</Serif> {t('live.signalPost')}
                </Serif>
                <View style={{ gap: 10 }}>
                  {overview.signal.top.map((d) => (
                    <View key={d.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <T style={{ width: 104, fontSize: 12, lineHeight: 18, color: ll.text2 }}>{t(OCEAN_LABEL[d.key])}</T>
                      <View style={{ flex: 1 }}><Bar ratio={d.score / 100} colors={['#d6453a', '#e8a27a']} height={6} /></View>
                      <Mono style={{ width: 28, fontSize: 11, textAlign: 'right' }}>{d.score}</Mono>
                    </View>
                  ))}
                </View>
                {overview.signal.commonDimension && (
                  <T style={{ marginTop: 14, fontSize: 13, color: ll.text2 }}>
                    {t('live.commonDim')} <T w={700} style={{ color: ll.text }}>{t(OCEAN_LABEL[overview.signal.commonDimension])}</T>
                  </T>
                )}
              </Card>
            )}

            <Cta
              label={overview?.hasTable ? t('live.seeTable') : seats !== null ? t('live.reserveSeats', { count: num(seats) }) : t('live.reserve')}
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
  feedRow: { flexDirection: 'row', gap: 8, alignItems: 'baseline', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  heat: { flexDirection: 'row', flexWrap: 'wrap', gap: heat.gap },
  heatCell: { width: '31.9%', minHeight: heat.height, borderRadius: heat.radius, padding: heat.padding, justifyContent: 'space-between' },
});
