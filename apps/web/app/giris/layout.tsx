import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Giriş Yap — Ahenk',
  description: 'Ahenk hesabına giriş yap. WhatsApp numaranla tek seferlik kod ile güvenli giriş.',
  openGraph: {
    title: 'Giriş Yap — Ahenk',
    description: 'Ahenk hesabına giriş yap.',
    url: 'https://ahenk.co/giris',
  },
};

export default function GirisLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
