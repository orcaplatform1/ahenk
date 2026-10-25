import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Çerez Politikası — Ahenk',
  description: 'Ahenk platformunun çerez kullanım politikası ve tercih yönetimi.',
  alternates: { canonical: 'https://ahenk.co/cerez-politikasi' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
