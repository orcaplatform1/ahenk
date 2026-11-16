import { defineRouting } from 'next-intl/routing';

// Türkçe mevcut adreslerde (önek yok), İngilizce /en önekiyle. Dil tespiti proxy.ts'de (hesap → çerez → tarayıcı dili)
export const routing = defineRouting({
  locales: ['tr', 'en'],
  defaultLocale: 'tr',
  localePrefix: 'as-needed',
  localeDetection: false,
  localeCookie: { name: 'NEXT_LOCALE', maxAge: 60 * 60 * 24 * 365 },
});
