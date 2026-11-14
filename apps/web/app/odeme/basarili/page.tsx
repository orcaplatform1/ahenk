'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { trackConfirmedPurchase } from '@/lib/analytics';
import { api } from '@/lib/api';
import { mountIyzicoForm } from '@/lib/checkout';
import TcknModal from '@/components/paket/TcknModal';

export default function OdemeBasariliPage() {
  const router = useRouter();

  useEffect(() => {
    void trackConfirmedPurchase();
  }, []);

  // Prime: otomatik yenileme için iyzico abonelik formu (T.C. No her web ödemesinde yeniden sorulur)
  const [primeTc, setPrimeTc] = useState(false);
  const [primeBusy, setPrimeBusy] = useState(false);
  const [primeError, setPrimeError] = useState('');
  const [waitPrime, setWaitPrime] = useState(true);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('prime') === '1') setPrimeTc(true);
    setWaitPrime(false);
  }, []);

  useEffect(() => {
    if (waitPrime || primeTc) return;
    const t = setTimeout(() => router.push('/dashboard'), 3000);
    return () => clearTimeout(t);
  }, [router, waitPrime, primeTc]);

  async function startAutoRenew(identityNumber: string) {
    setPrimeBusy(true); setPrimeError('');
    try {
      const d = await api.post<{ checkoutFormContent: string }>('/payment/prime/autorenew/init', { identityNumber });
      mountIyzicoForm(d.checkoutFormContent);
    } catch (e) {
      setPrimeError((e as Error).message);
    } finally {
      setPrimeBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: '#121212' }}
    >
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '70vw', height: '70vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.12) 0%, transparent 60%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative flex flex-col items-center text-center gap-6" style={{ zIndex: 1 }}>
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.2, 1], opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut', times: [0, 0.7, 1] }}
          className="flex items-center justify-center"
          style={{ width: 96, height: 96, borderRadius: '50%', background: 'linear-gradient(135deg,#c0392b,#ff6b6b)' }}
        >
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <motion.path
              d="M9 22 L19 32 L35 14"
              stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, delay: 0.35, ease: 'easeOut' }}
            />
          </svg>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4, ease: 'easeOut' }}
          className="font-serif text-4xl text-[#f5f5f5]"
        >
          Paketini aldın!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75, duration: 0.4 }}
          className="text-[#777] text-sm"
        >
          Artık masalara katılabilirsin.
        </motion.p>

        <motion.button
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.35, ease: 'easeOut' }}
          onClick={() => router.push('/dashboard')}
          className="btn-primary mt-2"
        >
          Dashboard&apos;a Git
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.3 }}
          className="text-[#444] text-xs"
        >
          3 saniye içinde otomatik yönlendirileceksin…
        </motion.p>
      </div>
      <TcknModal open={primeTc} busy={primeBusy} error={primeError} onCancel={() => setPrimeTc(false)} onSubmit={startAutoRenew} />
    </div>
  );
}
