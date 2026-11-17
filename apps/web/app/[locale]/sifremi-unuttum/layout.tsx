import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/sifremi-unuttum',
    title: 'Şifremi Unuttum',
    description: 'Ahenk hesabının şifresini mi unuttun? Telefon numaranı gir, sana gönderilecek kod ile hesabına yeniden erişmek için yeni bir şifre oluştur.',
    locale,
    en: { title: 'Forgot Password', description: 'Forgot your Ahenk password? Enter your phone number and create a new password with the code we send you to get back into your account.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
