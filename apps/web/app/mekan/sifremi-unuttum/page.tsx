'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import OtpInput from '@/components/ui/OtpInput';
import { venueApi } from '@/lib/venueApi';

export default function MekanSifremiUnuttumPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await venueApi.post('/forgot-password', { email });
      setSent(true);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) { setError('6 haneli kodu girin.'); return; }
    if (password.length < 6 || password.length > 20) { setError('Şifre 6-20 karakter arasında olmalı.'); return; }
    if (password !== confirm) { setError('Şifreler eşleşmiyor.'); return; }
    setLoading(true); setError('');
    try {
      await venueApi.post('/reset-password', { email, code, newPassword: password });
      router.push('/mekan/giris');
    } catch (err) { setError((err as Error).message); setLoading(false); }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-24" style={{ background: '#121212' }}>
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-4xl text-[#f5f5f5] text-center mb-2">Şifre Sıfırla</h1>
        {!sent ? (
          <form onSubmit={sendCode} className="flex flex-col gap-3 mt-6">
            <p className="text-[#666] text-sm text-center">Mekân e-postanızı girin, kayıtlı WhatsApp numaranıza 6 haneli kod gönderelim.</p>
            <input className="input-glass w-full px-4 py-3 text-sm" type="email" aria-label="E-posta" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center disabled:opacity-70">{loading ? 'Gönderiliyor…' : 'Kod Gönder'}</button>
          </form>
        ) : (
          <form onSubmit={reset} className="flex flex-col gap-3 mt-6">
            <p className="text-[#666] text-sm text-center">Hesap varsa kayıtlı WhatsApp numarasına kod gönderildi.</p>
            <OtpInput value={code} onChange={setCode} />
            <input className="input-glass w-full px-4 py-3 text-sm" type="password" autoComplete="new-password" aria-label="Yeni şifre" placeholder="Yeni şifre (6-20 karakter)" maxLength={20} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <input className="input-glass w-full px-4 py-3 text-sm" type="password" autoComplete="new-password" aria-label="Yeni şifre tekrar" placeholder="Yeni şifre tekrar" maxLength={20} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center disabled:opacity-70">{loading ? 'Kaydediliyor…' : 'Şifreyi Güncelle'}</button>
          </form>
        )}
        <div className="text-center mt-5 text-xs"><Link href="/mekan/giris" className="text-[#888]">Girişe dön</Link></div>
      </div>
    </main>
  );
}
