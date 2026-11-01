import { pageMetadata } from '@/lib/seo';

export function generateMetadata({ params }: { params: { token: string } }) {
  return pageMetadata({
    path: `/kanka/${params.token}`,
    title: 'Kanka Daveti',
    description: 'Ahenk Kankamla masasına davet edildiniz. Davet edildiğiniz telefon numarasıyla kayıt olun veya giriş yapın, daveti 48 saat içinde profilinizden kabul edin.',
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
