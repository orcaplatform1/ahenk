import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/test/sonuc',
    title: 'Kişilik Testi Sonucu',
    description: 'OCEAN kişilik testi sonucun: beş boyuttaki puanların ve kişiliğinin kısa açıklaması. Ahenk eşleştirmesi bu sonuca göre yapılır.',
    locale,
    en: { title: 'Personality Test Result', description: 'Your OCEAN personality test result: your scores on five dimensions and a short description of your personality, used for Ahenk matching.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
