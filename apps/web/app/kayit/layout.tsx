import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/kayit',
  title: 'Kayıt Ol',
  description: 'Ahenk hesabınızı oluşturun, OCEAN kişilik testini tamamlayın ve kişilik profilinize uygun insanlarla yüz yüze buluşmalara katılmak için ilk adımı atın.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
