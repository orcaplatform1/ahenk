// apps/web/app/admin/alerts/page.tsx karşılığı
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { Btn } from '@/components/ui';
import { ACard, AError, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { adm } from '@/theme/theme';

interface AlertItem { id: string; alertType: string; userId: string; user?: { profile?: { firstName?: string; lastName?: string } | null } | null; isRead: boolean; createdAt: string }
const ALERT_LABELS: Record<string, string> = {
  MISSED_GROUP_CYCLES: 'Grup masası üst üste kurulamadı', MISSED_ONEONE_CYCLES: 'Başbaşa masası üst üste kurulamadı', MISSED_KANKA_CYCLES: 'Kankamla masası üst üste kurulamadı',
  SOS_ALERT: 'Acil yardım talebi', BOT_NOT_FOUND: 'Uygun bot bulunamadı', PAYMENT_ISSUE: 'Ödeme veya iade elle kontrol gerektiriyor',
};

export default function AdminAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get<{ alerts: AlertItem[]; unreadCount: number }>('/admin/alerts').then(d => setAlerts(d.alerts ?? [])).catch((e: Error) => setError(`Uyarılar yüklenemedi: ${e.message}`)).finally(() => setLoading(false));
  }, []);
  async function markRead(id: string) {
    setError('');
    try { await api.patch(`/admin/alerts/${id}/read`, {}); setAlerts(a => a.map(x => (x.id === id ? { ...x, isRead: true } : x))); } catch (e) { setError(`Güncellenemedi: ${(e as Error).message}`); }
  }
  const unread = alerts.filter(a => !a.isRead).length;
  const head = (
    <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <ATitle>Uyarılar</ATitle>
      {!loading && unread > 0 && <AMono w={600} style={{ fontSize: 9, backgroundColor: adm.amber, color: '#000', borderRadius: 99, paddingVertical: 1, paddingHorizontal: 6, overflow: 'hidden' }}>{unread}</AMono>}
      {!loading && <AMono style={{ fontSize: 10, marginLeft: 'auto' }}>{alerts.length} kayıt</AMono>}
    </View>
  );
  return (
    <APage maxWidth={760}>
      <View style={{ marginBottom: 24 }}><ATitle>Uyarılar</ATitle></View>
      <AError>{error}</AError>
      <ACard style={{ padding: 0, overflow: 'hidden' }}>
        {head}
        {loading ? <View style={{ paddingVertical: 24, paddingHorizontal: 20 }}><AMono style={{ fontSize: 13 }}>Yükleniyor…</AMono></View>
          : alerts.length === 0 ? (
            <View style={{ paddingVertical: 40, paddingHorizontal: 20, alignItems: 'center' }}>
              <AT style={{ fontSize: 32, marginBottom: 10 }}>✅</AT>
              <AT w={600} style={{ fontSize: 13, color: adm.green }}>Bekleyen uyarı yok</AT>
              <AMono style={{ marginTop: 4, fontSize: 11 }}>Tüm eşleşmeler nominal</AMono>
            </View>
          ) : alerts.map((a, i) => (
            <View key={a.id} style={{ paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: i < alerts.length - 1 ? 1 : 0, borderBottomColor: 'rgba(26,58,92,0.5)', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, backgroundColor: a.isRead ? 'transparent' : 'rgba(245,158,11,0.05)', opacity: a.isRead ? 0.55 : 1 }}>
              <View style={{ flex: 1 }}>
                <AT w={600} style={{ fontSize: 13 }}>{ALERT_LABELS[a.alertType] ?? a.alertType}{a.user?.profile ? `: ${a.user.profile.firstName ?? ''} ${a.user.profile.lastName ?? ''}` : ''}</AT>
                <AMono style={{ marginTop: 2, fontSize: 10 }}>{new Date(a.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</AMono>
              </View>
              {!a.isRead && <Btn variant="admSmall" label="Okundu" onPress={() => markRead(a.id)} />}
            </View>
          ))}
      </ACard>
    </APage>
  );
}
