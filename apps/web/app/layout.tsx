import type { Metadata } from 'next';
import { DM_Serif_Display, Inter } from 'next/font/google';
import './globals.css';

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-serif',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ahenk — Algoritmik Masa Buluşması',
  description:
    'Her hafta algoritma seni uyumlu kişilerle eşleştirir. İstanbul, Ankara, İzmir ve daha fazla şehirde yabancılarla dolu bir masaya otur.',
  openGraph: {
    title: 'Ahenk — Algoritmik Masa Buluşması',
    description:
      'Her hafta algoritma seni uyumlu kişilerle eşleştirir. İstanbul, Ankara, İzmir ve daha fazla şehirde yabancılarla dolu bir masaya otur.',
    type: 'website',
  },
  alternates: {
    canonical: 'https://ahenk.tr',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={`${dmSerifDisplay.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
