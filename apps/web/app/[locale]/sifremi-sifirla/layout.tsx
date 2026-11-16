import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/sifremi-sifirla',
    title: 'Şifre Sıfırla',
    description: 'Ahenk hesabınız için size gönderilen kodu girin ve yeni şifrenizi belirleyin. İşlem tamamlandığında giriş sayfasına yönlendirilir, hesabınıza erişirsiniz.',
    locale,
    en: { title: 'Reset Password', description: 'Enter the code we sent you and set a new password for your Ahenk account. When you’re done, you’ll be taken to the login page.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
