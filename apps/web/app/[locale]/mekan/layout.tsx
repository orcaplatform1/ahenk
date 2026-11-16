import type { Metadata } from 'next';
import { messagesEn, messagesTr } from '@ahenk/shared';

// Mekân paneli Türkçe + İngilizce (/en/mekan…)
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const m = locale === 'en' ? messagesEn : messagesTr;
  return { title: m.vp.panelTitle, robots: { index: false, follow: false } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
