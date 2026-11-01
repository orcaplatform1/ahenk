import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { DM_Serif_Display, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Analytics from '@/components/Analytics';
import CookieBanner from '@/components/CookieBanner';
import SosOpenReport from '@/components/SosOpenReport';
import SiteFooter from '@/components/SiteFooter';
import NavbarWrapper from '@/components/NavbarWrapper';
import PageOffset from '@/components/PageOffset';
import { OG_IMAGE, SITE_TITLE, SITE_URL, TWITTER_IMAGE } from '@/lib/seo';

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

const SITE_DESCRIPTION =
  'Ahenk, OCEAN kişilik testine dayalı eşleştirmeyle seni her hafta sana uygun insanlarla buluşturur. Grup masası, Baş Başa ve Kankamla seçeneklerini keşfet.';
const TITLE_TEMPLATE = '%s | Ahenk';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: TITLE_TEMPLATE },
  description: SITE_DESCRIPTION,
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: { default: SITE_TITLE, template: TITLE_TEMPLATE },
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: 'Ahenk',
    locale: 'tr_TR',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: SITE_TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: { default: SITE_TITLE, template: TITLE_TEMPLATE },
    description: SITE_DESCRIPTION,
    images: [TWITTER_IMAGE],
  },
  alternates: {
    canonical: SITE_URL,
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
  const nonce = headers().get('x-nonce') ?? undefined;

  return (
    <html lang="tr" className={`${dmSerifDisplay.variable} ${inter.variable} ${jetBrainsMono.variable}`}>
      <body className="font-sans antialiased" style={{}}>
        <Analytics nonce={nonce} />
        <NavbarWrapper />
        <PageOffset>{children}</PageOffset>
        <SiteFooter />
        <SosOpenReport />
        <CookieBanner />
      </body>
    </html>
  );
}
