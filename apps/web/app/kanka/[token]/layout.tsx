import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return pageMetadata({
    path: `/kanka/${token}`,
    title: 'Kanka Daveti',
    description: 'Ahenk Kankamla masasına davet edildiniz. Davet edildiğiniz telefon numarasıyla kayıt olun veya giriş yapın, daveti 48 saat içinde profilinizden kabul edin.',
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
