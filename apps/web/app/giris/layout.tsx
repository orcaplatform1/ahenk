import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/giris',
  title: 'Giriş Yap',
  description: 'Ahenk hesabınıza WhatsApp kodu veya e-posta ile güvenli şekilde giriş yapın, masalarınızı görüntüleyin ve size uygun insanlarla buluşmaya devam edin.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
