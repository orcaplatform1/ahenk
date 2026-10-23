import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kullanım Koşulları — Ahenk',
  description: 'Ahenk platformunu kullanmadan önce lütfen kullanım koşullarını okuyunuz.',
  alternates: { canonical: 'https://ahenk.co/kullanim-kosullari' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
