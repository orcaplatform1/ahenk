import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const en = (await params).locale === 'en';
  return {
    title: en ? 'Dashboard' : 'Dashboard',
    description: en ? 'See your active table and manage your meetups.' : 'Aktif masanı gör, buluşmalarını yönet.',
    robots: { index: false, follow: false },
  };
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
