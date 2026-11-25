'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BORDER, MUTED, TEXT, LABEL, MONO } from '@/lib/adminTheme';
import { actionLabel, fmtDate, PLATFORM_LABEL, type ScreenshotList } from '@/lib/screenshotAdmin';

// Kullanıcı detayı: ekran görüntüsü ihlal sayısı ve listesi (GET /admin/users/:id/screenshot-logs)
export function AdminScreenshotViolations({ userId }: { userId: string }) {
  const [data, setData] = useState<ScreenshotList | null>(null);
  useEffect(() => {
    setData(null);
    api.get<ScreenshotList>(`/admin/users/${userId}/screenshot-logs`).then(setData).catch(() => setData({ count: 0, items: [] }));
  }, [userId]);
  if (!data) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
      <span style={{ ...LABEL, color: MUTED }}>EKRAN GÖRÜNTÜSÜ İHLALLERİ: {data.count}</span>
      {data.items.map((it) => (
        <p key={it.id} style={{ margin: 0, fontSize: 11, color: TEXT }}>
          {it.nth}. ihlal · <span style={{ color: '#93c5fd' }}>{it.target.name}</span> · {PLATFORM_LABEL[it.platform] ?? it.platform}
          <span style={{ color: MUTED, fontFamily: MONO }}> · {fmtDate(it.createdAt)}</span> · <span style={{ color: MUTED }}>{it.nth === 1 && !it.adminAction ? 'Kullanıcıya uyarı gösterildi' : actionLabel(it.adminAction)}</span>
        </p>
      ))}
    </div>
  );
}
