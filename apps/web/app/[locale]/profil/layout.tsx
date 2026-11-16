import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const en = (await params).locale === 'en';
  return {
    title: en ? 'My Profile' : 'Profilim',
    description: en ? 'Edit your profile, verify your identity, buy a package.' : 'Profilini düzenle, kimlik doğrulamanı yap, paket al.',
    robots: { index: false, follow: false },
  };
}

export default function ProfilLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
