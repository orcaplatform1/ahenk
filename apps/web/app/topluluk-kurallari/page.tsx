'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const sections = [
  {
    n: '01',
    title: 'Ahenk Topluluğunun Ruhu',
    content: (
      <p style={{ lineHeight: 1.8 }}>
        Ahenk, yabancıları anlamlı buluşmalarla bir araya getiren bir platformdur. Bu deneyimin kalitesi yalnızca algoritmamıza değil, topluluğumuzdaki her bireyin tutumuna bağlıdır. Bu kurallar bir kısıtlama listesi değil, birlikte inşa ettiğimiz güvenli ve anlamlı bir ortamın temelidir.
        <br /><br />
        <span style={{ color: '#888', fontSize: '0.85rem' }}>Platforma katılarak bu kuralları okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan etmiş olursunuz.</span>
      </p>
    ),
  },
  {
    n: '02',
    title: 'Buluşmadan Önce',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.7rem' }}>
        {[
          'Gerçek kimliğinizle kayıt olun — sahte isim, fotoğraf veya bilgi kullanmak yasaktır ve hesabınızın kalıcı olarak kapatılmasına neden olur.',
          'OCEAN kişilik testini dürüstçe yanıtlayın — manipüle edilmiş sonuçlar eşleştirme kalitesini düşürür ve topluluğun tamamına zarar verir.',
          'kimlik doğrulama sürecini eksiksiz tamamlayın — bu hem sizin hem de diğer kullanıcıların güvenliği içindir.',
          'Buluşma daveti aldığınızda katılıp katılmayacağınıza zamanında karar verin — son dakika iptalleri diğer katılımcıları olumsuz etkiler. Katılamayacaksanız en az 24 saat öncesinden platform üzerinden bildirin.',
          'Buluşma lokasyonunu ve saatini önceden not alın — Ahenk sistem bildirimleri gönderir ancak takip sorumluluğu size aittir.',
          'Buluşmaya gitmeden önce kendinize ait herhangi bir beklenti veya ön yargıyı bir kenara bırakmaya çalışın — her insan sürpriz yapabilir.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.65 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '03',
    title: 'Buluşma Anında',
    content: (
      <>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.7rem', marginBottom: '1.25rem' }}>
          {[
            'Zamanında gelin — 15 dakikadan fazla gecikeceğinizi anlarsanız platform üzerinden bildirim gönderin.',
            'Masadaki herkese eşit ilgi ve saygı gösterin — birini ya da bir grubu dışlamak, görmezden gelmek veya yalnızlaştırmak kabul edilemez.',
            'Kendinizi gerçek kimliğinizle tanıtın — masa arkadaşlarınızı yanıltacak bilgiler vermeyin.',
            'Sohbeti tekelleştirmeyin — herkesin konuşma fırsatı bulduğundan emin olmaya gayret edin.',
            'Alkol tüketimi konusunda diğer katılımcılara baskı uygulamayın — herkes kendi tercihini özgürce yapar.',
            'Masada fotoğraf veya video çekmek için diğer katılımcıların açık onayını alın — sosyal medyada paylaşırken kimliği açığa çıkarmayın.',
            'Ticari ürün, hizmet veya yatırım tekliflerini buluşma ortamına taşımayın — Ahenk masaları ticari faaliyet alanı değildir.',
            'Masa arkadaşlarınızın kişisel bilgilerini (telefon, adres, iş yeri) açıkça talep etmeyin — iletişim kurmak istiyorsanız platform üzerinden yapın.',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.65 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </li>
          ))}
        </ul>
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '10px' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#666', marginBottom: '0.6rem' }}>Masada kaçınılacak konular</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
            {[
              'Siyasi parti propagandası veya seçim kampanyası',
              'Dini inançlar üzerinden tartışma veya yargılama',
              'Irk, etnisite, cinsiyet veya cinsel yönelim üzerinden ayrımcı yorum',
              'Kişisel gelir veya servet üzerine baskı kurucu sorular',
              'Diğer kullanıcıların özel hayatına müdahale edecek sorular',
            ].map((item) => (
              <li key={item} style={{ display: 'flex', gap: '0.6rem', color: '#888', fontSize: '0.83rem', lineHeight: 1.55 }}>
                <span style={{ color: '#555', flexShrink: 0 }}>—</span>{item}
              </li>
            ))}
          </ul>
        </div>
      </>
    ),
  },
  {
    n: '04',
    title: 'Buluşma Sonrasında',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.7rem' }}>
        {[
          'Değerlendirmenizi dürüstçe yapın — puanlarınız ve yorumlarınız algoritmanın gelişmesine ve topluluğun kalitesine doğrudan katkı sunar.',
          'Bir katılımcının davranışı sizi rahatsız ettiyse değerlendirme ekranında bildirin veya bilgi@ahenk.co adresine yazın — her bildirim gizlilik içinde değerlendirilir.',
          'Masa arkadaşlarınızın iletişim bilgilerini onların onayı olmadan üçüncü taraflarla paylaşmayın.',
          'Buluşmada edindiğiniz kişisel bilgileri kötüye kullanmayın — bu bilgiler size güven ortamında paylaşılmıştır.',
          'Bir katılımcıyla tekrar eşleşmek istemiyorsanız Rehber Engelleme veya değerlendirme ekranındaki bloklama özelliğini kullanın — taciz veya misilleme niteliğindeki davranışlar hesap kapatma sebebidir.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.65 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '05',
    title: 'Her Zaman Yasak Olan Davranışlar',
    content: (
      <>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem', marginBottom: '1rem' }}>
          {[
            'Herhangi bir kullanıcıya yönelik taciz, tehdit, hakaret veya yıldırma girişimi.',
            'Cinsel içerikli mesaj, teklif veya fiziksel yaklaşım — buluşmalar romantik değil sosyal amaçlıdır.',
            'Irk, etnisite, din, cinsiyet, cinsel yönelim, engellilik veya yaş temelinde ayrımcı tutum ve söylem.',
            'Siyasi parti propagandası, seçim kampanyası veya ideolojik baskı.',
            'Dini baskı, inanç dayatması veya dini ayin çağrısı.',
            'Yasadışı madde kullanımı veya teşviki.',
            'Diğer kullanıcıları dolandırma, kandırma veya manipüle etme girişimi.',
            'Platform verilerini veya diğer kullanıcıların bilgilerini izinsiz toplama, kaydetme veya paylaşma.',
            'Sahte kimlikle katılım veya başka bir kullanıcının kimliğine bürünme.',
            'Ahenk sistemlerine yetkisiz erişim girişimi.',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.65 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </li>
          ))}
        </ul>
        <div style={{ padding: '0.85rem 1.1rem', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: '10px' }}>
          <p style={{ color: '#f5f5f5', fontSize: '0.85rem' }}>
            Bu kurallara aykırı davranış tespitinde hesap <strong>uyarısız ve kalıcı olarak kapatılabilir</strong>.
          </p>
        </div>
      </>
    ),
  },
  {
    n: '06',
    title: 'Çocukların Korunması',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Ahenk yalnızca <strong style={{ color: '#f5f5f5' }}>18 yaş ve üzeri</strong> bireylere yönelik bir platformdur. Reşit olmayan bireyleri platforma dahil etmek veya buluşmalara getirmek kesinlikle yasaktır. Bu ihlal derhal yetkili makamlara bildirilir.
      </p>
    ),
  },
  {
    n: '07',
    title: 'Yaptırımlar',
    content: (
      <>
        <p style={{ marginBottom: '1rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.7 }}>
          Topluluk kurallarının ihlali durumunda Ahenk şu yaptırımları uygulayabilir:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.65rem', marginBottom: '1rem' }}>
          {[
            { level: 'Uyarı', desc: 'Bildirim gönderme — hafif ihlaller için ilk adım.' },
            { level: 'Askıya Alma', desc: 'Hesabı geçici olarak kapatma — 1-30 gün arası.' },
            { level: 'Kalıcı Kapatma', desc: 'Hesabı kalıcı olarak kapatma ve platforma erişimi engelleme.' },
          ].map((row) => (
            <div key={row.level} style={{ display: 'flex', gap: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '10px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: '#c0392b', minWidth: '100px', paddingTop: '0.1rem' }}>{row.level.toUpperCase()}</span>
              <span style={{ color: '#ccc', fontSize: '0.85rem', lineHeight: 1.55 }}>{row.desc}</span>
            </div>
          ))}
        </div>
        <p style={{ color: '#888', fontSize: '0.83rem', lineHeight: 1.65 }}>
          Fiziksel tehdit veya cinsel taciz içeren davranışlar doğrudan kalıcı kapatma ile sonuçlanır ve yetkili makamlara bildirilir. Kapatılan hesaplar için ödenen abonelik ücreti iade edilmez.
        </p>
      </>
    ),
  },
  {
    n: '08',
    title: 'Bildirme ve Şikâyet',
    content: (
      <>
        <p style={{ marginBottom: '1rem', lineHeight: 1.75 }}>
          Bir kullanıcının bu kurallara aykırı davrandığını düşünüyorsanız:
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.55rem', marginBottom: '1rem' }}>
          {[
            'Değerlendirme ekranından bildirebilirsiniz.',
            <span key="email"><a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a> adresine e-posta gönderebilirsiniz.</span>,
          ].map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: '0.65rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.6 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </li>
          ))}
        </ul>
        <p style={{ color: '#888', fontSize: '0.83rem', lineHeight: 1.65 }}>
          Tüm bildirimler gizlilik içinde işlenir, bildiren kişinin kimliği paylaşılmaz. Kötü niyetle yapılan asılsız bildirimler de kural ihlali sayılır.
        </p>
      </>
    ),
  },
  {
    n: '09',
    title: 'Kuralların Güncellenmesi',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Bu kurallar topluluk geri bildirimleri ve platform gelişimine bağlı olarak güncellenebilir. Önemli değişiklikler e-posta ile bildirilir. Platformu kullanmaya devam etmek güncel kuralları kabul etmek anlamına gelir.
      </p>
    ),
  },
  {
    n: '10',
    title: 'İletişim',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
        <p>Sorularınız için:</p>
        <p><a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a></p>
        <p style={{ color: '#888', fontSize: '0.87rem' }}>Metropol İstanbul, Atatürk Mah. Ataşehir Bulvarı, Ertuğrul Gazi Sokak, Ataşehir / İstanbul</p>
        <p><a href="tel:+905403060080" style={{ color: '#c0392b', fontSize: '0.87rem' }}>0540 306 0080</a></p>
        <p style={{ marginTop: '0.5rem', color: '#555', fontSize: '0.82rem' }}>Uyuşmazlıklarda İstanbul Mahkemeleri ve İcra Müdürlükleri yetkilidir.</p>
      </div>
    ),
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: 'easeOut' as const },
  }),
};

export default function ToplulukKurallariPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#121212', color: '#f5f5f5', fontFamily: 'var(--font-sans, system-ui)', position: 'relative' as const, overflow: 'hidden' }}>
      <div style={{ position: 'fixed' as const, top: -120, left: '50%', transform: 'translateX(-50%)', width: 700, height: 340, background: 'radial-gradient(ellipse at center, rgba(192,57,43,0.22) 0%, transparent 70%)', pointerEvents: 'none' as const, zIndex: 0 }} />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#555', fontSize: '0.8rem', letterSpacing: '0.05em', textDecoration: 'none', marginBottom: '2.5rem' }}>
          ← Ana Sayfa
        </Link>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <h1 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 400, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', lineHeight: 1.15 }}>
            Topluluk Kuralları
          </h1>
          <p style={{ marginTop: '0.5rem', color: '#888', fontSize: '0.88rem' }}>
            Ahenk'te herkesin güvende ve rahat hissetmesi için.
          </p>
          <p style={{ marginTop: '0.2rem', color: '#555', fontSize: '0.78rem' }}>
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
              style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.4)', borderRadius: '16px', padding: '1.75rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', color: '#c0392b' }}>{sec.n}</span>
                <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)', fontWeight: 400, color: '#f5f5f5', lineHeight: 1.2 }}>{sec.title}</h2>
              </div>
              <div style={{ color: '#ccc', fontSize: '0.9rem', lineHeight: 1.75 }}>{sec.content}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
