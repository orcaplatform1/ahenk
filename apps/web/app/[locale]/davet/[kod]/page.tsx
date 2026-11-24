import { redirect } from 'next/navigation';

// Kişisel davet linki: https://ahenk.co/davet/<KOD> → kayıt sayfası, davet kodu dolu (/kayit?ref=<KOD>; İngilizce tercihte
// proxy.ts önce /en/davet/<KOD>'a yönlendirir, buradan /en/kayit). Kod rakam değilse ya da böyle bir kod yoksa kayıt sayfası kodsuz açılır.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://ahenk.co';

export const dynamic = 'force-dynamic';

export default async function DavetPage({ params }: { params: Promise<{ locale: string; kod: string }> }) {
  const { locale, kod } = await params;
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
