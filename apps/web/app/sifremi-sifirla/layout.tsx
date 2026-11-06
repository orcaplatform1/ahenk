import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/sifremi-sifirla',
  title: 'Şifre Sıfırla',
  description: 'Ahenk hesabınız için size gönderilen kodu girin ve yeni şifrenizi belirleyin. İşlem tamamlandığında giriş sayfasına yönlendirilir, hesabınıza erişirsiniz.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
