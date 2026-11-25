import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/acik-riza-metni',
    title: 'Açık Rıza Metni',
    description: 'Kimlik doğrulamadaki canlılık videosu ve yüz eşleştirme (biyometrik veri) için KVKK madde 6 kapsamında açık rıza metni.',
    locale,
    en: { title: 'Explicit Consent Notice', description: 'Explicit consent notice under KVKK article 6 for the liveness video and face matching (biometric data) used in identity verification.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
