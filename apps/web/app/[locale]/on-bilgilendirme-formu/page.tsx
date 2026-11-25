'use client';
import { useLocale } from 'next-intl';
import PreInfoEn from './PreInfoEn';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { PlanPriceText } from '@/components/PlanPrice';
import { COMPANY_ADDRESS, COMPANY_TITLE, JURISDICTION } from '@/lib/companyInfo';
import { TaxInfo } from '@/components/TaxInfo';

const sections = [
  {
    n: '01',
    title: 'Satıcı Bilgileri',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.35rem' }}>
        <p style={{ color: '#f4f1ec', fontWeight: 600 }}>{COMPANY_TITLE}</p>
        <p style={{ color: '#a39c93', fontSize: 13 }}>{COMPANY_ADDRESS}</p>
        <TaxInfo showTitle={false} />
        <p style={{ fontSize: 13 }}><a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a></p>
        <p style={{ fontSize: 13 }}><a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a></p>
      </div>
    ),
  },
  {
    n: '02',
    title: 'Hizmetin Temel Nitelikleri',
    content: (
      <>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Ahenk, OCEAN kişilik testine dayalı algoritmik eşleştirmeyle yabancılarla grup, baş başa ve kankamla masa buluşmaları düzenleyen dijital bir hizmettir; fiziksel teslimat yoktur.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Masada Paketi: 1 Grup Masası&apos;nda buluşma hakkı. Karşımda Paketi: 1 Baş Başa Masası&apos;nda buluşma hakkı. Kankamla Paketi: 1 Kankamla Masası&apos;nda buluşma hakkı (alıcı öder, aynı cinsiyetteki kankası ücretsiz katılır). İçerde Paketi: 1 Grup Masası + 1 Baş Başa Masası&apos;nda buluşma hakkı. Tek seferlik paketlerde haklar kullanılana kadar geçerlidir.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Premium Paket: 1, 3, 6 ve 12 aylık abonelik; her ay 1 Grup + 1 Baş Başa + 1 Kankamla Masası. Haklar her 30 günde yenilenir, kullanılmayan haklar devretmez.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Masalara katılım için kimlik doğrulamasının tamamlanmış olması zorunludur.</span></li>
          </ul>
      </>
    ),
  },
  {
    n: '03',
    title: 'Toplam Fiyat',
    content: (
      <>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Masada Paketi <PlanPriceText plan="MASADA" suffix="₺" />, Karşımda Paketi <PlanPriceText plan="KARSIMDA" suffix="₺" />, Kankamla Paketi <PlanPriceText plan="KANKAMLA" suffix="₺" />, İçerde Paketi <PlanPriceText plan="ICERDE" suffix="₺" />.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Premium Paket: 1 aylık <PlanPriceText plan="PRIME_1M" suffix="₺" />, 3 aylık <PlanPriceText plan="PRIME_3M" suffix="₺" />, 6 aylık <PlanPriceText plan="PRIME_6M" suffix="₺" />, 12 aylık <PlanPriceText plan="PRIME_12M" suffix="₺" />.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Fiyatlar web sitesindeki KDV dahil toplam fiyatlardır. Ödemeye uygulanan indirim varsa ödenecek toplam tutar ödeme ekranında gösterilir. Mobil uygulamada fiyat mağaza (App Store / Google Play) komisyonu nedeniyle farklıdır ve satın alma ekranında gösterilir.</span></li>
          </ul>
      </>
    ),
  },
  {
    n: '04',
    title: 'Ödeme Şekli',
    content: (
      <>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Web sitesinde ödemeler iyzico Ödeme Hizmetleri A.Ş. altyapısı üzerinden kredi kartı veya banka kartıyla tahsil edilir; kart bilgileri Ahenk tarafından saklanmaz.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Mobil uygulamada ödeme App Store ya da Google Play hesabından uygulama içi satın almayla alınır.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Premium aboneliğinde dönem başında seçilen sürenin tam tutarı tek seferde tahsil edilir; abonelik iptal edilmediği sürece dönem sonunda aynı süreyle otomatik olarak yenilenir.</span></li>
          </ul>
      </>
    ),
  },
  {
    n: '05',
    title: 'Cayma Hakkı ve İstisnası',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' }}>
        <p>6502 sayılı Tüketicinin Korunması Hakkında Kanun&apos;un 49. maddesi ve Mesafeli Sözleşmeler Yönetmeliği&apos;nin 15. maddesi uyarınca, <strong style={{ color: '#f4f1ec' }}>dijital içerik ve hizmetlerde tüketicinin onayıyla hizmet ifasına başlanmış olması halinde cayma hakkı kullanılamaz.</strong></p>
        <p>Ödeme onaylandığında paket anında hesabına tanımlanır ve hizmetin ifasına başlanır. Ödemeyi tamamlarken bunu onaylamış olursun.</p>
      </div>
    ),
  },
  {
    n: '06',
    title: 'Şikâyet Yolları',
    content: (
      <>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Şikâyetlerin için öncelikle <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a> adresine ya da <a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a> numarasına başvurabilirsin.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>Her yıl Ticaret Bakanlığı&apos;nca belirlenen güncel parasal sınırlar dahilinde Tüketici Hakem Heyetleri&apos;ne, bu sınırların üzerinde Tüketici Mahkemesi&apos;ne başvurabilirsin; kendi yerleşim yerindeki Tüketici Hakem Heyeti veya Tüketici Mahkemesi&apos;ne de başvuru hakkın vardır.</span></li>
            <li style={{ display: 'flex', gap: '0.65rem' }}><span style={{ color: '#c0392b', flexShrink: 0 }}>›</span><span>{JURISDICTION}</span></li>
          </ul>
      </>
    ),
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: 'easeOut' as const },
  }),
};

function OnBilgilendirmeTr() {
  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <h1 className="ll-title">
            Ön Bilgilendirme Formu
          </h1>
          <p style={{ marginTop: '0.6rem', color: '#8f887f', fontSize: 13 }}>
            Son güncelleme: Kasım 2026
          </p>
        </motion.div>

        <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column' as const, gap: '1.25rem' }}>
          {sections.map((sec, i) => (
            <motion.div key={sec.n} custom={i} initial="hidden" animate="show" variants={fadeUp} className="ll-card">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <span className="ll-eyebrow">{sec.n}</span>
                <h2 className="ll-title">{sec.title}</h2>
              </div>
              <div style={{ color: '#c9c2b8', fontSize: 13, lineHeight: 1.75 }}>
                {sec.content}
              </div>
            </motion.div>
          ))}
        </div>

        <p style={{ marginTop: '2rem', color: '#a39c93', fontSize: 13 }}>
          Ayrıntılar: <Link href="/mesafeli-satis-sozlesmesi" style={{ color: '#c0392b' }}>Mesafeli Satış Sözleşmesi</Link>, <Link href="/kullanim-kosullari" style={{ color: '#c0392b' }}>Kullanım Koşulları</Link>.
        </p>
      </div>
    </main>
  );
}

// Arayüz dili İngilizceyse İngilizce çeviri (çelişkide Türkçe metin geçerlidir)
export default function OnBilgilendirmeFormuPage() {
  return useLocale() === 'en' ? <PreInfoEn /> : <OnBilgilendirmeTr />;
}
