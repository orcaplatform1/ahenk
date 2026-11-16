'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatNamed, type Lang } from '@ahenk/shared';
import { panelCard, useVenuePanel } from '../context';

export default function AbonelikPage() {
  const { me } = useVenuePanel();
  const t = useTranslations();
  const locale = useLocale() as Lang;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 className="font-serif" style={{ fontSize: '1.6rem', margin: 0 }}>{t('vp.navSubscription')}</h1>
      <div style={panelCard}>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}>{t('vp.plan')}</p>
        <p style={{ margin: '0.15rem 0 0.9rem', fontSize: '1.1rem', color: '#ff6b6b', fontWeight: 600 }}>{t('vp.freePeriod')}</p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}>{t('vp.registeredAt')}</p>
        <p style={{ margin: '0.15rem 0 0', fontSize: '1rem' }}>
          {formatNamed(me.registeredAt, locale, { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}
