'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { PlanPriceText } from '@/components/PlanPrice';
import { COMPANY_ADDRESS, COMPANY_TITLE, JURISDICTION } from '@/lib/companyInfo';
import { TaxInfo } from '@/components/TaxInfo';

const sections = [
  {
    n: '01',
    title: 'Taraflar',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '1rem' }}>
        <div style={{ padding: '1.1rem 1.25rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f', marginBottom: '0.6rem' }}>Satıcı</p>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.35rem' }}>
            <p style={{ color: '#f4f1ec', fontWeight: 600 }}>{COMPANY_TITLE}</p>
            <p style={{ color: '#a39c93', fontSize: 13 }}>{COMPANY_ADDRESS}</p>
        <TaxInfo showTitle={false} />
            <p style={{ fontSize: 13 }}><a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a></p>
            <p style={{ fontSize: 13 }}><a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a></p>
          </div>
        </div>
        <div style={{ padding: '1.1rem 1.25rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f', marginBottom: '0.6rem' }}>Alıcı</p>
          <p style={{ color: '#c9c2b8', fontSize: 13, lineHeight: 1.65 }}>
            Platforma kayıtlı ve paket satın alma işlemi gerçekleştiren kullanıcı. Alıcının adı, soyadı, e-posta adresi ve adresi kayıt sırasında sisteme girilmiş bilgilerden alınır.
          </p>
        </div>
      </div>
    ),
  },
  {
    n: '02',
    title: 'Sözleşmenin Konusu',
    content: (
      <>
        <p style={{ marginBottom: '1.25rem', lineHeight: 1.75 }}>
          İşbu sözleşme, Alıcı'nın aşağıda belirtilen tek seferlik dijital hizmet paketlerinden birini satın alması ve Satıcı'nın bu hizmeti sunması karşılıklı yükümlülüklerini düzenler. Hizmetler <strong style={{ color: '#f4f1ec' }}>tamamen dijital niteliktedir</strong>; fiziksel teslimat söz konusu değildir.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.85rem' }}>
          {[
            {
              name: 'Masada Paketi',
              price: <PlanPriceText plan="MASADA" suffix="₺" />,
              items: [
                'OCEAN Big Five modeline dayalı algoritmik eşleştirmeyle 2 grup masası buluşması hakkı',
                'Haklar, satın alımdan sonraki 4 grup döngüsü (yaklaşık 1 ay) içinde kullanılır',
                'Grup masası 4-6 kişi',
                'Mekan seçimi ve rezervasyonu Ahenk tarafından yapılır',
              ],
            },
            {
              name: 'Karşımda Paketi',
              price: <PlanPriceText plan="KARSIMDA" suffix="₺" />,
              items: [
                'OCEAN Big Five modeline dayalı algoritmik eşleştirmeyle 1 başbaşa masası buluşması hakkı',
                'Hak, satın alımdan sonraki 4 başbaşa döngüsü (yaklaşık 1 ay) içinde kullanılır',
                'Baş Başa 2 kişi',
                'Mekan seçimi ve rezervasyonu Ahenk tarafından yapılır',
              ],
            },
            {
              name: 'İçerde Paketi',
              price: <PlanPriceText plan="ICERDE" suffix="₺" />,
              items: [
                '2 grup masası + 1 başbaşa masası buluşması hakkı, öncelikli eşleştirme',
                'Grup ve başbaşa hakları ayrı ayrı 4\'er döngü (yaklaşık 1 ay) içinde kullanılır',
              ],
            },
            {
              name: 'Kankamla Paketi',
              price: <PlanPriceText plan="KANKAMLA" suffix="₺" />,
              items: [
                '2 Kankamla masası hakkı: Alıcı ve aynı cinsiyetteki kankası, karşı cinsten bir kanka çiftiyle 4 kişilik masada buluşur',
                'Paketi yalnızca alıcı satın alır; kankası ücretsiz katılır. Paket, kanka seçilmeden satın alınamaz',
                'Haklar, satın alımdan sonraki 4 Kankamla döngüsü (yaklaşık 1 ay) içinde kullanılır',
                'Mekan seçimi ve rezervasyonu Ahenk tarafından yapılır',
              ],
            },
          ].map((pkg) => (
            <div key={pkg.name} style={{ padding: '1.1rem 1.25rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.7rem' }}>
                <span style={{ fontWeight: 700, color: '#f4f1ec', fontSize: 13 }}>{pkg.name}</span>
                <span style={{ color: '#ff6b6b', fontWeight: 700, fontSize: 13 }}>{pkg.price}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.35rem' }}>
                {pkg.items.map((item) => (
                  <li key={item} style={{ display: 'flex', gap: '0.6rem', color: '#a39c93', fontSize: 13, lineHeight: 1.55 }}>
                    <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p style={{ marginTop: '0.85rem', color: '#8f887f', fontSize: 13 }}>Tüm fiyatlar KDV dahildir. Paketler tek seferliktir; abonelik ve otomatik yenileme yoktur.</p>
      </>
    ),
  },
  {
    n: '03',
    title: 'Ödeme Koşulları',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'Ödemeler iyzico Ödeme Hizmetleri A.Ş. altyapısı üzerinden kredi kartı veya banka kartıyla güvenli şekilde tahsil edilir.',
          'Kart bilgileri Ahenk tarafından saklanmaz, iyzico\'nun PCI-DSS uyumlu sisteminde işlenir.',
          'Paketler tek seferlik ödemeyle satın alınır; abonelik, otomatik yenileme veya kayıtlı karttan tekrar tahsilat yapılmaz.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '04',
    title: 'Hizmetin İfası ve Teslimat',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'Ödemenin onaylanmasının ardından paket anında aktifleşir ve kullanıcı hesabına tanımlanır.',
          'Hizmet tamamen dijital niteliktedir; fiziksel ürün veya teslimat söz konusu değildir.',
          'Kullanıcının paket süresince hizmetten yararlanabilmesi için kimlik doğrulamasını tamamlamış olması zorunludur.',
          'Bir döngü, ilgili masa türünün haftalık eşleştirme dönemidir; paket hakları kullanıldığında ya da 4 döngü dolduğunda sona erer.',
          'Kimlik doğrulaması tamamlanmadan eşleştirmeye dahil olunamaz.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '05',
    title: 'Cayma Hakkı',
    content: (
      <>
        <p style={{ lineHeight: 1.75, marginBottom: '1rem' }}>
          6502 sayılı Tüketicinin Korunması Hakkında Kanun'un 49. maddesi ve Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca, <strong style={{ color: '#f4f1ec' }}>dijital içerik ve hizmetlerde tüketicinin onayıyla hizmet ifasına başlanmış olması halinde cayma hakkı kullanılamaz.</strong>
        </p>
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: '10px' }}>
          <p style={{ color: '#f4f1ec', fontSize: 13, lineHeight: 1.65 }}>
            Kullanıcı, ödeme işlemini tamamlarken dijital hizmetin anında başlatılacağını ve bu nedenle cayma hakkından feragat ettiğini açıkça onaylar. Bu onay ödeme sayfasında açık ve anlaşılır biçimde alınır.
          </p>
        </div>
      </>
    ),
  },
  {
    n: '06',
    title: 'İptal ve İade Politikası',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '1.25rem' }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
          {[
            'Paketler tek seferlik olduğundan iptal edilecek bir abonelik yoktur; satın alınan haklar kullanıldığında ya da 4 döngü dolduğunda kendiliğinden sona erer.',
            'Kullanılmayan haklar için kısmi iade yapılmaz; iade yalnızca aşağıdaki "Eşleşme Gerçekleşmemesi" koşulunda yapılır.',
            'Teknik arıza veya Ahenk kaynaklı hizmet kesintisi durumunda iade değerlendirilebilir; talep için bilgi@ahenk.co adresine başvurulmalıdır.',
            'Hesabın kural ihlali nedeniyle Ahenk tarafından kapatılması durumunda kalan haklar için iade yapılmaz.',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </li>
          ))}
        </ul>

        <div style={{ padding: '1.1rem 1.25rem', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: '12px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#c0392b', marginBottom: '0.85rem' }}>Eşleşme Gerçekleşmemesi Durumunda İade</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
            {[
              'Masada paketinde 4 grup döngüsü boyunca hiç grup masası kurulamazsa tam iade talep edilebilir.',
              'Karşımda paketinde 4 başbaşa döngüsü boyunca başbaşa masası kurulamazsa tam iade talep edilebilir.',
              'İçerde paketinde grup ve başbaşa kısımları ayrı değerlendirilir: bir kısımda 4 döngü boyunca hiç masa kurulamazsa o kısım için paket bedelinin yarısı, her iki kısımda da kurulamazsa tamamı iade edilebilir.',
              'Kankamla paketinde 4 Kankamla döngüsü boyunca hiç masa kurulamazsa tam iade talep edilebilir. İade talebini yalnızca paketi satın alan kişi yapabilir; çiftin rezervasyonu kendisi iptal etmesi masanın kurulduğu anlamına gelir.',
              'Kankanın buluşmaya katılmaması veya kankalığın sona ermesi iade sebebi değildir.',
              'Paketin bir kısmında bir masa kurulduysa, kalan hak bulunsa dahi o kısım için hizmet alınmış sayılır ve iade yapılmaz.',
              'Masa kurulduğu halde kullanıcının katılım sağlamaması durumunda iade yapılmaz.',
              'Masa kurulduktan sonra bir veya birden fazla katılımcının buluşmaya katılmaması, hizmetin ifa edilmediği anlamına gelmez ve iade sebebi teşkil etmez.',
              'İade talepleri profil sayfasındaki İade Talep Et butonu üzerinden iletilir ve 5 iş günü içinde değerlendirilir.',
            ].map((item) => (
              <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
                <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    ),
  },
  {
    n: '07',
    title: 'Garanti ve Sorumluluk',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'Ahenk, OCEAN modeline dayalı algoritmik eşleştirme hizmeti sunar; belirli bir kişiyle eşleşme veya buluşmanın gerçekleşeceğine dair garanti vermez.',
          'Ahenk, eşleştirme sonucunda kurulan masada yer alan katılımcıların tamamının buluşmaya katılacağını garanti etmez. Buluşmaya katılım her kullanıcının kendi iradesine bağlıdır ve Ahenk tarafından zorunlu tutulamaz.',
          'Ahenk, masaların kurulabilmesi ve katılımcı dengesinin sağlanabilmesi amacıyla masa kompozisyonunda sistemsel düzenlemeler yapma hakkını saklı tutar.',
          'Kullanıcı sayısının yetersiz olduğu şehir veya dönemlerde eşleştirme gerçekleşmeyebilir. Bu durumda Ahenk, kullanıcıya ilgili dönem için alternatif hizmet sunmayı veya iade değerlendirmeyi kabul eder.',
          "Ahenk, buluşmaların gerçekleştiği mekânın hizmet kalitesinden sorumlu tutulamaz.",
          'Buluşmalar sırasında kullanıcılar arasında yaşanan kişisel anlaşmazlık, maddi veya manevi zararlardan Ahenk sorumlu tutulamaz.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '08',
    title: 'Kişisel Verilerin Korunması',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Satın alma sürecinde işlenen kişisel veriler 6698 sayılı KVKK kapsamında korunmaktadır. Detaylı bilgi için{' '}
        <Link href="/gizlilik-politikasi" style={{ color: '#c0392b' }}>Gizlilik Politikası</Link>
        {' '}ve{' '}
        <Link href="/kvkk" style={{ color: '#c0392b' }}>KVKK Aydınlatma Metni</Link>
        {' '}sayfalarımızı inceleyiniz.
      </p>
    ),
  },
  {
    n: '09',
    title: 'Uyuşmazlık Çözümü',
    content: (
      <>
        <p style={{ marginBottom: '1rem', lineHeight: 1.75 }}>
          Tüketici olarak yasal haklarınız saklıdır. Şikâyetleriniz için öncelikle{' '}
          <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a>
          {' '}adresine başvurabilirsiniz.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
          {[
            'Her yıl Ticaret Bakanlığı\'nca belirlenen güncel parasal sınırlar dahilinde Tüketici Hakem Heyetleri\'ne başvurma hakkınız mevcuttur.',
            JURISDICTION,
            'Tüketici, 6502 sayılı Kanun kapsamında kendi yerleşim yerindeki Tüketici Hakem Heyeti veya Tüketici Mahkemesi\'ne de başvurabilir.',
          ].map((item) => (
            <div key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    n: '10',
    title: 'Sözleşmenin Yürürlüğü',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Bu sözleşme, kullanıcının ödeme işlemini onaylamasıyla birlikte yürürlüğe girer ve satın alınan paketin hakları sona erene kadar geçerliliğini korur. Sözleşmenin bir kopyası kullanıcının kayıtlı e-posta adresine gönderilir ve profil sayfasından her zaman erişilebilir.
      </p>
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

export default function MesafeliSatisSozlesmesiPage() {
  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <h1 className="ll-title">
            Mesafeli Satış Sözleşmesi
          </h1>
          <p style={{ marginTop: '0.5rem', color: '#8f887f', fontSize: 13, lineHeight: 1.5 }}>
            6502 Sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği Kapsamında
          </p>
          <p style={{ marginTop: '0.25rem', color: '#8f887f', fontSize: 11 }}>
            Son güncelleme: Ekim 2026
          </p>
        </motion.div>

        <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column' as const, gap: '1.25rem' }}>
          {sections.map((sec, i) => (
            <motion.div
              key={sec.n}
              custom={i}
              initial="hidden"
              animate="show"
              variants={fadeUp}
              className="ll-card"
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <span className="ll-eyebrow">{sec.n}</span>
                <h2 className="ll-title">
                  {sec.title}
                </h2>
              </div>
              <div style={{ color: '#c9c2b8', fontSize: 13, lineHeight: 1.75 }}>
                {sec.content}
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </main>
  );
}
