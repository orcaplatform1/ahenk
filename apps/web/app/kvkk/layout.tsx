import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'KVKK Aydınlatma Metni — Ahenk',
  description: '6698 Sayılı Kişisel Verilerin Korunması Kanunu kapsamında aydınlatma metni.',
  alternates: { canonical: 'https://ahenk.co/kvkk' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
