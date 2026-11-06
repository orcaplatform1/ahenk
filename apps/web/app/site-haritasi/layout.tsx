import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/site-haritasi',
  title: 'Site Haritası',
  description: 'Ahenk platformunun tüm sayfalarına genel bakış. Buluşma, hesap, ortaklık, kariyer ve yasal bilgi sayfalarına bu site haritasından kolayca ulaşabilirsiniz.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
