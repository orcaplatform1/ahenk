'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_PREFIX, api } from '@/lib/api';

// Kanka davet linki: sadece yönlendirme. Davet, davet edilen telefon numarasına bağlıdır; kabul Profilim'den,
// WhatsApp koduyla doğrulanmış o numarayla yapılır. Bu linkle kayıt olan davet indirimi kazanmaz.
const MALE_CLR = '#4fc3f7';
const FEMALE_CLR = '#f48fb1';

export default function KankaDavetPage({ params }: { params: { token: string } }) {
  const [info, setInfo] = useState<{ valid: boolean; inviterInitials: string | null; inviterGender: string | null } | null>(null);
  const loggedIn = typeof window !== 'undefined' && api.hasSession();

  useEffect(() => {
    fetch(`${API_PREFIX}/kanka/link/${encodeURIComponent(params.token)}`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo({ valid: false, inviterInitials: null, inviterGender: null }));
  }, [params.token]);

  const clr = info?.inviterGender === 'FEMALE' ? FEMALE_CLR : MALE_CLR;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#121212' }}>
      <div className="flex flex-col items-center text-center gap-5" style={{ maxWidth: 420 }}>
        {!info ? (
          <div className="w-8 h-8 rounded-full border-2 border-[#c0392b] border-t-transparent animate-spin" />
        ) : info.valid ? (
          <>
            <span style={{ width: 72, height: 72, borderRadius: '50%', border: `2px solid ${clr}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#f5f5f5', background: 'rgba(255,255,255,0.06)' }}>
              {info.inviterInitials}
            </span>
            <h1 className="font-serif text-3xl text-[#f5f5f5]">Kanka davetin var</h1>
            <p className="text-sm text-[#aaa] leading-relaxed">
              <strong className="text-[#f5f5f5]">{info.inviterInitials}</strong> seni Ahenk&apos;te Kankamla için kanka olmaya davet etti.
              Kankamla paketini birinizin alması yeterli; diğeri ücretsiz katılır.
            </p>
            <p className="text-xs text-[#666] leading-relaxed">
              Daveti, davet edilen telefon numarasıyla giriş yapıp Profilim → Aktif Kankanız bölümünden kabul edebilirsin.
              Kanka olmak için kimlik doğrulaman (KYC) tamamlanmış olmalı. Davet 48 saat geçerlidir.
            </p>
            {loggedIn ? (
              <Link href="/profil?tab=profil" className="btn-primary justify-center w-full">Profilim&apos;e Git</Link>
            ) : (
              <div className="flex flex-col gap-2 w-full">
                <Link href="/kayit" className="btn-primary justify-center">Kayıt Ol</Link>
                <Link href="/giris" className="btn-ghost justify-center">Giriş Yap</Link>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="font-serif text-3xl text-[#f5f5f5]">Davet geçerli değil</h1>
            <p className="text-sm text-[#aaa] leading-relaxed">Bu kanka davetinin süresi dolmuş ya da geri çekilmiş. Davet edenden yeni bir davet göndermesini isteyebilirsin.</p>
            <Link href="/" className="btn-ghost justify-center w-full">Ana Sayfa</Link>
          </>
        )}
      </div>
    </div>
  );
}
