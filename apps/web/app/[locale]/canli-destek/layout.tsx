import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const en = (await params).locale === 'en';
  return { title: en ? 'Live Support' : 'Canlı Destek', robots: { index: false, follow: false } };
}

export default function CanliDestekLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
