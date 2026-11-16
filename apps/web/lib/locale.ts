'use client';

import type { Lang } from '@ahenk/shared';
import { api } from '@/lib/api';

// Seçilen dil: tarayıcıda çerez (NEXT_LOCALE, 1 yıl), giriş yapmışsa hesaba da kaydedilir
export function storeLocale(lang: Lang) {
  document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  if (api.hasSession()) api.patch('/users/me/language', { language: lang }).catch(() => undefined);
}
