import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
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
const SITE_DESCRIPTION_EN =
  'Ahenk matches you every week with people who suit you, using OCEAN personality test–based matching. Explore Group tables, One-on-One and Kankamla.';
const SITE_TITLE_EN = 'Ahenk | Meet People Who Suit You';
const TITLE_TEMPLATE = '%s | Ahenk';

// Arayüz diline göre (İngilizce /en) site başlığı ve açıklaması
export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLocale()) === 'en';
  const SITE_DESCRIPTION_L = en ? SITE_DESCRIPTION_EN : SITE_DESCRIPTION;
  const SITE_TITLE_L = en ? SITE_TITLE_EN : SITE_TITLE;
  return {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE_L, template: TITLE_TEMPLATE },
  description: SITE_DESCRIPTION_L,
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: { default: SITE_TITLE_L, template: TITLE_TEMPLATE },
    description: SITE_DESCRIPTION_L,
    url: en ? `${SITE_URL}/en` : SITE_URL,
    siteName: 'Ahenk',
    locale: en ? 'en_GB' : 'tr_TR',
    type: 'website',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: SITE_TITLE_L }],
  },
  twitter: {
    card: 'summary_large_image',
    title: { default: SITE_TITLE_L, template: TITLE_TEMPLATE },
    description: SITE_DESCRIPTION_L,
    images: [TWITTER_IMAGE],
  },
  alternates: {
    canonical: en ? `${SITE_URL}/en` : SITE_URL,
  },
  };
}

// CSP nonce'u her istekte proxy'de üretilir; Next.js scriptlere nonce'u sadece dinamik
// render'da ekleyebildiği için tüm sayfalar istek anında render edilir
export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  // Dil: /en önekli sayfalarda İngilizce, diğerlerinde (admin ve mekân paneli dahil) Türkçe
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} data-scroll-behavior="smooth" className={`${dmSerifDisplay.variable} ${inter.variable} ${jetBrainsMono.variable}`}>
      <body className="font-sans antialiased" style={{}}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Analytics nonce={nonce} />
          <NavbarWrapper />
          <PageOffset>{children}</PageOffset>
          <SiteFooter />
          <SosOpenReport />
          <CookieBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
