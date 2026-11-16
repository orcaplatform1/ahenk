// Mobil çeviri altyapısı (i18next + react-i18next + expo-localization). Metinler yalnız packages/shared/src/i18n/tr.json ve en.json'da.
// Dil sırası: 1) hesabın dili (/auth/me language), 2) cihazda kayıtlı seçim (AsyncStorage), 3) cihaz dili tr ise Türkçe, değilse English.
// ENGLISH_ENABLED = false iken her durumda Türkçe.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENGLISH_ENABLED, messagesEn, messagesTr, resolveLanguage, isLang, type Lang } from '@ahenk/shared';

const STORE_KEY = 'ahenk_language';

function deviceLanguage(): string | null {
  try { return getLocales()[0]?.languageCode ?? null; } catch { return null; }
}

i18n.use(initReactI18next).init({
  resources: { tr: { translation: messagesTr }, en: { translation: messagesEn } },
  lng: resolveLanguage({ device: deviceLanguage() }),
  fallbackLng: 'tr',
  // Metinlerde değişken {ad} biçiminde (web next-intl ile aynı)
  interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
  returnNull: false,
});

// Açılışta cihazda kayıtlı seçim okunur
AsyncStorage.getItem(STORE_KEY).then((stored) => {
  const lang = resolveLanguage({ stored, device: deviceLanguage() });
  if (lang !== i18n.language) i18n.changeLanguage(lang);
}).catch(() => undefined);

export const currentLang = (): Lang => (i18n.language === 'en' ? 'en' : 'tr');
// Büyük harfe çevirme arayüz dilinin kurallarıyla (Türkçede i → İ, İngilizcede i → I)
export const upper = (s: string) => s.toLocaleUpperCase(currentLang() === 'en' ? 'en-US' : 'tr-TR');

// Giriş yapmış kullanıcının hesabındaki dil (en yüksek öncelik)
export function applyAccountLanguage(account?: string | null) {
  if (!ENGLISH_ENABLED || !isLang(account)) return;
  if (account !== i18n.language) i18n.changeLanguage(account);
  AsyncStorage.setItem(STORE_KEY, account).catch(() => undefined);
}

// Kullanıcının seçimi: cihazda saklanır, oturum varsa hesaba da kaydedilir (api tarafından)
export async function chooseLanguage(lang: Lang) {
  if (!ENGLISH_ENABLED) return;
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(STORE_KEY, lang).catch(() => undefined);
}

export default i18n;
