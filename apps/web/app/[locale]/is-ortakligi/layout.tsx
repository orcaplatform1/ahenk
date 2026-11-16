import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/is-ortakligi',
    title: 'Mekan Ortaklığı',
    description: 'Ahenk mekan ortaklığı ile kimliği doğrulanmış kullanıcıları mekânınızda ağırlayın. Önceden planlanmış rezervasyonlarla çalışmak için başvuru formunu doldurun.',
    locale,
    en: { title: 'Venue Partnership', description: 'Host verified users at your venue with an Ahenk venue partnership. Fill in the application form to work with pre-planned reservations.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
