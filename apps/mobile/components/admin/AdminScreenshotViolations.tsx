// Kullanıcı detayı (mobil admin): ekran görüntüsü ihlal sayısı ve listesi (GET /admin/users/:id/screenshot-logs); web karşılığı
// components/AdminScreenshotViolations.tsx
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { ALabel, AT } from './AdminUi';
import { adm } from '@/theme/theme';
import { fmtDate, PLATFORM_LABEL, statusLabel, type ScreenshotList } from '@/lib/screenshotAdmin';

export function AdminScreenshotViolations({ userId }: { userId: string }) {
  const [data, setData] = useState<ScreenshotList | null>(null);
  useEffect(() => {
    setData(null);
    api.get<ScreenshotList>(`/admin/users/${userId}/screenshot-logs`).then(setData).catch(() => setData({ count: 0, items: [] }));
  }, [userId]);
  if (!data) return null;
  return (
    <View style={{ gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: adm.border }}>
      <ALabel style={{ color: adm.muted }}>{`EKRAN GÖRÜNTÜSÜ İHLALLERİ: ${data.count}`}</ALabel>
      {data.items.map((it) => (
        <AT key={it.id} style={{ fontSize: 11 }}>
          {it.nth}. ihlal · <AT style={{ fontSize: 11, color: '#93c5fd' }}>{it.target.name}</AT> · {PLATFORM_LABEL[it.platform] ?? it.platform}
          <AT style={{ fontSize: 11, color: adm.muted }}> · {fmtDate(it.createdAt)} · {statusLabel(it)}</AT>
        </AT>
      ))}
    </View>
  );
}
