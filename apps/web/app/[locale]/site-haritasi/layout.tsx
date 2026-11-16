import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/site-haritasi',
    title: 'Site Haritası',
    description: 'Ahenk platformunun tüm sayfalarına genel bakış. Buluşma, hesap, ortaklık, kariyer ve yasal bilgi sayfalarına bu site haritasından kolayca ulaşabilirsiniz.',
    locale,
    en: { title: 'Sitemap', description: 'An overview of all Ahenk pages. Easily reach meetup, account, partnership, careers and legal pages from this sitemap.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
