'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { ENGLISH_ENABLED, isLang } from '@ahenk/shared';
import { api } from '@/lib/api';
import { usePathname } from '@/i18n/navigation';
import { switchLocale } from '@/lib/locale';

// Dil belirleme 1. adımı: giriş yapmış kullanıcının hesabındaki dil. Sayfa dili hesaptakinden farklıysa
// çerez güncellenir ve aynı sayfanın o dildeki adresine geçilir (Türkçe önek yok, İngilizce /en)
export default function LocaleSync() {
  const locale = useLocale();
  const pathname = usePathname();
  useEffect(() => {
    if (!ENGLISH_ENABLED) return;
    const check = () => {
      if (!api.hasSession()) return;
      api.get<{ language?: string }>('/auth/me').then((u) => {
        if (!isLang(u?.language) || u.language === locale) return;
        // Tam sayfa geçişi (lib/locale switchLocale); hesaptaki dil zaten kayıtlı, yalnız çerez güncellenir
        switchLocale(u.language, pathname, { save: false });
      }).catch(() => undefined);
    };
    check();
    window.addEventListener('ahenk:auth', check);
    return () => window.removeEventListener('ahenk:auth', check);
  }, [locale, pathname]);
  return null;
}
