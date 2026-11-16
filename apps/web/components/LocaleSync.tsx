'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { ENGLISH_ENABLED, isLang } from '@ahenk/shared';
import { api } from '@/lib/api';
import { usePathname, useRouter } from '@/i18n/navigation';

// Dil belirleme 1. adımı: giriş yapmış kullanıcının hesabındaki dil. Sayfa dili hesaptakinden farklıysa
// çerez güncellenir ve aynı sayfanın o dildeki adresine geçilir (Türkçe önek yok, İngilizce /en)
export default function LocaleSync() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!ENGLISH_ENABLED) return;
    const check = () => {
      if (!api.hasSession()) return;
      api.get<{ language?: string }>('/auth/me').then((u) => {
        if (!isLang(u?.language) || u.language === locale) return;
        document.cookie = `NEXT_LOCALE=${u.language}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
        router.replace(pathname, { locale: u.language });
      }).catch(() => undefined);
    };
    check();
    window.addEventListener('ahenk:auth', check);
    return () => window.removeEventListener('ahenk:auth', check);
  }, [locale, pathname, router]);
  return null;
}
