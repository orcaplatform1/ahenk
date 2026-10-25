'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function OdemeBasariliPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.push('/dashboard'), 3000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: '#0a0a0a' }}
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
    </div>
  );
}
