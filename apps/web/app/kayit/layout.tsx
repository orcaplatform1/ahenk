import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kayıt Ol — Ahenk',
  description: 'Ahenk\'e üye ol. OCEAN kişilik testini doldur, her hafta sana uygun insanlarla buluş.',
  openGraph: {
    title: 'Kayıt Ol — Ahenk',
    description: 'OCEAN kişilik testine dayalı eşleştirme ile her hafta yeni insanlarla buluş.',
    url: 'https://ahenk.co/kayit',
  },
};

export default function KayitLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
