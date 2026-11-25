'use client';

import { isLang, type Lang } from '@ahenk/shared';
import { api } from '@/lib/api';
import { getPathname } from '@/i18n/navigation';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Seçilen dil: tarayıcıda çerez (NEXT_LOCALE, 1 yıl), giriş yapmışsa hesaba da kaydedilir
function storeLocale(lang: Lang) {
  document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  if (api.hasSession()) return api.patch('/users/me/language', { language: lang }).catch(() => undefined);
  return Promise.resolve(undefined);
}

// Aynı sayfanın diğer dildeki adresine TAM sayfa yüklemesiyle geçiş.
// Kök layout'taki NextIntlClientProvider (dil + metinler) [locale] dışında olduğu için istemci içi geçişte (router.replace)
// yeniden oluşturulmuyordu: sayfa /en'e geçince sağlayıcı "tr"de kalıyor, usePathname /en önekini silemiyor ve sonraki
// geçiş /en/en'e (404) gidiyordu. Tam yükleme ile sağlayıcı yeni dilde kurulur.
// path: dilsiz yol (next-intl usePathname). Geçersiz dil gelirse Türkçe.
export async function switchLocale(lang: string, path: string, opts: { save?: boolean } = {}) {
  const target: Lang = isLang(lang) ? lang : 'tr';
  if (opts.save === false) document.cookie = `NEXT_LOCALE=${target}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  else await storeLocale(target);
  const bare = stripLocalePrefix(path);
  const href = getPathname({ href: bare, locale: target });
  window.location.assign(`${href}${window.location.search}${window.location.hash}`);
}

// Güvenlik: yol hâlâ /en öneki taşıyorsa (eski sağlayıcı) önek silinir; /en/en gibi çift önek oluşmaz
function stripLocalePrefix(path: string): string {
  let p = path || '/';
  while (p === '/en' || p.startsWith('/en/')) p = p.slice(3) || '/';
  return p;
}
