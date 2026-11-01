import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/cerez-politikasi',
  title: 'Çerez Politikası',
  description: 'Ahenk platformunda kullanılan zorunlu çerezleri, amaçlarını ve sürelerini, tarayıcı yerel depolamasını ve tercihlerinizi nasıl yönetebileceğinizi inceleyin.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
