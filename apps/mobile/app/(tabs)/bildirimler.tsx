// Sekme 3 — Bildirimler (S-14). Webde karşılığı yok; satır Canlı Akış kart stilinde (LiveFeed): zaman + olay başlığı.
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { StdButton, Card, ErrorText, Head, Mono, Spinner, T, Glow, ScreenGlow } from '@/components/ui';
import { unreadBus } from './_layout';
import { c, ll, llColumn, tw, liveGlow } from '@/theme/theme';
import { KycNoticeCard } from '@/components/KycNoticeCard';

import { formatDateTime } from '@ahenk/shared';
import { useTranslation } from 'react-i18next';
interface Notif { id: string; title: string; body: string; data?: { event?: string; type?: string; meetingId?: string } | null; read: boolean; createdAt: string }
interface Page { items: Notif[]; total: number; page: number; totalPages: number }
// Backend kullanıcı başına son 25 bildirimi tutar; ekranda son 25 bildirim (tek sayfa)
const LIMIT = 25;

// GG.AA.YYYY SS:DD (Türkiye saati, Europe/Istanbul; iki dilde aynı sayısal biçim)
const timeOf = (iso: string) => formatDateTime(iso);

export default function Bildirimler() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Notif[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (p: number) => {
    try {
      const r = await api.get<Page>(`/notifications?page=${p}&limit=${LIMIT}`);
      setItems((prev) => (p === 1 ? r.items : [...prev, ...r.items.filter((n) => !prev.some((x) => x.id === n.id))]));
      setPage(r.page); setTotalPages(r.totalPages); setError('');
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(1); }, [load]);
  // Sayfa açılınca: User.lastNotificationsSeenAt güncellenir → alt menüde sayı kaybolur, okunmamış varsa nokta kalır
  useFocusEffect(useCallback(() => {
    api.patch('/notifications/seen').then(() => unreadBus.emit()).catch(() => {});
  }, []));

  async function open(n: Notif) {
    if (!n.read) {
      api.patch(`/notifications/${n.id}/read`).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      unreadBus.emit();
    }
    // Backend bildirim türleri: data.event (notification.service, winback) veya data.type (sendToUser çağrıları)
    const ev = n.data?.event ?? n.data?.type;
    switch (ev) {
      case 'KYC_APPROVED': case 'KYC_REJECTED': case 'KYC_SUSPICIOUS':
        router.navigate({ pathname: '/(tabs)/profilim', params: { tab: 'kyc' } }); break;
      case 'MEETING_CONFIRMED': case 'MEETING_PARTICIPANT_LEFT': case 'PARTICIPANT_LEFT': case 'MEETING_NOT_FORMED': case 'MEETING_CANCELLED_BY_ADMIN':
      case 'CYCLE_CLOSING_SOON': case 'NO_SHOW_MARK': case 'KANKA_CANCELLED': case 'KANKA_PAIR_LEFT':
        router.navigate('/(tabs)/masalarim'); break;
      case 'REVIEW_OPEN':
        if (n.data?.meetingId) router.push(`/degerlendirme/${n.data.meetingId}`); else router.navigate('/(tabs)/masalarim'); break;
      case 'KANKA_INVITE': case 'KANKA_ACCEPTED': case 'KANKA_ENDED':
        router.navigate({ pathname: '/(tabs)/profilim', params: { tab: 'profil' } }); break;
      case 'SUBSCRIPTION_EXPIRING': case 'REFERRAL_REGISTERED': case 'WEEKLY_MASA': case 'WINBACK_REMINDER':
        router.navigate('/(tabs)/paketim'); break;
      case 'PROBLEM_REPORT':
        router.push('/admin/sorun-bildirimleri'); break;
    }
  }

  async function readAll() {
    try {
      await api.patch('/notifications/read-all');
      setItems((prev) => prev.map((x) => ({ ...x, read: true })));
      unreadBus.emit();
    } catch (e) { setError((e as Error).message); }
  }

  if (loading) return <View style={{ flex: 1, backgroundColor: ll.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><Glow /><Spinner /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden' }}>
      <ScreenGlow />
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(1)} tintColor={tw.primary} />}
        onEndReached={() => { if (page < totalPages) load(page + 1); }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ paddingTop: insets.top + llColumn.padTop, paddingHorizontal: llColumn.padH, paddingBottom: llColumn.padBottom, maxWidth: llColumn.maxWidth, width: '100%', alignSelf: 'center' }}
        ListHeaderComponent={
          <View>
            {/* Işıma listenin içeriğinde: üst dolgu ve yan dolgu kadar kaydırılarak içeriğin sağ üst köşesine hizalanır */}
            <Glow top={liveGlow.offset - insets.top - llColumn.padTop} right={liveGlow.offset - llColumn.padH} />
            <View style={{ marginBottom: 16 }}><KycNoticeCard /></View>
            <Head title={t('tabs.notifications')} right={items.some((n) => !n.read) ? <StdButton variant="ghost" label={t('notif.readAll')} onPress={readAll} style={{ paddingHorizontal: 14 }} /> : undefined} />
            <ErrorText>{error}</ErrorText>
          </View>
        }
        ListEmptyComponent={<Card><T style={{ fontSize: 13, color: ll.label }}>{t('notif.empty')}</T></Card>}
        renderItem={({ item: n, index }) => (
          <Pressable onPress={() => open(n)} style={[s.row, index === 0 && s.first, index === items.length - 1 && s.last]} accessibilityRole="button" accessibilityLabel={`${n.title}${n.read ? '' : t('notif.unreadSuffix')}`}>
            <Mono style={{ fontSize: 10, color: ll.time }}>{timeOf(n.createdAt)}</Mono>
            <T style={{ flex: 1, fontSize: 11.5, lineHeight: 17, color: ll.text }}>{n.title}</T>
            <View style={[s.dot, n.read && s.dotRead]} />
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 44, paddingVertical: 6, paddingHorizontal: 18, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.025)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  first: { borderTopWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 18 },
  last: { borderBottomColor: 'rgba(255,255,255,0.08)', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, paddingBottom: 18 },
  // Okunmamış: kırmızı, okunmuş: yeşil
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: ll.red2 },
  dotRead: { backgroundColor: c.green },
});
