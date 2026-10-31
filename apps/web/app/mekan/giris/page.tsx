'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { venueApi } from '@/lib/venueApi';

export default function MekanGirisPage() {
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
      router.push('/mekan/panel/kontenjan');
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-24" style={{ background: '#121212' }}>
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-4xl text-[#f5f5f5] text-center mb-2">Mekân Girişi</h1>
        <p className="text-[#666] text-sm text-center mb-8">Ahenk ortak mekân paneli</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input className="input-glass w-full px-4 py-3 text-sm" type="email" autoComplete="email" aria-label="E-posta" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input-glass w-full px-4 py-3 text-sm" type="password" autoComplete="current-password" aria-label="Şifre" placeholder="Şifre" maxLength={20} value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center disabled:opacity-70">
            {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>
        <div className="flex justify-between mt-5 text-xs">
          <Link href="/mekan/sifremi-unuttum" className="text-[#888]">Şifremi unuttum</Link>
          <Link href="/is-ortakligi" className="text-[#ff6b6b]">Mekânınızı kaydedin</Link>
        </div>
      </div>
    </main>
  );
}
