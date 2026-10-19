import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mekan Ortaklığı — Ahenk',
  description: 'Restoranınız veya kafeniz her hafta garantili dolulukla buluşma noktası olsun. Ahenk mekan ortaklığı programına başvurun.',
  alternates: { canonical: 'https://ahenk.tr/is-ortakligi' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
