'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import OtpInput from '@/components/ui/OtpInput';
import { venueApi } from '@/lib/venueApi';

export default function MekanSifremiUnuttumPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
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
      await venueApi.post('/forgot-password', { phone: `+90${phone}` });
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
      await venueApi.post('/reset-password', { phone: `+90${phone}`, code, newPassword: password });
      router.push('/mekan/giris');
    } catch (err) { setError((err as Error).message); setLoading(false); }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-24" style={{ background: '#121212' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <Image src="/logo.webp" alt="Ahenk" width={48} height={48} className="rounded-full" />
          <span className="font-sans font-semibold tracking-[0.12em] text-[#f5f5f5]" style={{ fontSize: '15px' }}>AHENK</span>
        </div>
        <h1 className="font-serif text-4xl text-[#f5f5f5] text-center mb-2">Şifre Sıfırla</h1>
        {!sent ? (
          <form onSubmit={sendCode} className="flex flex-col gap-3 mt-6">
            <p className="text-[#666] text-sm text-center">M. telefon numaranızı girin, WhatsApp numaranıza 6 haneli kod gönderelim.</p>
            {/* Üye şifre sıfırlamadaki telefon satırı */}
            <div className="flex gap-2">
              <div className="flex items-center px-4 text-[#a39c93] text-[13px] select-none shrink-0" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>+90</div>
              <input className="input-glass flex-1 px-4 py-3 text-sm" type="tel" inputMode="numeric" aria-label="Telefon" placeholder="5XX XXX XX XX" value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }} required />
            </div>
            {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}
            <button type="submit" disabled={loading || !(phone.length === 10 && phone.startsWith('5'))} className="btn-primary w-full justify-center disabled:opacity-70">{loading ? 'Gönderiliyor…' : 'Kod Gönder'}</button>
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
        <Link href="/mekan/giris" className="btn-ghost w-full justify-center mt-3">Girişe dön</Link>
      </div>
    </main>
  );
}
