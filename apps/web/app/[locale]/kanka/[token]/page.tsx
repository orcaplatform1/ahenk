'use client';

import { use, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { API_PREFIX, api, langHeaders } from '@/lib/api';
import { StdButton } from '@ahenk/ui';

// Kanka davet linki: sadece yönlendirme. Davet, davet edilen telefon numarasına bağlıdır; kabul Profilim'den,
// WhatsApp koduyla doğrulanmış o numarayla yapılır. Bu linkle kayıt olan davet indirimi kazanmaz.
const MALE_CLR = '#4fc3f7';
const FEMALE_CLR = '#f48fb1';

export default function KankaDavetPage({ params }: { params: Promise<{ token: string }> }) {
  const t = useTranslations();
  const { token } = use(params);
  const [info, setInfo] = useState<{ valid: boolean; inviterInitials: string | null; inviterGender: string | null } | null>(null);
  const loggedIn = typeof window !== 'undefined' && api.hasSession();

  useEffect(() => {
    fetch(`${API_PREFIX}/kanka/link/${encodeURIComponent(token)}`, { headers: langHeaders() })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo({ valid: false, inviterInitials: null, inviterGender: null }));
  }, [token]);

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
            <h1 className="font-serif text-3xl text-[#f5f5f5]">{t('kankaInv.title')}</h1>
            <p className="text-sm text-[#aaa] leading-relaxed">
              {t('kankaInv.invitedPre')} <strong className="text-[#f5f5f5]">{info.inviterInitials}</strong> {t('kankaInv.invitedPost')}
              {t('kankaInv.onePays')}
            </p>
            <p className="text-xs text-[#666] leading-relaxed">
              {t('kankaInv.howAccept')}
              {t('kankaInv.kycNeeded')}
              <br />
              {t('kankaInv.valid48')}
            </p>
            {loggedIn ? (
              <StdButton variant="primary" as={Link} href="/profil?tab=profil" className="justify-center w-full">{t('kankaInv.goProfile')}</StdButton>
            ) : (
              <div className="flex flex-col gap-2 w-full">
                <StdButton variant="primary" as={Link} href="/kayit" className="justify-center">{t('kankaInv.register')}</StdButton>
                <StdButton variant="ghost" as={Link} href="/giris" className="justify-center">{t('kankaInv.login')}</StdButton>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="font-serif text-3xl text-[#f5f5f5]">{t('kankaInv.invalid')}</h1>
            <p className="text-sm text-[#aaa] leading-relaxed">{t('kankaInv.invalidBody')}</p>
            <StdButton variant="ghost" as={Link} href="/" className="justify-center w-full">{t('kankaInv.home')}</StdButton>
          </>
        )}
      </div>
    </div>
  );
}
