'use client';

import { useTranslations } from 'next-intl';

// Bakım modu açıkken üyelere gösterilen uyarı (admin ayarları → Bakım Modu)
export default function MaintenanceNotice() {
  const t = useTranslations();
  return (
    <div className="mb-4 rounded-2xl px-4 py-3" style={{ background: 'rgba(201,162,39,0.10)', border: '1px solid rgba(201,162,39,0.35)' }}>
      <p className="text-sm font-semibold mb-0.5" style={{ color: '#e0b84a' }}>{t('common.maintenanceTitle')}</p>
      <p className="text-xs text-[#ccc] leading-relaxed">
        {t('common.maintenanceBody')}
      </p>
    </div>
  );
}
