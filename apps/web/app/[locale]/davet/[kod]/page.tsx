import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { pageMetadata } from '@/lib/seo';
import { isLinkPreviewBot } from '@/lib/linkPreviewBots';

// Kişisel davet linki: https://ahenk.co/davet/<KOD> → kayıt sayfası, davet kodu dolu (/kayit?ref=<KOD>; İngilizce tercihte
// proxy.ts önce /en/davet/<KOD>'a yönlendirir, buradan /en/kayit). Kod rakam değilse ya da böyle bir kod yoksa kayıt sayfası kodsuz açılır.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://ahenk.co';

export const dynamic = 'force-dynamic';

// Paylaşım önizlemesi (Telegram, WhatsApp vb.) link diline göre: /davet/X her zaman Türkçe, /en/davet/X İngilizce. og:image aynen
export async function generateMetadata({ params }: { params: Promise<{ locale: string; kod: string }> }) {
  const { locale, kod } = await params;
  return pageMetadata({
    path: `/davet/${encodeURIComponent(kod)}`,
    title: 'Kayıt Ol',
    description: 'Ahenk hesabını oluştur, OCEAN kişilik testini çöz ve kişiliğine uygun insanlarla yüz yüze tanışmaya ilk adımı at.',
    locale,
    en: { title: 'Sign Up', description: 'Create your Ahenk account, take the OCEAN personality test and take the first step toward meeting people who match your personality face to face.' },
  });
}

export default async function DavetPage({ params }: { params: Promise<{ locale: string; kod: string }> }) {
  const { locale, kod } = await params;
  // Önizleme botu yönlendirilmez: sayfanın meta verisini okur (insan ziyaretçinin akışı aynen)
  if (isLinkPreviewBot((await headers()).get('user-agent'))) return null;
  const prefix = locale === 'en' ? '/en' : '';
  let valid = false;
  if (/^\d{1,9}$/.test(kod)) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/invite/${kod}`, { cache: 'no-store' });
      if (res.ok) valid = !!((await res.json()) as { valid?: boolean }).valid;
    } catch {
      valid = false;
    }
  }
  redirect(valid ? `${prefix}/kayit?ref=${kod}` : `${prefix}/kayit`);
}
