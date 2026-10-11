'use client';

import { motion } from 'framer-motion';

const sections = [
  {
    n: '01',
    title: 'Veri Sorumlusu',
    content: (
      <>
        <p style={{ marginBottom: '1rem' }}>
          6698 sayılı Kişisel Verilerin Korunması Kanunu uyarınca <strong style={{ color: '#f5f5f5' }}>veri sorumlusu</strong> sıfatıyla Ahenk platformu bu aydınlatma metnini hazırlamıştır.
        </p>
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '0.5rem',
          }}
        >
          <p><span style={{ color: '#888' }}>Adres:</span>{' '}Metropol İstanbul, Atatürk Mah. Ataşehir Bulvarı, Ertuğrul Gazi Sokak, Ataşehir / İstanbul</p>
          <p><span style={{ color: '#888' }}>E-posta:</span>{' '}<a href="mailto:bilgi@ahenk.tr" style={{ color: '#c0392b' }}>bilgi@ahenk.tr</a></p>
          <p><span style={{ color: '#888' }}>Telefon:</span>{' '}<a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a></p>
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
            items: ['Liveness (canlılık) videosu — yüz görüntüsü içerdiğinden özel nitelikli kişisel veri sayılır, açık rıza alınarak işlenir'],
            special: true,
          },
          {
            cat: 'İletişim Verisi',
            items: ['E-posta adresi'],
          },
          {
            cat: 'Konum Verisi',
            items: ['Şehir tercihi'],
          },
          {
            cat: 'Finansal Veriler',
            items: ['Abonelik paketi, ödeme tarihleri — kart numarası Ahenk tarafından saklanmaz, iyzico tarafından işlenir'],
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
            items: ['Hash\'lenmiş telefon numaraları — rehber engelleme, ham numara saklanmaz', 'IP adresi, oturum bilgileri'],
          },
          {
            cat: 'Teknik Veriler',
            items: ['Tarayıcı türü, cihaz bilgisi, çerez verileri'],
          },
        ].map((row) => (
          <div key={row.cat}>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                color: row.special ? '#c0392b' : '#666',
                display: 'block',
                marginBottom: '0.4rem',
              }}
            >
              {row.cat}
              {row.special && ' ⚠'}
            </span>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.3rem' }}>
              {row.items.map((item) => (
                <li key={item} style={{ display: 'flex', gap: '0.6rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.6 }}>
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
          'Abonelik ve ödeme işlemlerinin iyzico altyapısı üzerinden gerçekleştirilmesi',
          'Kullanıcıyla sistem bildirimleri ve e-posta aracılığıyla iletişim kurulması',
          'Yasal yükümlülüklerin yerine getirilmesi, yetkili kurum ve kuruluşlara bilgi/belge sunulması',
          'Şikâyet ve taleplerin yönetilmesi',
          'Hizmet kalitesinin iyileştirilmesi ve platform geliştirme faaliyetlerinin yürütülmesi',
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
    title: 'Kişisel Verilerin İşlenmesinin Hukuki Dayanakları',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.85rem' }}>
        {[
          {
            basis: 'Açık Rıza — Madde 5/1 ve 6/2',
            desc: 'OCEAN kişilik testi sonuçları, kimlik belgesi görselleri ve liveness videosu — kullanıcı kayıt ve kimlik doğrulama sürecinde açık onay verir.',
          },
          {
            basis: 'Sözleşmenin Kurulması veya İfası — Madde 5/2-c',
            desc: 'Ad, soyad, e-posta, şehir, abonelik ve ödeme verileri.',
          },
          {
            basis: 'Veri Sorumlusunun Meşru Menfaati — Madde 5/2-f',
            desc: 'Teknik veriler, IP adresi, güvenlik logları, hash\'lenmiş telefon numaraları.',
          },
          {
            basis: 'Hukuki Yükümlülüğün Yerine Getirilmesi — Madde 5/2-ç',
            desc: 'Ödeme kayıtları, fatura bilgileri, yetkili kurum talepleri.',
          },
        ].map((row) => (
          <div
            key={row.basis}
            style={{
              padding: '1rem 1.25rem',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px',
            }}
          >
            <p style={{ fontWeight: 600, color: '#e8e8e8', marginBottom: '0.25rem', fontSize: '0.9rem' }}>{row.basis}</p>
            <p style={{ color: '#888', fontSize: '0.85rem' }}>{row.desc}</p>
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
            <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.6 }}>
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
        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#666', marginBottom: '0.6rem' }}>Yurt İçi Aktarım</p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#e8e8e8' }}>iyzico Ödeme Hizmetleri A.Ş.</strong>
          {' '}— ödeme ve abonelik işlemleri için zorunlu finansal veriler aktarılır; iyzico kendi KVKK yükümlülüklerini yerine getirmektedir.
        </p>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#666', marginBottom: '0.6rem' }}>Yurt Dışı Aktarım</p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#e8e8e8' }}>Cloudflare Inc. (ABD)</strong>
          {' '}— kimlik belgeleri ve liveness videosu R2 private bucket'ta saklanır. Bu aktarım AB Standart Sözleşme Maddeleri (SCCs) ve Cloudflare'in veri işleme sözleşmesi kapsamında gerçekleştirilir.
        </p>
        <div
          style={{
            padding: '1rem 1.25rem',
            background: 'rgba(192,57,43,0.08)',
            border: '1px solid rgba(192,57,43,0.2)',
            borderRadius: '10px',
          }}
        >
          <p style={{ color: '#f5f5f5', fontSize: '0.87rem' }}>
            Kişisel veriler hiçbir koşulda <strong>satılmaz</strong>, kiralanmaz veya ticari amaçla üçüncü taraflarla paylaşılmaz.
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
          ['kimlik belgeleri (kimlik görselleri ve liveness videosu)', '10 yıl — yasal yükümlülük'],
          ['OCEAN test sonuçları', 'Hesap aktif olduğu sürece; hesap silindiğinde imha edilir'],
          ['Ödeme ve fatura kayıtları', '10 yıl — Vergi Usul Kanunu'],
          ['Hash\'lenmiş telefon numaraları', 'Kullanıcı tarafından silinene kadar'],
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
              borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}
          >
            <span style={{ color: '#ccc', fontSize: '0.87rem', flex: 1 }}>{label}</span>
            <span style={{ color: '#888', fontSize: '0.82rem', textAlign: 'right' as const, flexShrink: 0, maxWidth: '200px' }}>{value}</span>
          </div>
        ))}
        <p style={{ marginTop: '1rem', color: '#555', fontSize: '0.82rem' }}>
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
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.6 }}>
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
          <a href="mailto:bilgi@ahenk.tr" style={{ color: '#c0392b' }}>bilgi@ahenk.tr</a>
          {' '}adresine e-posta gönderin.
        </p>
        <p style={{ marginBottom: '0.6rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#666' }}>
          Başvuruda yer alması gerekenler
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.4rem', marginBottom: '1rem' }}>
          {['Adınız ve soyadınız', 'TC kimlik numaranız (kimlik doğrulama için)', 'Talep konusu', 'İletişim bilgileriniz'].map((item) => (
            <li key={item} style={{ display: 'flex', gap: '0.6rem', color: '#ccc', fontSize: '0.87rem' }}>
              <span style={{ color: '#c0392b' }}>›</span>{item}
            </li>
          ))}
        </ul>
        <p style={{ color: '#888', fontSize: '0.85rem' }}>
          Başvurular <strong style={{ color: '#f5f5f5' }}>30 gün</strong> içinde ücretsiz olarak yanıtlanır. Başvurunun ayrıca bir maliyet gerektirmesi halinde Kişisel Verileri Koruma Kurulu tarafından belirlenen tarifeye göre ücret alınabilir.
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
        <strong style={{ color: '#f5f5f5' }}>Kişisel Verileri Koruma Kurulu</strong>'na şikâyette bulunabilirsiniz.
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
        Bu aydınlatma metninden doğan uyuşmazlıklarda{' '}
        <strong style={{ color: '#f5f5f5' }}>İstanbul Mahkemeleri ve İcra Müdürlükleri</strong> yetkilidir.
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

export default function KvkkPage() {
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
      {/* Kırmızı üst glow */}
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
        {/* Başlık */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <h1
            style={{
              fontFamily: 'var(--font-serif, Georgia, serif)',
              fontSize: 'clamp(1.8rem, 5vw, 2.8rem)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1.15,
            }}
          >
            Kişisel Verilerin Korunması
          </h1>
          <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.82rem', letterSpacing: '0.02em' }}>
            6698 Sayılı KVKK Kapsamında Aydınlatma Metni
          </p>
          <p style={{ marginTop: '0.25rem', color: '#555', fontSize: '0.78rem' }}>
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
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: '#c0392b',
                    fontFamily: 'var(--font-sans, system-ui)',
                  }}
                >
                  {sec.n}
                </span>
                <h2
                  style={{
                    fontFamily: 'var(--font-serif, Georgia, serif)',
                    fontSize: 'clamp(1.05rem, 2.5vw, 1.3rem)',
                    fontWeight: 400,
                    color: '#f5f5f5',
                    lineHeight: 1.2,
                  }}
                >
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
