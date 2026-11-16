import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { ENGLISH_ENABLED } from '@ahenk/shared';
import { routing } from '@/i18n/routing';
import LocaleSync from '@/components/LocaleSync';
import { OnboardingHost } from '@/components/Onboarding';

// Kullanıcı sayfaları: Türkçe önek yok, İngilizce /en. Admin ve mekân paneli bu klasörün dışında (Türkçe)
export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale) || (!ENGLISH_ENABLED && locale !== 'tr')) notFound();
  setRequestLocale(locale);
  return (
    <>
      <LocaleSync />
      {/* Kayıttan sonra bir kez tanıtım ("Nasıl Çalışır") */}
      <OnboardingHost />
      {children}
    </>
  );
}
