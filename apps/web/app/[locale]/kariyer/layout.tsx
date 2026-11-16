import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/kariyer',
    title: 'Kariyer',
    description: 'Ahenk ekibinde Şehir Operasyon Yetkilisi olarak mekan ortaklarıyla iletişim kurun, haftalık masa buluşmalarının sorunsuz ilerlemesini sağlayın ve başvurun.',
    locale,
    en: { title: 'Careers', description: 'Join the Ahenk team as a City Operations Officer: keep in touch with venue partners, keep weekly table meetups running smoothly and apply.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
