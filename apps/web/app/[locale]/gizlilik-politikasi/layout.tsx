import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/gizlilik-politikasi',
    title: 'Gizlilik Politikası',
    description: 'Ahenk platformunda kişisel verilerinin nasıl toplandığını, işlendiğini ve korunduğunu açıklayan gizlilik politikamı inceleyerek bilgi edinebilirsin.',
    locale,
    en: { title: 'Privacy Policy', description: 'Read our privacy policy to learn how Ahenk collects, processes and protects your personal data.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
