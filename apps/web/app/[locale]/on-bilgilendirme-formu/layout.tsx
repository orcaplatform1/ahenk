import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/on-bilgilendirme-formu',
    title: 'Ön Bilgilendirme Formu',
    description: 'Ahenk paket ve Premium abonelik satın alımları için satıcı bilgileri, hizmetin temel nitelikleri, fiyat, ödeme şekli, cayma hakkı ve şikâyet yolları.',
    locale,
    en: { title: 'Pre-Information Form', description: 'Seller details, main features of the service, price, payment method, right of withdrawal and complaint channels for Ahenk package and Premium subscription purchases.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
