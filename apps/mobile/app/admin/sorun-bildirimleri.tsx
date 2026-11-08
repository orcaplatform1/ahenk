// apps/web/app/admin/sorun-bildirimleri/page.tsx karşılığı (mobil salla-bildir ve web aynı listede)
import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '@/lib/api';
import { API_PREFIX } from '@/lib/config';
import { getAccess } from '@/lib/session';
import { Btn } from '@/components/ui';
import { AError, ALabel, APage, AT, ATable, ATableRow } from '@/components/admin/AdminUi';
import { adm } from '@/theme/theme';

type Platform = 'IOS' | 'ANDROID' | 'WEB';
const PLATFORM_LABEL: Record<Platform, string> = { IOS: 'iOS', ANDROID: 'Android', WEB: 'Web' };
interface ReportUser { id: string; profile: { firstName: string; lastName: string } | null }
interface ReportRow { id: string; platform: Platform; screen: string; description: string; createdAt: string; user: ReportUser }
interface ReportDetail extends ReportRow { appVersion: string | null; images: string[] }
const fmt = (iso: string) => new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const nameOf = (u: ReportUser) => (u.profile ? `${u.profile.firstName} ${u.profile.lastName}`.trim() : 'Silinmiş kullanıcı');

export default function AdminProblemReports() {
  const { id: openId } = useLocalSearchParams<{ id?: string }>();
  const [items, setItems] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    getAccess().then(setToken);
    api.get<ReportRow[]>('/admin/problem-reports').then(setItems).catch((e: Error) => setError(`Bildirimler yüklenemedi: ${e.message}`)).finally(() => setLoading(false));
    if (openId) open(openId);
  }, [openId]);
  function open(id: string) {
    setError('');
    api.get<ReportDetail>(`/admin/problem-reports/${id}`).then(setDetail).catch((e: Error) => setError(`Bildirim açılamadı: ${e.message}`));
  }
  const img = (r: ReportDetail, name: string) => ({ uri: `${API_PREFIX}/admin/problem-reports/${r.id}/images/${encodeURIComponent(name)}`, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  return (
    <APage>
      <AT w={700} style={{ fontSize: 20, marginBottom: 16 }}>Sorun Bildirimleri</AT>
      <AError>{error}</AError>
      {loading ? <AT style={{ color: adm.muted, fontSize: 13 }}>Yükleniyor…</AT> : items.length === 0 ? <AT style={{ color: adm.muted, fontSize: 13 }}>Henüz sorun bildirimi yok.</AT> : (
        <ATable>
          {items.map((r, i) => (
            <ATableRow key={r.id} last={i === items.length - 1} onPress={() => open(r.id)} cells={[
              ['Kullanıcı', nameOf(r.user)], ['Tarih', fmt(r.createdAt)], ['Platform', PLATFORM_LABEL[r.platform]], ['Ekran', r.screen],
              ['Açıklama', <AT key="d" numberOfLines={1} style={{ fontSize: 12, textAlign: 'right' }}>{r.description.split('\n')[0]}</AT>],
            ]} />
          ))}
        </ATable>
      )}
      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <Pressable onPress={() => setDetail(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          {detail && (
            <Pressable onPress={() => undefined} style={{ width: '100%', maxWidth: 640, maxHeight: '90%', backgroundColor: adm.surface, borderWidth: 1, borderColor: adm.border, borderRadius: 14, padding: 20 }}>
              <ScrollView>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <AT w={700} style={{ fontSize: 15 }}>Sorun Bildirimi</AT>
                  <Btn variant="admClose" label="×" accessibilityLabel="Kapat" onPress={() => setDetail(null)} />
                </View>
                {([['Kullanıcı', nameOf(detail.user)], ['Tarih-saat', fmt(detail.createdAt)], ['Platform', PLATFORM_LABEL[detail.platform]], ['Ekran / sayfa', detail.screen], ['Uygulama sürümü', detail.appVersion ?? '—']] as const).map(([k, v]) => (
                  <View key={k} style={{ flexDirection: 'row', gap: 12, paddingVertical: 4 }}>
                    <ALabel style={{ minWidth: 130 }}>{k.toLocaleUpperCase('tr-TR')}</ALabel>
                    <AT style={{ fontSize: 13, flex: 1 }}>{v}</AT>
                  </View>
                ))}
                <ALabel style={{ marginTop: 12, marginBottom: 4 }}>AÇIKLAMA</ALabel>
                <AT style={{ fontSize: 13 }}>{detail.description}</AT>
                {detail.images.length > 0 && (
                  <>
                    <ALabel style={{ marginTop: 12, marginBottom: 6 }}>GÖRSELLER</ALabel>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {detail.images.map(name => (
                        <Pressable key={name} onPress={() => setZoom(name)}>
                          <Image source={img(detail, name)} style={{ width: 120, height: 120, borderRadius: 8, borderWidth: 1, borderColor: adm.border }} accessibilityLabel="Sorun görseli" />
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
              </ScrollView>
            </Pressable>
          )}
        </Pressable>
      </Modal>
      <Modal visible={!!zoom && !!detail} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable onPress={() => setZoom(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          {zoom && detail && <Image source={img(detail, zoom)} style={{ width: '100%', height: '100%' }} resizeMode="contain" accessibilityLabel="Sorun görseli (büyük)" />}
        </Pressable>
      </Modal>
    </APage>
  );
}
