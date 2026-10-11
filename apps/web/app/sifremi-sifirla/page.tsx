'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

function SifremiSifirlaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (!password || !confirm) { setError('Tüm alanları doldurun.'); return; }
    if (password.length < 6 || password.length > 20) { setError('Şifre 6-20 karakter arasında olmalı.'); return; }
    if (password !== confirm) { setError('Şifreler eşleşmiyor.'); return; }
    if (!token) { setError('Bağlantı geçersiz veya süresi dolmuş.'); return; }

    setLoading(true); setError('');
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(true);
      setTimeout(() => router.push('/giris'), 2000);
    } catch {
      setError('Bağlantı geçersiz veya süresi dolmuş.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-0">
      <AnimatePresence mode="wait">
        {!success ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex flex-col gap-3"
          >
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Yeni şifre"
              autoFocus
              className="input-glass px-4 py-3.5 text-sm w-full"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(''); }}
              placeholder="Şifre tekrar"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="input-glass px-4 py-3.5 text-sm w-full"
            />
            {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3.5 text-sm btn-grad mt-1"
            >
              {loading ? 'Kaydediliyor…' : 'Şifremi Sıfırla'}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-5 py-4"
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 1], opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut', times: [0, 0.7, 1] }}
              className="flex items-center justify-center"
              style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#c0392b,#ff6b6b)' }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <motion.path
                  d="M6 16 L13 23 L26 10"
                  stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, delay: 0.3, ease: 'easeOut' }}
                />
              </svg>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.35 }}
              className="text-center"
            >
              <p className="text-[#f5f5f5] font-semibold mb-1">Şifren güncellendi</p>
              <p className="text-[#666] text-sm">Giriş sayfasına yönlendiriliyorsun…</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SifremiSifirlaPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center md:justify-start px-6 md:pt-[80px]"
      style={{ background: '#0a0a0a' }}
    >
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '70vw', height: '70vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.09) 0%, transparent 60%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative w-full max-w-sm" style={{ zIndex: 1 }}>
        <div className="mb-10 text-center">
          <div className="flex flex-col items-center gap-2 mb-6">
            <Image src="/logo.webp" alt="Ahenk" width={48} height={48} className="rounded-full" />
            <span className="font-sans font-semibold tracking-[0.12em] text-[#f5f5f5]" style={{ fontSize: '15px' }}>AHENK</span>
          </div>
          <h1 className="font-serif text-4xl text-[#f5f5f5] mb-2">Yeni Şifre</h1>
          <p className="text-[#555] text-sm">Hesabın için yeni bir şifre belirle.</p>
        </div>

        <Suspense fallback={null}>
          <SifremiSifirlaForm />
        </Suspense>

        <div className="mt-10 text-center">
          <Link href="/giris" className="text-xs text-[#444] hover:text-[#888] transition-colors tracking-wide">
            ← Girişe dön
          </Link>
        </div>
      </div>
    </div>
  );
}
