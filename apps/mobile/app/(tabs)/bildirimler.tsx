// Sekme 3 — Bildirimler (S-14). Webde karşılığı yok; satır Canlı Akış kart stilinde (LiveFeed): zaman + olay başlığı.
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { BtnGhost, Card, ErrorText, Head, Mono, Spinner, T, Glow } from '@/components/ui';
import { unreadBus } from './_layout';
import { ll, llColumn, tw, liveGlow } from '@/theme/theme';

interface Notif { id: string; title: string; body: string; data?: { event?: string } | null; read: boolean; createdAt: string }
interface Page { items: Notif[]; total: number; page: number; totalPages: number }
const LIMIT = 20;

function timeOf(iso: string) {
  const d = new Date(iso);
  const today = new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) === d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
  return today
    ? d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
    : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Istanbul' });
}

export default function Bildirimler() {
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

  async function open(n: Notif) {
    if (!n.read) {
      api.patch(`/notifications/${n.id}/read`).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      unreadBus.emit();
    }
    const ev = n.data?.event;
    if (ev === 'KYC_APPROVED' || ev === 'KYC_REJECTED') router.navigate({ pathname: '/(tabs)/profilim', params: { tab: 'kyc' } });
    else if (ev === 'MEETING_CONFIRMED' || ev === 'MEETING_PARTICIPANT_LEFT') router.navigate('/(tabs)/masalarim');
    else if (ev === 'SUBSCRIPTION_EXPIRING') router.navigate('/(tabs)/paketim');
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
            <Head title="Bildirimler" right={items.some((n) => !n.read) ? <BtnGhost label="Tümünü okundu işaretle" onPress={readAll} style={{ paddingHorizontal: 14 }} /> : undefined} />
            <ErrorText>{error}</ErrorText>
          </View>
        }
        ListEmptyComponent={<Card><T style={{ fontSize: 13, color: ll.label }}>Henüz bildirimin yok</T></Card>}
        renderItem={({ item: n, index }) => (
          <Pressable onPress={() => open(n)} style={[s.row, index === 0 && s.first, index === items.length - 1 && s.last]} accessibilityRole="button" accessibilityLabel={`${n.title}${n.read ? '' : ', okunmadı'}`}>
            <Mono style={{ fontSize: 10, color: ll.time, width: 38 }}>{timeOf(n.createdAt)}</Mono>
            <T style={{ flex: 1, fontSize: 11.5, lineHeight: 17, color: ll.text }}>{n.title}</T>
            {!n.read && <View style={s.dot} />}
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
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: ll.red2 },
});
