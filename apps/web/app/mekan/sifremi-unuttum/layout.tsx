import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/mekan/sifremi-unuttum',
  title: 'Mekân Şifremi Unuttum',
  description: 'Ahenk mekân hesabınızın şifresini yenileyin. E-posta adresinizi girin, kayıtlı WhatsApp numaranıza gönderilen 6 haneli kodla yeni şifrenizi belirleyin.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
