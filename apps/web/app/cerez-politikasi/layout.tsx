import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/cerez-politikasi',
  title: 'Çerez Politikası',
  description: 'Ahenk platformunda kullanılan zorunlu, analitik ve pazarlama çerezlerini, sürelerini, sağlayıcılarını ve tercihlerinizi nasıl yönetebileceğinizi inceleyin.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
