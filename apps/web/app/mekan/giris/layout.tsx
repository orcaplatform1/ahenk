import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/mekan/giris',
  title: 'Mekân Girişi',
  description: 'Ahenk mekân ortakları için ayrılmış giriş sayfası. Kayıtlı e-posta adresiniz ve şifrenizle mekân panelinize güvenli şekilde erişerek hesabınızı yönetin.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
