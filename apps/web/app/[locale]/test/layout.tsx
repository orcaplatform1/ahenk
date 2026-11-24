import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/test',
    title: 'Kişilik Testi',
    description: '19 soruluk OCEAN (Big Five) kişilik testini çöz. Sonuçlarına göre Ahenk seni her hafta sana uygun insanlarla aynı masada buluşturur.',
    locale,
    en: { title: 'Personality Test', description: 'Take the 19 question OCEAN (Big Five) personality test. Based on your results, Ahenk seats you with people who suit you every week.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
