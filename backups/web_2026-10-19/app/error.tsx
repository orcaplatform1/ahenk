'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';

export default function ErrorPage({ error }: { error: Error & { digest?: string } }) {
  const router = useRouter();
  const [count, setCount] = useState(5);

  useEffect(() => {
    const t = setInterval(() => setCount(c => c - 1), 1000);
    const r = setTimeout(() => router.push('/'), 5000);
    return () => { clearInterval(t); clearTimeout(r); };
  }, [router]);

  const is404 = error?.message?.includes('404') || error?.digest?.includes('404');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#0a0a0a' }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(192,57,43,0.1) 0%, transparent 65%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center text-center gap-6 w-full max-w-sm"
      >
        <div className="flex flex-col items-center gap-2">
          <Image src="/logo.webp" alt="Ahenk" width={48} height={48} className="rounded-full" />
          <span className="font-sans font-semibold tracking-[0.12em] text-[#f5f5f5]" style={{ fontSize: '15px' }}>AHENK</span>
        </div>

        <div
          className="w-full rounded-2xl px-8 py-10 flex flex-col items-center gap-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="font-serif text-7xl font-bold" style={{ color: '#c0392b' }}>
            {is404 ? '404' : '500'}
          </p>
          <p className="font-serif text-xl text-[#f5f5f5]">
            {is404 ? 'Sayfa Bulunamadı' : 'Bir Sorun Oluştu'}
          </p>
          <p className="text-sm text-[#555] leading-relaxed">
            {is404 ? 'Aradığın sayfa taşınmış veya silinmiş olabilir.' : 'Beklenmedik bir hata meydana geldi. Ekibimiz bilgilendirildi.'}
          </p>
          <p className="text-xs text-[#444] mt-2">{count} saniye içinde ana sayfaya yönlendirileceksiniz.</p>
        </div>
      </motion.div>
    </div>
  );
}
