'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';

export default function NotFound() {
  const router = useRouter();
  const [count, setCount] = useState(5);

  useEffect(() => {
    const t = setInterval(() => setCount(c => c - 1), 1000);
    const r = setTimeout(() => router.push('/'), 5000);
    return () => { clearInterval(t); clearTimeout(r); };
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#121212' }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(192,57,43,0.1) 0%, transparent 65%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center text-center gap-6 w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <Image src="/logo.webp" alt="Ahenk" width={48} height={48} className="rounded-full" />
          <span className="font-sans font-semibold tracking-[0.12em] text-[#f5f5f5]" style={{ fontSize: '15px' }}>AHENK</span>
        </div>

        {/* Kutu */}
        <div
          className="w-full rounded-2xl px-8 py-10 flex flex-col items-center gap-4"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="font-serif text-7xl font-bold" style={{ color: '#c0392b' }}>404</p>
          <p className="font-serif text-xl text-[#f5f5f5]">Sayfa Bulunamadı</p>
          <p className="text-sm text-[#555] leading-relaxed">Aradığın sayfa taşınmış veya silinmiş olabilir.</p>
          <p className="text-xs text-[#444] mt-2">{count} saniye içinde ana sayfaya yönlendirileceksiniz.</p>
        </div>
      </motion.div>
    </div>
  );
}
