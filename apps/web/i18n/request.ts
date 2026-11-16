import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { ENGLISH_ENABLED, messagesEn, messagesTr } from '@ahenk/shared';
import { routing } from './routing';

// Admin ve mekân paneli [locale] dışında: istek dili yoksa Türkçe. ENGLISH_ENABLED = false iken her durumda Türkçe.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = ENGLISH_ENABLED && hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return { locale, messages: locale === 'en' ? messagesEn : messagesTr, timeZone: 'Europe/Istanbul' };
});
