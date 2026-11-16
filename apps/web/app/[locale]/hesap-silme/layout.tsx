import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/hesap-silme',
    title: 'Hesap Silme',
    description: 'Ahenk hesabını silme talebi oluşturma, silinen ve yasal zorunluluk nedeniyle saklanan veriler ve talebin işlenme süresi hakkında bilgi.',
    locale,
    en: { title: 'Account Deletion', description: 'How to request deletion of your Ahenk account, which data is deleted, which is kept for legal reasons and how long the request takes.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
