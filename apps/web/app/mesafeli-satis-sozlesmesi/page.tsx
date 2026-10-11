'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const sections = [
  {
    n: '01',
    title: 'Taraflar',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '1rem' }}>
        <div style={{ padding: '1.1rem 1.25rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#666', marginBottom: '0.6rem' }}>Satıcı</p>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.35rem' }}>
            <p style={{ color: '#e8e8e8', fontWeight: 600 }}>Ahenk Platformu</p>
            <p style={{ color: '#888', fontSize: '0.86rem' }}>Metropol İstanbul, Atatürk Mah. Ataşehir Bulvarı, Ertuğrul Gazi Sokak, Ataşehir / İstanbul</p>
            <p style={{ fontSize: '0.86rem' }}><a href="mailto:bilgi@ahenk.tr" style={{ color: '#c0392b' }}>bilgi@ahenk.tr</a></p>
            <p style={{ fontSize: '0.86rem' }}><a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a></p>
          </div>
        </div>
        <div style={{ padding: '1.1rem 1.25rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#666', marginBottom: '0.6rem' }}>Alıcı</p>
          <p style={{ color: '#ccc', fontSize: '0.87rem', lineHeight: 1.65 }}>
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
          İşbu sözleşme, Alıcı'nın aşağıda belirtilen dijital abonelik paketlerinden birini satın alması ve Satıcı'nın bu hizmeti sunması karşılıklı yükümlülüklerini düzenler. Hizmetler <strong style={{ color: '#f5f5f5' }}>tamamen dijital niteliktedir</strong>; fiziksel teslimat söz konusu değildir.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.85rem' }}>
          {[
            {
              name: 'Masada Paketi',
              price: '349₺/ay',
              items: [
                'OCEAN Big Five modeline dayalı algoritmik eşleştirmeyle her hafta şehirde grup masası buluşması organizasyonu',
                'Her buluşmada 4-8 kişilik grup masası',
                'Mekan seçimi ve rezervasyonu Ahenk tarafından yapılır',
              ],
            },
            {
              name: 'Karşımda Paketi',
              price: '449₺/ay',
              items: [
                'OCEAN Big Five modeline dayalı algoritmik eşleştirmeyle her hafta şehirde başbaşa buluşma organizasyonu',
                'Her buluşmada 2 kişilik masa',
                'Mekan seçimi ve rezervasyonu Ahenk tarafından yapılır',
              ],
            },
            {
              name: 'İçerde Paketi',
              price: '679₺/ay',
              items: [
                'Hem grup masası hem başbaşa buluşma seçeneği, öncelikli eşleştirme',
                'Mekan seçimi ve rezervasyonu Ahenk tarafından yapılır',
              ],
            },
          ].map((pkg) => (
            <div key={pkg.name} style={{ padding: '1.1rem 1.25rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.7rem' }}>
                <span style={{ fontWeight: 700, color: '#e8e8e8', fontSize: '0.92rem' }}>{pkg.name}</span>
                <span style={{ color: '#ff6b6b', fontWeight: 700, fontSize: '0.9rem' }}>{pkg.price}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.35rem' }}>
                {pkg.items.map((item) => (
                  <li key={item} style={{ display: 'flex', gap: '0.6rem', color: '#888', fontSize: '0.84rem', lineHeight: 1.55 }}>
                    <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p style={{ marginTop: '0.85rem', color: '#555', fontSize: '0.8rem' }}>Tüm fiyatlar KDV dahildir.</p>
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
          'Kart bilgileri Ahenk tarafından saklanmaz — iyzico\'nun PCI-DSS uyumlu sisteminde işlenir.',
          'Abonelik her dönem başında otomatik olarak yenilenir ve kayıtlı karta tahsilat yapılır.',
          'Tahsilat başarısız olursa abonelik askıya alınır ve kullanıcıya bildirim gönderilir.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.6 }}>
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
          'Ödemenin onaylanmasının ardından abonelik anında aktifleşir ve kullanıcı hesabına tanımlanır.',
          'Hizmet tamamen dijital niteliktedir; fiziksel ürün veya teslimat söz konusu değildir.',
          'Kullanıcının abonelik dönemi boyunca hizmetten yararlanabilmesi için KYC kimlik doğrulamasını tamamlamış olması zorunludur.',
          'KYC doğrulaması tamamlanmadan eşleştirmeye dahil olunamaz.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.6 }}>
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
          6502 sayılı Tüketicinin Korunması Hakkında Kanun'un 49. maddesi ve Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca, <strong style={{ color: '#f5f5f5' }}>dijital içerik ve hizmetlerde tüketicinin onayıyla hizmet ifasına başlanmış olması halinde cayma hakkı kullanılamaz.</strong>
        </p>
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: '10px' }}>
          <p style={{ color: '#f5f5f5', fontSize: '0.87rem', lineHeight: 1.65 }}>
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
            'Kullanıcı aboneliğini profil sayfasındaki Paketim sekmesinden istediği zaman iptal edebilir.',
            'İptal işlemi mevcut abonelik döneminin sonunda geçerli olur; kalan süre için hizmet aktif kalmaya devam eder.',
            'Mevcut dönem için kısmi veya tam iade yapılmaz.',
            'Teknik arıza veya Ahenk kaynaklı hizmet kesintisi durumunda iade değerlendirilebilir; talep için bilgi@ahenk.tr adresine başvurulmalıdır.',
            'Hesabın kural ihlali nedeniyle Ahenk tarafından kapatılması durumunda kalan abonelik süresi için iade yapılmaz.',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.6 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </li>
          ))}
        </ul>

        <div style={{ padding: '1.1rem 1.25rem', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: '12px' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#c0392b', marginBottom: '0.85rem' }}>Eşleşme Gerçekleşmemesi Durumunda İade</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
            {[
              'Grup masası eşleşmesi 4 Perşembe döngüsü boyunca gerçekleşmezse; Masada paketi için tam iade, İçerde paketinde grup masası kısmı için yarım iade talep edilebilir.',
              'Başbaşa eşleşme 4 döngü boyunca gerçekleşmezse; Karşımda paketi için tam iade, İçerde paketinde başbaşa kısmı için yarım iade talep edilebilir.',
              'İçerde paketinde her iki eşleşme de gerçekleşmezse tam iade talep edilebilir.',
              'Masa kurulduğu halde kullanıcının katılım sağlamaması durumunda iade yapılmaz.',
              'İade talepleri profil sayfasındaki İade Talep Et butonu üzerinden iletilir ve 5 iş günü içinde değerlendirilir.',
            ].map((item) => (
              <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.6 }}>
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
          'Kullanıcı sayısının yetersiz olduğu şehir veya dönemlerde eşleştirme gerçekleşmeyebilir. Bu durumda Ahenk, kullanıcıya ilgili dönem için alternatif hizmet sunmayı veya iade değerlendirmeyi kabul eder.',
          "Ahenk, buluşmaların gerçekleştiği mekânın hizmet kalitesinden sorumlu tutulamaz.",
          'Buluşmalar sırasında kullanıcılar arasında yaşanan kişisel anlaşmazlık, maddi veya manevi zararlardan Ahenk sorumlu tutulamaz.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.6 }}>
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
          <a href="mailto:bilgi@ahenk.tr" style={{ color: '#c0392b' }}>bilgi@ahenk.tr</a>
          {' '}adresine başvurabilirsiniz.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
          {[
            '2024 yılı için belirlenen parasal sınırlar dahilinde İstanbul Tüketici Hakem Heyetleri\'ne başvurma hakkınız mevcuttur.',
            'Bu sınırların üzerindeki uyuşmazlıklarda İstanbul Tüketici Mahkemeleri yetkilidir.',
            'Ticari nitelikteki uyuşmazlıklarda ise İstanbul Mahkemeleri ve İcra Müdürlükleri münhasıran yetkilidir.',
          ].map((item) => (
            <div key={item} style={{ display: 'flex', gap: '0.65rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.6 }}>
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
        Bu sözleşme, kullanıcının ödeme işlemini onaylamasıyla birlikte yürürlüğe girer ve abonelik süresi boyunca geçerliliğini korur. Sözleşmenin bir kopyası kullanıcının kayıtlı e-posta adresine gönderilir ve profil sayfasından her zaman erişilebilir.
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
    <main
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#f5f5f5',
        fontFamily: 'var(--font-sans, system-ui)',
        position: 'relative' as const,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'fixed' as const,
          top: -120,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 700,
          height: 340,
          background: 'radial-gradient(ellipse at center, rgba(192,57,43,0.22) 0%, transparent 70%)',
          pointerEvents: 'none' as const,
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <h1
            style={{
              fontFamily: 'var(--font-serif, Georgia, serif)',
              fontSize: 'clamp(1.8rem, 4.5vw, 2.8rem)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1.2,
            }}
          >
            Mesafeli Satış Sözleşmesi
          </h1>
          <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.8rem', lineHeight: 1.5 }}>
            6502 Sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği Kapsamında
          </p>
          <p style={{ marginTop: '0.25rem', color: '#555', fontSize: '0.78rem' }}>
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
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.4)',
                borderRadius: '16px',
                padding: '1.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', color: '#c0392b' }}>{sec.n}</span>
                <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)', fontWeight: 400, color: '#f5f5f5', lineHeight: 1.2 }}>
                  {sec.title}
                </h2>
              </div>
              <div style={{ color: '#ccc', fontSize: '0.9rem', lineHeight: 1.75 }}>
                {sec.content}
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </main>
  );
}
