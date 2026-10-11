import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profilim — Ahenk',
  description: 'Profilini düzenle, KYC doğrulamanı yap, paket al.',
  robots: { index: false, follow: false },
};

export default function ProfilLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
