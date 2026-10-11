'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const sections = [
  {
    n: '01',
    title: 'Veri Sorumlusu',
    content: (
      <>
        <p>
          Ahenk platformunun veri sorumlusu olarak aşağıdaki iletişim bilgilerini kullanabilirsiniz:
        </p>
        <div
          style={{
            marginTop: '1rem',
            padding: '1.25rem 1.5rem',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '0.5rem',
          }}
        >
          <p>
            <span style={{ color: '#888' }}>Adres:</span>{' '}
            Metropol İstanbul, Atatürk Mah. Ataşehir Bulvarı, Ertuğrul Gazi Sokak, Ataşehir / İstanbul
          </p>
          <p>
            <span style={{ color: '#888' }}>E-posta:</span>{' '}
            <a href="mailto:bilgi@ahenk.tr" style={{ color: '#c0392b' }}>bilgi@ahenk.tr</a>
          </p>
          <p>
            <span style={{ color: '#888' }}>Telefon:</span>{' '}
            <a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a>
          </p>
        </div>
      </>
    ),
  },
  {
    n: '02',
    title: 'Toplanan Kişisel Veriler',
    content: (
      <>
        <SubTitle>Kayıt Sırasında</SubTitle>
        <List items={['Ad ve soyad', 'E-posta adresi', 'Doğum tarihi', 'Cinsiyet', 'Şehir tercihi']} />

        <SubTitle style={{ marginTop: '1.25rem' }}>Kimlik Doğrulama (KYC) Sırasında</SubTitle>
        <p style={{ color: '#888', fontSize: '0.82rem', marginBottom: '0.6rem' }}>
          Aşağıdaki veriler <strong style={{ color: '#f5f5f5' }}>özel nitelikli kişisel veri</strong> kapsamındadır ve açık rıza alınarak işlenir.
        </p>
        <List
          items={[
            'Kimlik kartı ön yüzü görseli',
            'Kimlik kartı arka yüzü görseli',
            'Liveness (canlılık) videosu',
          ]}
        />

        <SubTitle style={{ marginTop: '1.25rem' }}>Platform Kullanımı Sırasında</SubTitle>
        <List
          items={[
            'OCEAN kişilik testi sonuçları ve skorları',
            'Masa buluşma geçmişi',
            'Değerlendirme ve yorum verileri',
            'Rehber engelleme listesi — hash\'lenmiş telefon numaraları (ham numara saklanmaz)',
          ]}
        />

        <SubTitle style={{ marginTop: '1.25rem' }}>Teknik Veriler</SubTitle>
        <List items={['IP adresi', 'Tarayıcı türü', 'Cihaz bilgisi', 'Oturum verileri', 'Çerez verileri']} />
      </>
    ),
  },
  {
    n: '03',
    title: 'Kişisel Verilerin İşlenme Amaçları',
    content: (
      <List
        items={[
          'Kullanıcı hesabının oluşturulması ve yönetilmesi',
          'Kimlik doğrulama (KYC) sürecinin yürütülmesi ve güvenli platform ortamının sağlanması',
          'OCEAN kişilik modeline dayalı algoritmik eşleştirme ile uyumlu masa buluşmalarının organize edilmesi',
          'Abonelik ve ödeme işlemlerinin gerçekleştirilmesi',
          'Kullanıcıyla e-posta ve sistem bildirimleri aracılığıyla iletişim kurulması',
          'Yasal yükümlülüklerin yerine getirilmesi ve yetkili kurumlara bildirim yapılması',
          'Platform güvenliğinin sağlanması ve kötüye kullanımın önlenmesi',
        ]}
      />
    ),
  },
  {
    n: '04',
    title: 'Kişisel Verilerin İşlenme Hukuki Dayanağı',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.85rem' }}>
        {[
          {
            basis: 'Açık Rıza — KVKK Madde 5/1',
            desc: 'OCEAN testi sonuçları, kimlik belgeleri ve liveness videosu',
          },
          {
            basis: 'Sözleşmenin İfası — KVKK Madde 5/2-c',
            desc: 'Kayıt, ödeme ve hizmet sunumu',
          },
          {
            basis: 'Meşru Menfaat — KVKK Madde 5/2-f',
            desc: 'Platform güvenliği, teknik veriler',
          },
          {
            basis: 'Yasal Yükümlülük — KVKK Madde 5/2-ç',
            desc: 'Mali kayıtlar, yetkili kurum talepleri',
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
            <p style={{ fontWeight: 600, color: '#e8e8e8', marginBottom: '0.25rem' }}>{row.basis}</p>
            <p style={{ color: '#888', fontSize: '0.87rem' }}>{row.desc}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    n: '05',
    title: 'Kişisel Verilerin Saklanma Süreleri',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0' }}>
        {[
          ['Kullanıcı hesap verileri', 'Hesap silinene kadar + 2 yıl'],
          ['KYC belgeleri (kimlik görselleri ve liveness videosu)', '10 yıl — yasal yükümlülük'],
          ['OCEAN testi sonuçları', 'Hesap aktif olduğu sürece'],
          ['Ödeme kayıtları', '10 yıl — Vergi Usul Kanunu'],
          ['Hash\'lenmiş telefon numaraları', 'Kullanıcı silene kadar'],
        ].map(([label, value], i) => (
          <div
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '1rem',
              padding: '0.85rem 0',
              borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}
          >
            <span style={{ color: '#ccc', fontSize: '0.87rem', flex: 1 }}>{label}</span>
            <span style={{ color: '#888', fontSize: '0.82rem', textAlign: 'right' as const, flexShrink: 0 }}>{value}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    n: '06',
    title: 'Kişisel Verilerin Aktarıldığı Üçüncü Taraflar',
    content: (
      <>
        <SubTitle>Yurt İçi Aktarımlar</SubTitle>
        <p>
          <strong style={{ color: '#e8e8e8' }}>iyzico Ödeme Hizmetleri A.Ş.</strong>
          {' '}— ödeme tahsilatı ve abonelik yönetimi amacıyla.
        </p>

        <SubTitle style={{ marginTop: '1.25rem' }}>Yurt Dışı Aktarımlar</SubTitle>
        <p>
          <strong style={{ color: '#e8e8e8' }}>Cloudflare Inc. (ABD)</strong>
          {' '}— R2 private bucket'ta kimlik belgeleri ve liveness videosu şifrelenmiş olarak saklanır. Standart Sözleşme Maddeleri (SCCs) kapsamında aktarılır.
        </p>

        <div
          style={{
            marginTop: '1.25rem',
            padding: '1rem 1.25rem',
            background: 'rgba(192,57,43,0.08)',
            border: '1px solid rgba(192,57,43,0.2)',
            borderRadius: '10px',
          }}
        >
          <p style={{ color: '#f5f5f5', fontSize: '0.87rem' }}>
            Kişisel veriler hiçbir koşulda üçüncü taraflara <strong>satılmaz</strong> veya ticari amaçla paylaşılmaz.
          </p>
        </div>
      </>
    ),
  },
  {
    n: '07',
    title: 'Kişisel Veri Sahibinin Hakları',
    content: (
      <>
        <p style={{ marginBottom: '1rem' }}>
          Kullanıcılar{' '}
          <a href="mailto:bilgi@ahenk.tr" style={{ color: '#c0392b' }}>bilgi@ahenk.tr</a>
          {' '}adresine yazılı başvurarak şu haklarını kullanabilir:
        </p>
        <List
          items={[
            'Kişisel verilerinin işlenip işlenmediğini öğrenme',
            'İşlenmişse buna ilişkin bilgi talep etme',
            'İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme',
            'Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri öğrenme',
            'Eksik veya yanlış işlenmişse düzeltilmesini isteme',
            'KVKK Madde 7 kapsamında silinmesini veya yok edilmesini isteme',
            'Düzeltme ve silme işlemlerinin üçüncü kişilere bildirilmesini isteme',
            'İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi nedeniyle aleyhine bir sonucun ortaya çıkmasına itiraz etme',
            'Kanuna aykırı işlenmesi nedeniyle zarara uğraması halinde zararın giderilmesini talep etme',
          ]}
        />
        <p style={{ marginTop: '1rem', color: '#888', fontSize: '0.85rem' }}>
          Başvurular <strong style={{ color: '#f5f5f5' }}>30 gün</strong> içinde yanıtlanır.
        </p>
      </>
    ),
  },
  {
    n: '08',
    title: 'Çerezler',
    content: (
      <p>
        Ahenk, platform işlevselliği için zorunlu çerezler kullanır. Bu çerezler oturum yönetimi ve güvenlik amacıyla kullanılır; üçüncü taraf izleme çerezleri kullanılmaz. Detaylı bilgi için{' '}
        <Link href="/cerez-politikasi" style={{ color: '#c0392b' }}>Çerez Politikamızı</Link>
        {' '}inceleyiniz.
      </p>
    ),
  },
  {
    n: '09',
    title: 'Güvenlik',
    content: (
      <List
        items={[
          'SSL/TLS şifrelemesi — tüm veri iletimlerinde',
          'Cloudflare R2 private bucket — kimlik belgeleri ve liveness videosu yalnızca imzalı URL ile yetkili admin tarafından erişilebilir',
          'Hash\'leme teknolojileri — telefon numaraları SHA-256 ile hash\'lenerek saklanır, ham numara tutulmaz',
          'Erişim kontrolleri ve rol tabanlı yetkilendirme',
          'Rate limiting ve DDoS koruması',
        ]}
      />
    ),
  },
  {
    n: '10',
    title: 'Politika Değişiklikleri',
    content: (
      <p>
        Bu politika gerektiğinde güncellenebilir. Önemli değişiklikler kayıtlı e-posta adresinize bildirilir. Güncel politikaya her zaman{' '}
        <Link href="/gizlilik-politikasi" style={{ color: '#c0392b' }}>ahenk.tr/gizlilik-politikasi</Link>
        {' '}adresinden ulaşabilirsiniz.
      </p>
    ),
  },
  {
    n: '11',
    title: 'İletişim ve Uyuşmazlık',
    content: (
      <>
        <p>
          Her türlü soru, talep ve şikayetleriniz için:{' '}
          <a href="mailto:bilgi@ahenk.tr" style={{ color: '#c0392b' }}>bilgi@ahenk.tr</a>
        </p>
        <p style={{ marginTop: '0.75rem', color: '#888', fontSize: '0.87rem' }}>
          Bu politikadan doğan uyuşmazlıklarda <strong style={{ color: '#f5f5f5' }}>İstanbul Mahkemeleri ve İcra Müdürlükleri</strong> yetkilidir.
        </p>
      </>
    ),
  },
];

function SubTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      style={{
        fontSize: '0.75rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        color: '#666',
        marginBottom: '0.6rem',
        ...style,
      }}
    >
      {children}
    </p>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.55rem' }}>
      {items.map((item) => (
        <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.6 }}>
          <span style={{ color: '#c0392b', marginTop: '0.15rem', flexShrink: 0 }}>›</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: 'easeOut' as const },
  }),
};

export default function GizlilikPolitikasiPage() {
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
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1.15,
            }}
          >
            Gizlilik Politikası
          </h1>
          <p style={{ marginTop: '0.6rem', color: '#555', fontSize: '0.82rem', letterSpacing: '0.03em' }}>
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
                    fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)',
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
