import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Topluluk Kuralları — Ahenk',
  description: 'Ahenk topluluğunda herkesin güvende ve rahat hissetmesi için belirlenen kurallar.',
  alternates: { canonical: 'https://ahenk.co/topluluk-kurallari' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
