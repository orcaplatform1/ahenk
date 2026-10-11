'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#0a0a0a' }}>
      {/* Kırmızı glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(192,57,43,0.18) 0%, transparent 65%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center gap-4">
        <motion.h1
          className="font-serif leading-none"
          style={{
            fontSize: 'clamp(96px, 20vw, 160px)',
            background: 'linear-gradient(135deg,#c0392b,#ff6b6b)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 32px rgba(192,57,43,0.45))',
          }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          404
        </motion.h1>

        <motion.p
          className="font-serif text-xl text-[#f5f5f5]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Bu sayfa bulunamadı
        </motion.p>

        <motion.p
          className="text-sm text-[#555] max-w-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          Aradığın sayfa taşınmış veya silinmiş olabilir.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4, ease: 'easeOut' }}
          className="mt-2"
        >
          <Link href="/" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-medium text-white btn-grad">
            ← Ana Sayfaya Dön
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
