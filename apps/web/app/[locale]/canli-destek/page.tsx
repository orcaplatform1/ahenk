'use client';

// Canlı Destek (üye): yalnız giriş yapmış üye; Profilim → "Canlı Destek"
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { SupportChatScreen } from '@/components/support/SupportChatScreen';

export default function CanliDestekPage() {
  const t = useTranslations();
  const router = useRouter();
  const [ok, setOk] = useState(false);
  useEffect(() => { if (!api.hasSession()) router.replace('/giris'); else setOk(true); }, [router]);
  if (!ok) return null;
  return (
    <main style={{ minHeight: '100dvh', background: '#121212', color: '#f4f1ec' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '1.25rem 1rem 3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <Link href="/profil" style={{ fontSize: 13, color: '#a39c93', minHeight: 44, display: 'flex', alignItems: 'center' }}>← {t('tabs.profil')}</Link>
          <h1 className="font-serif" style={{ fontSize: 26 }}>{t('sup.title')}</h1>
        </div>
        <SupportChatScreen mode="member" onExit={() => router.push('/profil')} />
      </div>
    </main>
  );
}
