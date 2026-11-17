import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/topluluk-kurallari',
    title: 'Topluluk Kuralları',
    description: 'Ahenk topluluğunda herkesin güvende ve rahat hissetmesi için belirlenen kurallar. Buluşmalarda ve platformda beklenen davranış ilkelerini okuyabilirsin.',
    locale,
    en: { title: 'Community Guidelines', description: 'The guidelines that help everyone in the Ahenk community feel safe and at ease. Read the conduct expected at meetups and on the platform.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
