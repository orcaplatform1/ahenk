'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

export default function SifremiUnuttumPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) { setError('E-posta adresinizi girin.'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

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
          <h1 className="font-serif text-4xl text-[#f5f5f5]">Şifre Sıfırla</h1>
        </div>

        <AnimatePresence mode="wait">
          {!sent ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex flex-col gap-3"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="E-posta adresin"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="input-glass px-4 py-3.5 text-sm w-full"
              />
              {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-2.5 text-sm btn-grad mt-1"
              >
                {loading ? 'Gönderiliyor…' : 'Şimdi Sıfırla'}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="glass-card p-6 text-center flex flex-col items-center gap-4"
            >
              <div
                className="flex items-center justify-center"
                style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#c0392b,#ff6b6b)' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-[#f5f5f5] font-semibold mb-1">E-postanı kontrol et</p>
                <p className="text-[#666] text-sm">Sıfırlama bağlantısını <span className="text-[#888]">{email}</span> adresine gönderdik.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4">
          <Link
            href="/giris"
            className="w-full block text-center py-2.5 text-sm font-medium rounded-xl transition-all"
            style={{ border: '1px solid #c0392b', color: '#c0392b', background: 'transparent' }}
          >
            Girişe Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
