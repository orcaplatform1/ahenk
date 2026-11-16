import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
  path: '/mekan/sifremi-unuttum',
  title: 'Mekân Şifremi Unuttum',
  description: 'Ahenk mekân hesabınızın şifresini yenileyin. E-posta adresinizi girin, kayıtlı WhatsApp numaranıza gönderilen 6 haneli kodla yeni şifrenizi belirleyin.',
  locale,
  en: { title: 'Venue Forgot Password', description: 'Reset your Ahenk venue account password. Enter your phone number and set a new password with the 6-digit code sent to your registered WhatsApp number.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
