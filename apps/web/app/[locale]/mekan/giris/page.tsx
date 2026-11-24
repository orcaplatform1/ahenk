'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { venueApi } from '@/lib/venueApi';
import { StdButton } from '@ahenk/ui';

export default function MekanGirisPage() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await venueApi.post('/login', { email, password });
      router.push('/mekan/panel/bilgiler');
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-24" style={{ background: '#121212' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <Image src="/logo-welcome.webp" alt="Ahenk" width={48} height={48} />
        </div>
        <h1 className="font-serif text-4xl text-[#f5f5f5] text-center mb-2">{t('vp.loginTitle')}</h1>
        <p className="text-[#666] text-sm text-center mb-8">{t('vp.loginSub')}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input className="input-glass w-full px-4 py-3 text-sm" type="email" autoComplete="email" aria-label={t('vp.email')} placeholder={t('vp.email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input-glass w-full px-4 py-3 text-sm" type="password" autoComplete="current-password" aria-label={t('vp.password')} placeholder={t('vp.password')} maxLength={20} value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}
          <StdButton variant="primary" type="submit" disabled={loading} className="w-full justify-center disabled:opacity-70">
            {loading ? t('vp.loggingIn') : t('vp.loginBtn')}
          </StdButton>
        </form>
        <div className="flex justify-between mt-5 text-xs">
          <Link href="/mekan/sifremi-unuttum" className="text-[#888]">{t('vp.forgot')}</Link>
          <Link href="/is-ortakligi" className="text-[#ff6b6b]">{t('vp.registerVenue')}</Link>
        </div>
      </div>
    </main>
  );
}
