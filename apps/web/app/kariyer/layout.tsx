import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/kariyer',
  title: 'Kariyer',
  description: 'Ahenk ekibinde Şehir Operasyon Yetkilisi olarak mekan ortaklarıyla iletişim kurun, haftalık masa buluşmalarının sorunsuz ilerlemesini sağlayın ve başvurun.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
