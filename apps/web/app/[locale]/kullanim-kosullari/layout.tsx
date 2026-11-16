import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/kullanim-kosullari',
    title: 'Kullanım Koşulları',
    description: 'Ahenk platformunu kullanmadan önce okumanız gereken kullanım koşulları. Üyelik, paketler, rezervasyon ve iptal kurallarına ilişkin hükümleri inceleyin.',
    locale,
    en: { title: 'Terms of Use', description: 'The terms of use to read before using Ahenk. Review the provisions on membership, packages, reservations and cancellations.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
