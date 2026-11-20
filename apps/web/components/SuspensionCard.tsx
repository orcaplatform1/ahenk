'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Countdown } from '@/components/live/LiveLayer';

// Askı süresince Profilim'de profil fotoğrafının altında: "Hesabın askıya alındı", "Askının bitmesine" ve Eşleşme Paneli'ndeki
// geri sayım sayacının aynısı (aynı kart zemini, ll-serif 40). Süre bitince kart kendiliğinden kaybolur.
export function SuspensionCard({ until }: { until?: string | null }) {
  const t = useTranslations();
  const end = until ? Date.parse(until) : 0;
  const [active, setActive] = useState(() => end > Date.now());
  useEffect(() => {
    setActive(end > Date.now());
    if (!end) return;
    const id = setInterval(() => { if (Date.now() >= end) { setActive(false); clearInterval(id); } }, 1000);
    return () => clearInterval(id);
  }, [end]);
  if (!active) return null;
  return (
    <section className="ll-card" role="status" style={{ borderColor: 'rgba(232,162,122,0.22)', background: 'linear-gradient(160deg, rgba(214,69,58,0.14), rgba(255,255,255,0.02) 60%)', textAlign: 'center' }}>
      <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#f4f1ec' }}>{t('prof.suspendedTitle')}</p>
      <p className="ll-eyebrow">{t('prof.suspendedUntil')}</p>
      <Countdown day={0} targetAt={end} />
    </section>
  );
}
