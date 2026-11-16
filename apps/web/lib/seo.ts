import type { Metadata } from 'next';

export const SITE_URL = 'https://ahenk.co';
export const SITE_TITLE = 'Ahenk | Sana Uygun İnsanlarla Buluş';
export const OG_IMAGE = '/opengraph-image';
export const TWITTER_IMAGE = '/twitter-image';

// Herkese açık sayfaların paylaşım kartı. "| Ahenk" eki kök layout'taki şablondan gelir.
// locale 'en' iken İngilizce başlık / açıklama ve /en önekli adres
export function pageMetadata({ path, title: trTitle, description: trDescription, locale, en }: { path: string; title: string; description: string; locale?: string; en?: { title: string; description: string } }): Metadata {
  const isEn = locale === 'en' && !!en;
  const title = isEn ? en!.title : trTitle;
  const description = isEn ? en!.description : trDescription;
  if (isEn) path = path === '/' ? '/en' : `/en${path}`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${path}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${path}`,
      siteName: 'Ahenk',
      locale: isEn ? 'en_GB' : 'tr_TR',
      type: 'website',
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: SITE_TITLE }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [TWITTER_IMAGE],
    },
  };
}
