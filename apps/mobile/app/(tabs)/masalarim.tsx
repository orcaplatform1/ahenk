// Sekme 2 — Masalarım: apps/web/app/profil/tabs/TabMasalar.tsx (webdeki içerikle aynı; S-06)
import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { api } from '@/lib/api';
import { buildInitials, fmtDate, gColor, type DashboardItem, type MasaTuru } from '@/lib/masa';
import { useMasaTabs } from '@/lib/useMasaTabs';
import { requestLocationOnFirstTable } from '@/lib/sosTask';
import { LiveTabs } from '@/components/LiveTabs';
import { KankaPairs } from '@/components/KankaPairs';
import { DetayAvatar } from '@/components/DetayAvatar';
import { MasaDetayKarti, type MasaDetayData, type VenuePhoto } from '@/components/MasaDetayKarti';
import { ConfirmedRadarView, RezervasyonIptal } from '@/components/MasaBekleme';
import { BtnGhost, BtnPrimary, Card, Head, HIT, Mono, Serif, SkeletonBlock, T } from '@/components/ui';
import { Glow } from './index';
import { c, ll, llColumn, tw } from '@/theme/theme';

interface HistoryMeeting {
  id: string; date: string; type?: MasaTuru; venueName: string | null; cityName?: string | null; maxParticipants?: number;
  venueAddress?: string | null; venueMapsUrl?: string | null; venuePhotos?: VenuePhoto[];
  aiReport?: { content: string; uyumSkoru: number; generatedAt: string } | null;
  participants?: { initials: string; gender: string | null; isSelf?: boolean; pair?: 'MINE' | 'OTHER' }[];
  review?: { rating: number; comment: string | null } | null; blocked?: { initials: string; gender: string | null }[]; isReviewed?: boolean;
}
interface UserInfo { firstName: string; lastName: string; gender?: string | null }

const CARD_TITLE: Record<MasaTuru, string> = { GROUP: 'Grup Masa Kartı', ONE_ON_ONE: 'Baş Başa Masa Kartı', KANKA: 'Kankamla Masa Kartı' };
const CARD_TYPE: Record<MasaTuru, 'group' | 'basbasa' | 'kanka'> = { GROUP: 'group', ONE_ON_ONE: 'basbasa', KANKA: 'kanka' };
const HISTORY_TYPE: Record<MasaTuru, string> = { GROUP: 'Grup Masası', ONE_ON_ONE: 'Baş Başa Masası', KANKA: 'Kankamla Masası' };

function EmptyMasaCard({ locked, cardType, userInfo, kanka }: { locked: boolean; cardType: 'group' | 'basbasa' | 'kanka'; userInfo?: UserInfo; kanka?: { initials: string; gender: string | null } | null }) {
  const initials = userInfo ? buildInitials(userInfo.firstName, userInfo.lastName) : '?';
  const ug = userInfo?.gender ?? null;
  const og = ug === 'FEMALE' ? 'MALE' : 'FEMALE';
  const ps = cardType === 'basbasa'
    ? [{ initials, gender: ug }, { initials: '?', gender: og }]
    : [{ initials, gender: ug ?? 'MALE' }, { initials: '?', gender: og }, { initials: '?', gender: ug ?? 'MALE' }, { initials: '?', gender: og }, { initials: '?', gender: ug ?? 'MALE' }, { initials: '?', gender: og }];
  return (
    <Card>
      {locked && <Image source={require('@/assets/lock-icon.webp')} style={{ position: 'absolute', top: 16, right: 16, zIndex: 2, width: 56, height: 56, opacity: 0.85 }} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.green }} />
        <T w={700} style={{ fontSize: 10, color: c.green, letterSpacing: 1.8 }}>MASA DETAYI</T>
      </View>
      <Serif style={{ fontSize: 26, lineHeight: 31, letterSpacing: 0.26, marginBottom: 4 }}>Mekan Adı</Serif>
      <T style={{ marginBottom: 16, fontSize: 13, color: c.t666, lineHeight: 18 }}>İstanbul</T>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{ flex: 1, aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1.5}>
              <Rect x={1} y={5} width={22} height={15} rx={2} /><Circle cx={12} cy={12} r={4} /><Path d="M8 5l1.5-3h5L16 5" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        ))}
      </View>
      <View style={{ marginBottom: 18 }}><BtnPrimary label="HARİTADA GÖR" full disabled /></View>
      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 16 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.green }} />
          <T style={{ fontSize: 13, color: c.t888 }}>Buluşma</T>
        </View>
        <T w={700} style={{ fontSize: 15, letterSpacing: 0.15 }}>{cardType === 'basbasa' ? 'Cumartesi · 20:00' : cardType === 'kanka' ? 'Pazar · 20:00' : 'Cuma · 20:00'}</T>
      </View>
      <View style={{ marginBottom: 20 }}>
        <T w={700} style={{ marginBottom: 12, fontSize: 9, color: c.t555, letterSpacing: 1.26 }}>{cardType === 'basbasa' ? 'BAŞ BAŞA' : 'KATILIMCILAR'}</T>
        {cardType === 'kanka' ? (
          <KankaPairs mine={[{ initials, gender: ug, isSelf: true }, ...(kanka ? [kanka] : [])]} other={[]} />
        ) : (
          <View style={cardType === 'group' ? { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: 48 * 4 + 30 } : { flexDirection: 'row', gap: 10 }}>
            {ps.map((p, i) => <DetayAvatar key={i} participant={p} delay={0.52 + i * 0.1} />)}
          </View>
        )}
      </View>
      <View style={{ backgroundColor: c.aiBg, borderWidth: 1, borderColor: c.aiBorder, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: c.aiIconBg, borderWidth: 1, borderColor: c.aiIconBorder, alignItems: 'center', justifyContent: 'center' }}><T style={{ fontSize: 16 }}>✦</T></View>
          <T w={700} style={{ fontSize: 10, letterSpacing: 1.6, color: c.aiTitle }}>YAPAY ZEKA MASA RAPORU</T>
        </View>
        <View style={{ height: 1, backgroundColor: c.aiDivider, marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <T w={600} style={{ fontSize: 10, letterSpacing: 1.2, color: 'rgba(255,255,255,0.88)' }}>UYUM SKORU</T>
          <T w={700} style={{ fontSize: 14, color: c.tF0 }}>%—</T>
        </View>
        <View style={{ height: 5, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 12 }} />
        <T style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', lineHeight: 21.5 }}>Masa kurulduktan sonra yapay zeka uyum raporu burada görünecek.</T>
      </View>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16 }}>
        <T style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', lineHeight: 19 }}>Rezervasyonunuz tamamlandı. Girişte görevliye isminizi söylediğinizde masanıza yönlendirileceksiniz. İyi eğlenceler.</T>
      </View>
      <View style={{ marginBottom: 10 }}><BtnPrimary label="Yola Çıktım" full disabled /></View>
      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 20 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.t555 }} />
        <T w={700} style={{ fontSize: 10, letterSpacing: 1.4, color: c.t555 }}>{cardType === 'basbasa' ? 'BAŞ BAŞA SOHBETİ' : cardType === 'kanka' ? 'KANKAMLA SOHBETİ' : 'GRUP SOHBETİ'}</T>
      </View>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
        <View style={{ paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center' }}><T style={{ fontSize: 12, textAlign: 'center' }}>Henüz mesaj yok. İlk mesajı sen gönder.</T></View>
        <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)' }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }} />
          <BtnPrimary label="Gönder" disabled />
        </View>
      </View>
    </Card>
  );
}

function MasaBlock({ item, locked, cardType, userInfo, kanka, onCancelled, width }: {
  item?: DashboardItem; locked: boolean; cardType: 'group' | 'basbasa' | 'kanka'; userInfo?: UserInfo; kanka?: { initials: string; gender: string | null } | null; onCancelled: () => void; width: number;
}) {
  const m = item?.meeting;
  if (locked || !m) return <EmptyMasaCard locked={locked} cardType={cardType} userInfo={userInfo} kanka={kanka} />;
  if (item.phase === 'REVEALED' && m.venueName) {
    const d: MasaDetayData = { id: m.id, type: m.type, maxParticipants: m.maxParticipants, scheduledAt: m.scheduledAt, sosEndsAt: m.sosEndsAt, venueName: m.venueName,
      venueAddress: m.venueAddress, venueMapsUrl: m.venueMapsUrl, venuePhotos: m.venuePhotos, participants: m.participants, aiReport: m.aiReport };
    return <Card><MasaDetayKarti masa={d} /></Card>;
  }
  if (m.participants.length > 0) {
    return (
      <Card>
        <ConfirmedRadarView width={width - 36} participants={m.participants} maxParticipants={m.maxParticipants} type={m.type} scheduledAt={m.scheduledAt}
          infoText="Buluşma günü saat 10:00'da masa detayları burada görünecektir. Ayrıca size bildirim göndereceğiz." />
        {m.type === 'KANKA' && (
          <View style={{ marginTop: 16 }}>
            <KankaPairs mine={m.participants.filter(p => p.pair === 'MINE' && !p.cancelled)} other={m.participants.filter(p => p.pair === 'OTHER' && !p.cancelled)} />
          </View>
        )}
        <RezervasyonIptal meetingId={m.id} scheduledAt={m.scheduledAt} cancelRightUsed={m.cancelRightUsed} onCancelled={onCancelled} />
      </Card>
    );
  }
  return <EmptyMasaCard locked={false} cardType={cardType} userInfo={userInfo} kanka={kanka} />;
}

function HistoryList({ history }: { history: HistoryMeeting[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  if (history.length === 0) return <Card style={{ marginBottom: 16 }}><T style={{ fontSize: 13, color: ll.label }}>Henüz geçmiş masan yok.</T></Card>;
  return (
    <Card style={{ marginBottom: 16, paddingVertical: 6, paddingHorizontal: 18 }}>
      {history.map((m, i) => {
        const open = openId === m.id;
        const masa: MasaDetayData = { id: m.id, type: m.type, maxParticipants: m.maxParticipants, scheduledAt: m.date, sosEndsAt: m.date, venueName: m.venueName ?? 'Mekân bilgisi yok',
          venueAddress: m.venueAddress, venueMapsUrl: m.venueMapsUrl, venuePhotos: m.venuePhotos, participants: m.participants ?? [], aiReport: m.aiReport };
        return (
          <View key={m.id} style={{ borderBottomWidth: i < history.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44, paddingVertical: 6 }}>
              <T style={{ flex: 1, fontSize: 13, color: ll.text }}>{[fmtDate(m.date), HISTORY_TYPE[m.type ?? 'GROUP'], m.venueName, m.cityName].filter(Boolean).join(' - ')}</T>
              <Pressable hitSlop={HIT} onPress={() => setOpenId(open ? null : m.id)} accessibilityLabel={open ? 'Masa kartını kapat' : 'Masa kartını aç'} style={{ padding: 6, transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
                <T style={{ color: ll.label, fontSize: 14 }}>▾</T>
              </Pressable>
            </View>
            {open && (
              <View style={{ paddingBottom: 12 }}>
                <MasaDetayKarti masa={masa} archive />
                {m.review && (
                  <View style={{ marginTop: 12 }}>
                    <Mono style={{ marginBottom: 4, fontSize: 11, color: ll.label }}>DEĞERLENDİRMEN</Mono>
                    <T style={{ fontSize: 13, color: ll.text }}>{m.review.rating}/5{m.review.comment ? ` · ${m.review.comment}` : ''}</T>
                  </View>
                )}
                {!!m.blocked?.length && (
                  <View style={{ marginTop: 12 }}>
                    <Mono style={{ marginBottom: 4, fontSize: 11, color: ll.label }}>ENGELLEDİKLERİN</Mono>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                      {m.blocked.map((b, j) => <Mono key={`${b.initials}-${j}`} w={600} style={{ fontSize: 14, color: gColor(b.gender) }}>{b.initials}</Mono>)}
                    </View>
                  </View>
                )}
              </View>
            )}
            {!m.isReviewed && (
              <Pressable hitSlop={HIT} onPress={() => router.push(`/degerlendirme/${m.id}`)} style={{ alignSelf: 'flex-start', marginBottom: 8 }}>
                <Mono style={{ fontSize: 11, color: ll.copper }}>Değerlendir</Mono>
              </Pressable>
            )}
          </View>
        );
      })}
    </Card>
  );
}

export default function Masalarim() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { ready, me, items, kanka, tab, tabItem, selectTab, statuses, reload, tabAdminCancelled, kycApproved } = useMasaTabs();
  const [history, setHistory] = useState<HistoryMeeting[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => { api.get<HistoryMeeting[]>('/meetings/my-history').then(h => setHistory(Array.isArray(h) ? h : [])).catch(() => {}); }, []);
  // S-27: konum izni ilk masa onaylandığında istenir
  useEffect(() => { if (items.some(i => i.phase === 'REVEALED')) requestLocationOnFirstTable().catch(() => {}); }, [items]);

  const colW = Math.min(width, llColumn.maxWidth) - 32;
  const userInfo = me ? { firstName: me.firstName, lastName: me.lastName, gender: me.profile?.gender } : undefined;
  const locked = Object.values(statuses).every(s => s === 'NONE');

  return (
    <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden' }}>
      <Glow />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 32, paddingHorizontal: 16, paddingBottom: 32, gap: 24, maxWidth: 896, width: '100%', alignSelf: 'center' }}>
        {!ready ? <SkeletonBlock lines={5} /> : (
          <>
            {!kycApproved && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingHorizontal: 20, paddingVertical: 16, borderRadius: 16, backgroundColor: '#000', borderWidth: 1, borderColor: c.wineBorder }}>
                <T style={{ flex: 1, fontSize: 14, lineHeight: 19, color: 'rgba(192,57,43,0.85)' }}>Masaya katılmak için kimlik doğrulaması gereklidir.</T>
                <BtnPrimary label="Doğrula" onPress={() => router.navigate({ pathname: '/(tabs)/profilim', params: { tab: 'kyc' } })} />
              </View>
            )}
            {locked && <BtnPrimary label="Paket Seç" full onPress={() => router.navigate('/(tabs)/paketim')} />}
            {locked && (
              <View style={{ backgroundColor: 'rgba(192,57,43,0.08)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.25)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
                <T style={{ color: 'rgba(192,57,43,0.85)', fontSize: 11, lineHeight: 16.5 }}>Aşağıda bulunan Masa Detay bilgileri şuanda önizlemedir. Paket alarak eşleştiğinizde, gerçek zamanlı randevu bilgileri yer alacaktır.</T>
              </View>
            )}
            <LiveTabs tab={tab} statuses={statuses} onTab={selectTab} />
            <View>
              <Head title={locked ? 'Masa Detay Kartı' : CARD_TITLE[tab]} right={<BtnGhost label="Geçmiş Masalarım" onPress={() => setHistoryOpen(v => !v)} accessibilityState={{ expanded: historyOpen }} />} />
              {historyOpen && <HistoryList history={history} />}
              {tab === 'KANKA' && !tabItem && statuses.KANKA === 'SCANNING' && (
                <T style={{ marginBottom: 12, fontSize: 13, color: ll.text2, lineHeight: 21 }}>
                  Kankanla birlikte eşleşme taraması devam ediyor. Karşı cinsten bir kanka çiftiyle eşleştiğinizde masanız burada görünecek; detaylar Pazar 10:00&apos;da açıklanır. Tarama Cumartesi 23:59&apos;da kapanır.
                </T>
              )}
              {tabAdminCancelled ? (
                <Card><T style={{ fontSize: 14, lineHeight: 22.4, textAlign: 'center', color: tw.text }}>Masanız iptal edildi. Masa hakkınız hesabınıza iade edildi.</T></Card>
              ) : (
                <MasaBlock key={tab} item={tabItem} locked={locked} cardType={CARD_TYPE[tab]} userInfo={userInfo} kanka={kanka} width={colW} onCancelled={() => setTimeout(reload, 2000)} />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
