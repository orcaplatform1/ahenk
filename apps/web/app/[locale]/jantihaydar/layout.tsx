import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/jantihaydar',
    title: 'Markanı Janti Haydar Öne Çıkarsın',
    description: "Ahenk'in garsonu Janti Haydar, ürününü müşterinin önüne bir menü gibi koyar: özenle, şıklıkla ve akılda kalan bir gülümsemeyle.",
    locale,
    en: { title: 'Let Janti Haydar Showcase Your Brand', description: 'Ahenk’s waiter Janti Haydar presents your product to customers like a menu: with care, style and a memorable smile.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
