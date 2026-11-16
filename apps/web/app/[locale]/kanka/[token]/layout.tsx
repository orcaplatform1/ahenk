import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ token: string; locale: string }> }) {
  const { token, locale } = await params;
  return pageMetadata({
    path: `/kanka/${token}`,
    title: 'Kanka Daveti',
    description: 'Ahenk Kankamla masasına davet edildiniz. Davet edildiğiniz telefon numarasıyla kayıt olun veya giriş yapın, daveti 48 saat içinde profilinizden kabul edin.',
    locale,
    en: { title: 'Kanka Invite', description: 'You’ve been invited to an Ahenk Bring a Buddy table. Sign up or log in with the phone number you were invited with, then accept the invite from your profile within 48 hours.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
