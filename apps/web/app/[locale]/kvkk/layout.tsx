import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/kvkk',
    title: 'KVKK Aydınlatma Metni',
    description: '6698 Sayılı Kişisel Verilerin Korunması Kanunu kapsamında Ahenk aydınlatma metni. Kişisel verilerinizin işlenmesine ve haklarınıza ilişkin bilgileri inceleyin.',
    locale,
    en: { title: 'KVKK Privacy Notice', description: 'Ahenk’s privacy notice under Turkish Personal Data Protection Law No. 6698. Learn how your personal data is processed and what your rights are.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
