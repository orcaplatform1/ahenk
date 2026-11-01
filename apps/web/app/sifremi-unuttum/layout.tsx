import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/sifremi-unuttum',
  title: 'Şifremi Unuttum',
  description: 'Ahenk hesabınızın şifresini mi unuttunuz? Telefon numaranızı girin, size gönderilecek kod ile hesabınıza yeniden erişmek için yeni bir şifre oluşturun.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
