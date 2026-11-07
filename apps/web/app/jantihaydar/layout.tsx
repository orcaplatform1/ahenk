import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/jantihaydar',
  title: 'Markanı Janti Haydar Öne Çıkarsın',
  description: "Ahenk'in garsonu Janti Haydar, ürününü müşterinin önüne bir menü gibi koyar: özenle, şıklıkla ve akılda kalan bir gülümsemeyle.",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
