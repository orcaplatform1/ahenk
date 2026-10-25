import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard — Ahenk',
  description: 'Aktif masanı gör, buluşmalarını yönet.',
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
