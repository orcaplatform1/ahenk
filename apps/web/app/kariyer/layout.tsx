import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kariyer — Ahenk',
  description: 'Şehrin sosyal dokusunu şekillendir. Ahenk\'te Şehir Operasyon Yetkilisi pozisyonu için başvur.',
  alternates: { canonical: 'https://ahenk.co/kariyer' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
