import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/kullanim-kosullari',
  title: 'Kullanım Koşulları',
  description: 'Ahenk platformunu kullanmadan önce okumanız gereken kullanım koşulları. Üyelik, paketler, rezervasyon ve iptal kurallarına ilişkin hükümleri inceleyin.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
