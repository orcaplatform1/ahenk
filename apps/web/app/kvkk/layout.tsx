import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/kvkk',
  title: 'KVKK Aydınlatma Metni',
  description: '6698 Sayılı Kişisel Verilerin Korunması Kanunu kapsamında Ahenk aydınlatma metni. Kişisel verilerinizin işlenmesine ve haklarınıza ilişkin bilgileri inceleyin.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
