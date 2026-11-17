import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/cerez-politikasi',
    title: 'Çerez Politikası',
    description: 'Ahenk platformunda kullanılan zorunlu, analitik ve pazarlama çerezlerini, sürelerini, sağlayıcılarını ve tercihlerini nasıl yönetebileceğini incele.',
    locale,
    en: { title: 'Cookie Policy', description: 'Learn about the essential, analytics and marketing cookies used on Ahenk, how long they last, who provides them and how to manage your preferences.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
