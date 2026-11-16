import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
  path: '/mekan/giris',
  title: 'Mekân Girişi',
  description: 'Ahenk mekân ortakları için ayrılmış giriş sayfası. Kayıtlı e-posta adresiniz ve şifrenizle mekân panelinize güvenli şekilde erişerek hesabınızı yönetin.',
  locale,
  en: { title: 'Venue Login', description: 'The login page for Ahenk partner venues. Securely access your venue panel with your registered email address and password to manage your account.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
