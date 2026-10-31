import type { Metadata } from 'next';
import { DM_Serif_Display, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import CookieBanner from '@/components/CookieBanner';
import SiteFooter from '@/components/SiteFooter';
import NavbarWrapper from '@/components/NavbarWrapper';

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

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ahenk — Sana Uygun İnsanlarla Buluş',
  description:
    'Ahenk seni tanıyan bir algoritmayla her hafta yeni insanlarla buluşturuyor. İster Grup masasında, istersen başbaşa bir yemek veya kahve. Doğru insanlar, doğru zamanda.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Ahenk — Sana Uygun İnsanlarla Buluş',
    description:
      'Ahenk seni tanıyan bir algoritmayla her hafta yeni insanlarla buluşturuyor. İster Grup masasında, istersen başbaşa bir yemek veya kahve. Doğru insanlar, doğru zamanda.',
    type: 'website',
    url: 'https://ahenk.co',
    siteName: 'Ahenk',
    images: [
      {
        url: 'https://ahenk.co/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Ahenk — Sana Uygun İnsanlarla Buluş',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ahenk — Sana Uygun İnsanlarla Buluş',
    description:
      'Ahenk seni tanıyan bir algoritmayla her hafta yeni insanlarla buluşturuyor. Doğru insanlar, doğru zamanda.',
    images: ['https://ahenk.co/og-image.jpg'],
  },
  alternates: {
    canonical: 'https://ahenk.co',
  },
};

// CSP nonce'u her istekte middleware'de üretilir; Next.js scriptlere nonce'u sadece dinamik
// render'da ekleyebildiği için tüm sayfalar istek anında render edilir
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={`${dmSerifDisplay.variable} ${inter.variable} ${jetBrainsMono.variable}`}>
      <body className="font-sans antialiased" style={{}}>
        <NavbarWrapper />
        {children}
        <SiteFooter />
        <CookieBanner />
      </body>
    </html>
  );
}
