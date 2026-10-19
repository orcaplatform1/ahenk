import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Site Haritası — Ahenk',
  description: 'Ahenk platformunun tüm sayfalarına genel bakış.',
  alternates: { canonical: 'https://ahenk.tr/site-haritasi' },
};

export default function SiteHaritasiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
