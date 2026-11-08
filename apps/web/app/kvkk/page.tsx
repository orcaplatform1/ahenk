'use client';

import { motion } from 'framer-motion';
import { COMPANY_ADDRESS, COMPANY_TITLE, JURISDICTION } from '@/lib/companyInfo';
import { CareerDataNotice } from '@/components/CareerDataNotice';
import { TaxInfo } from '@/components/TaxInfo';

const sections = [
  {
    n: '01',
    title: 'Veri Sorumlusu',
    content: (
      <>
        <p style={{ marginBottom: '1rem' }}>
          6698 sayılı Kişisel Verilerin Korunması Kanunu uyarınca <strong style={{ color: '#f4f1ec' }}>veri sorumlusu</strong> sıfatıyla {COMPANY_TITLE} bu aydınlatma metnini hazırlamıştır.
        </p>
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '0.5rem',
          }}
        >
          <p><span style={{ color: '#a39c93' }}>Adres:</span>{' '}{COMPANY_ADDRESS}</p>
        <TaxInfo />
          <p><span style={{ color: '#a39c93' }}>E-posta:</span>{' '}<a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a></p>
          <p><span style={{ color: '#a39c93' }}>Telefon:</span>{' '}<a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a></p>
        </div>
      </>
    ),
  },
  {
    n: '02',
    title: 'İşlenen Kişisel Veriler ve Kategorileri',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '1.1rem' }}>
        {[
          {
            cat: 'Kimlik Verileri',
            items: ['Ad, soyad, doğum tarihi, cinsiyet', 'Kimlik kartı görseli (ön ve arka yüz)'],
          },
          {
            cat: 'Biyometrik Veri',
            items: ['Liveness (canlılık) videosu: yüz görüntüsü içerdiğinden özel nitelikli kişisel veri sayılır, açık rıza alınarak işlenir'],
            special: true,
          },
          {
            cat: 'İletişim Verisi',
            items: ['E-posta adresi'],
          },
          {
            cat: 'Konum Verisi',
            items: [
              'Şehir tercihi',
              'Acil yardım konumu: yalnız acil yardım talebinde bulunan kişiden, talep anında ve talep çözülene kadar alınır; diğer katılımcıların konumu alınmaz. Konum emniyet birimleriyle paylaşılır ve ekibimiz tarafından takip edilir. Talep çözülünce koordinatlar ve konum geçmişi silinir; son konumun açık adresi ve talep kaydı yasal yükümlülükler, olası hukuki uyuşmazlıklar ve resmi makam talepleri için saklanır.',
            ],
          },
          {
            cat: 'Finansal Veriler',
            items: ['Satın alınan paket, ödeme tarihleri. Kart numarası Ahenk tarafından saklanmaz, iyzico tarafından işlenir'],
          },
          {
            cat: 'Psikolojik / Kişilik Verileri',
            items: ['OCEAN Big Five kişilik testi sonuçları ve skorları (Açıklık, Öz-Disiplin, Dışadönüklük, Uyumluluk, Duygusal Denge)'],
          },
          {
            cat: 'Davranış Verileri',
            items: ['Masa buluşma geçmişi', 'Değerlendirme puanları ve yorumlar'],
          },
          {
            cat: 'Güvenlik Verileri',
            items: ['Rehber engelleme için eklenen telefon numaraları', 'IP adresi, oturum bilgileri'],
          },
          {
            cat: 'Teknik Veriler',
            items: ['Tarayıcı türü, cihaz bilgisi, çerez verileri'],
          },
        ].map((row) => (
          <div key={row.cat}>
            <span
              style={{
                fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                color: row.special ? '#c0392b' : '#8f887f',
                display: 'block',
                marginBottom: '0.4rem',
              }}
            >
              {row.cat}
              {row.special && ' ⚠'}
            </span>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.3rem' }}>
              {row.items.map((item) => (
                <li key={item} style={{ display: 'flex', gap: '0.6rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
                  <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    ),
  },
  {
    n: '03',
    title: 'Kişisel Verilerin İşlenme Amaçları',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.55rem' }}>
        {[
          'Üyelik sözleşmesinin kurulması ve ifası',
          'kimlik doğrulama sürecinin yürütülmesi ve platform güvenliğinin sağlanması',
          'OCEAN kişilik modeline dayalı algoritmik eşleştirme ile kullanıcıya uygun masa buluşmalarının organize edilmesi',
          'Paket satın alma ve ödeme işlemlerinin iyzico altyapısı üzerinden gerçekleştirilmesi',
          'Kullanıcıyla sistem bildirimleri ve e-posta aracılığıyla iletişim kurulması',
          'Yasal yükümlülüklerin yerine getirilmesi, yetkili kurum ve kuruluşlara bilgi/belge sunulması',
          'Şikâyet ve taleplerin yönetilmesi',
          'Hizmet kalitesinin iyileştirilmesi ve platform geliştirme faaliyetlerinin yürütülmesi',
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
    title: 'Kişisel Verilerin İşlenmesinin Hukuki Dayanakları',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.85rem' }}>
        {[
          {
            basis: 'Açık Rıza: Madde 5/1 ve 6/2',
            desc: 'OCEAN kişilik testi sonuçları, kimlik belgesi görselleri ve liveness videosu. Kullanıcı kayıt ve kimlik doğrulama sürecinde açık onay verir.',
          },
          {
            basis: 'Sözleşmenin Kurulması veya İfası: Madde 5/2-c',
            desc: 'Ad, soyad, e-posta, şehir, paket ve ödeme verileri. Kankamla için kanka davetinde girilen telefon numarası (davetin iletilmesi ve doğrulanmış hesapla eşleştirilmesi amacıyla) ve kanka bağlantısı.',
          },
          {
            basis: 'Veri Sorumlusunun Meşru Menfaati: Madde 5/2-f',
            desc: 'Teknik veriler, IP adresi, güvenlik logları, rehber engelleme için eklenen telefon numaraları.',
          },
          {
            basis: 'Hukuki Yükümlülüğün Yerine Getirilmesi: Madde 5/2-ç',
            desc: 'Ödeme kayıtları, fatura bilgileri, yetkili kurum talepleri.',
          },
        ].map((row) => (
          <div
            key={row.basis}
            style={{
              padding: '1rem 1.25rem',
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
            }}
          >
            <p style={{ fontWeight: 600, color: '#f4f1ec', marginBottom: '0.25rem', fontSize: 13 }}>{row.basis}</p>
            <p style={{ color: '#a39c93', fontSize: 13 }}>{row.desc}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    n: '05',
    title: 'Özel Nitelikli Kişisel Verilerin İşlenmesi',
    content: (
      <>
        <p style={{ marginBottom: '1rem' }}>
          Kimlik belgesi görselleri (fotoğraf içerdiğinden) ve liveness videosu (biyometrik veri) özel nitelikli kişisel veri kapsamındadır. Bu veriler:
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.55rem' }}>
          {[
            'Yalnızca kimlik doğrulama amacıyla işlenir',
            'Kullanıcının açık rızasıyla alınır',
            'Cloudflare R2 private bucket\'ta AES-256 şifrelemeyle saklanır',
            'Yalnızca imzalı URL ile yetkili admin personeli tarafından erişilebilir',
            'Üçüncü taraflarla paylaşılmaz',
            '10 yıl süreyle saklanır',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    n: '06',
    title: 'Kişisel Verilerin Aktarımı',
    content: (
      <>
        <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f', marginBottom: '0.6rem' }}>Yurt İçi Aktarım</p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>iyzico Ödeme Hizmetleri A.Ş.</strong>
          : ödeme ve paket işlemleri için zorunlu finansal veriler aktarılır; iyzico kendi KVKK yükümlülüklerini yerine getirmektedir.
        </p>
        <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f', marginBottom: '0.6rem' }}>Yurt Dışı Aktarım</p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Cloudflare Inc. (ABD)</strong>
          : kimlik belgeleri ve liveness videosu R2 private bucket'ta saklanır. Bu aktarım AB Standart Sözleşme Maddeleri (SCCs) ve Cloudflare'in veri işleme sözleşmesi kapsamında gerçekleştirilir.
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Google Analytics ve Meta Pixel</strong>
          : bu araçlar aracılığıyla çerez verisi işlenir. Bu veri yurt dışındaki sunuculara aktarılabilir. Aktarım açık rızanıza dayanır ve rızanızı çerez tercihlerinden her zaman geri alabilirsiniz.
        </p>
        <div
          style={{
            padding: '1rem 1.25rem',
            background: 'rgba(192,57,43,0.08)',
            border: '1px solid rgba(192,57,43,0.2)',
            borderRadius: '10px',
          }}
        >
          <p style={{ color: '#f4f1ec', fontSize: 13 }}>
            Kişisel verileriniz satılmaz. Çerez verileri yalnızca açık rızanızla Google ve Meta ile reklam ve istatistik amacıyla paylaşılır.
          </p>
        </div>
      </>
    ),
  },
  {
    n: '07',
    title: 'Kişisel Verilerin Saklanma Süreleri',
    content: (
      <div>
        {[
          ['Kullanıcı hesap ve profil verileri', 'Hesap silinene kadar + 2 yıl'],
          ['kimlik belgeleri (kimlik görselleri ve liveness videosu)', '10 yıl, yasal yükümlülük'],
          ['OCEAN test sonuçları', 'Hesap aktif olduğu sürece; hesap silindiğinde imha edilir'],
          ['Ödeme ve fatura kayıtları', '10 yıl, Vergi Usul Kanunu'],
          ['Rehber engelleme için eklenen telefon numaraları', 'Kullanıcı tarafından silinene kadar'],
          ['IP adresi ve oturum logları', '2 yıl'],
        ].map(([label, value], i, arr) => (
          <div
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '1rem',
              padding: '0.85rem 0',
              borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.10)' : 'none',
            }}
          >
            <span style={{ color: '#c9c2b8', fontSize: 13, flex: 1 }}>{label}</span>
            <span style={{ color: '#a39c93', fontSize: 13, textAlign: 'right' as const, flexShrink: 0, maxWidth: '200px' }}>{value}</span>
          </div>
        ))}
        <p style={{ marginTop: '1rem', color: '#8f887f', fontSize: 13 }}>
          Saklama süreleri dolduğunda kişisel veriler silinir, yok edilir veya anonim hale getirilir.
        </p>
      </div>
    ),
  },
  {
    n: '08',
    title: 'Veri Sahibinin KVKK Madde 11 Kapsamındaki Hakları',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.55rem' }}>
        {[
          'Kişisel verilerinin işlenip işlenmediğini öğrenme',
          'İşlenmişse buna ilişkin bilgi talep etme',
          'İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme',
          'Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri öğrenme',
          'Eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme ve bu işlemin üçüncü kişilere bildirilmesini isteme',
          'KVKK\'nın 7. maddesi kapsamında kişisel verilerin silinmesini veya yok edilmesini isteme ve bu işlemin üçüncü kişilere bildirilmesini isteme',
          'İşlenen verilerin münhasıran otomatik sistemler aracılığıyla analiz edilmesi nedeniyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme',
          'Kişisel verilerin kanuna aykırı işlenmesi nedeniyle zarara uğramanız halinde zararın giderilmesini talep etme',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '09',
    title: 'Başvuru Yöntemi',
    content: (
      <>
        <p style={{ marginBottom: '1rem' }}>
          Haklarınızı kullanmak için{' '}
          <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a>
          {' '}adresine e-posta gönderin.
        </p>
        <p style={{ marginBottom: '0.6rem', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f' }}>
          Başvuruda yer alması gerekenler
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.4rem', marginBottom: '1rem' }}>
          {['Adınız ve soyadınız', 'TC kimlik numaranız (kimlik doğrulama için)', 'Talep konusu', 'İletişim bilgileriniz'].map((item) => (
            <li key={item} style={{ display: 'flex', gap: '0.6rem', color: '#c9c2b8', fontSize: 13 }}>
              <span style={{ color: '#c0392b' }}>›</span>{item}
            </li>
          ))}
        </ul>
        <p style={{ color: '#a39c93', fontSize: 13 }}>
          Başvurular <strong style={{ color: '#f4f1ec' }}>30 gün</strong> içinde ücretsiz olarak yanıtlanır. Başvurunun ayrıca bir maliyet gerektirmesi halinde Kişisel Verileri Koruma Kurulu tarafından belirlenen tarifeye göre ücret alınabilir.
        </p>
      </>
    ),
  },
  {
    n: '10',
    title: 'Kişisel Verileri Koruma Kurulu\'na Şikâyet Hakkı',
    content: (
      <p>
        Başvurunuzun reddedilmesi, verilen cevabın yetersiz bulunması veya süresinde yanıt verilmemesi halinde{' '}
        <strong style={{ color: '#f4f1ec' }}>Kişisel Verileri Koruma Kurulu</strong>'na şikâyette bulunabilirsiniz.
        {' '}Kurul web sitesi:{' '}
        <a href="https://www.kvkk.gov.tr" target="_blank" rel="noopener noreferrer" style={{ color: '#c0392b' }}>kvkk.gov.tr</a>
      </p>
    ),
  },
  {
    n: '11',
    title: 'Uyuşmazlık',
    content: (
      <p>
        {JURISDICTION}
      </p>
    ),
  },
  {
    n: '12',
    title: 'Kariyer Başvuruları',
    content: <CareerDataNotice transferRef="bu metnin 6. maddesi (Kişisel Verilerin Aktarımı)" rightsRef="8. maddesi (Veri Sahibinin KVKK Madde 11 Kapsamındaki Hakları)" />,
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

export default function KvkkPage() {
  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        {/* Başlık */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <h1 className="ll-title">
            Kişisel Verilerin Korunması
          </h1>
          <p style={{ marginTop: '0.5rem', color: '#8f887f', fontSize: 13, letterSpacing: '0.02em' }}>
            6698 Sayılı KVKK Kapsamında Aydınlatma Metni
          </p>
          <p style={{ marginTop: '0.25rem', color: '#8f887f', fontSize: 11 }}>
            Son güncelleme: Ekim 2026
          </p>
        </motion.div>

        {/* Bölümler */}
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
