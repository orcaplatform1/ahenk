// O anki arayüz dili <html lang>'tan (web kök layout locale'i yazar); API isteklerinde Accept-Language
export function documentLang(): 'tr' | 'en' {
  return typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'tr';
}
