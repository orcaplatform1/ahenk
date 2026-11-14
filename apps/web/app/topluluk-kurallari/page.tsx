'use client';

import { motion } from 'framer-motion';
import { COMPANY_ADDRESS, JURISDICTION } from '@/lib/companyInfo';
import { TaxInfo } from '@/components/TaxInfo';

const sections = [
  {
    n: '01',
    title: 'Ahenk Topluluğunun Ruhu',
    content: (
      <p style={{ lineHeight: 1.8 }}>
        Ahenk, yabancıları anlamlı buluşmalarla bir araya getiren bir platformdur. Bu deneyimin kalitesi yalnızca algoritmamıza değil, topluluğumuzdaki her bireyin tutumuna bağlıdır. Bu kurallar bir kısıtlama listesi değil, birlikte inşa ettiğimiz güvenli ve anlamlı bir ortamın temelidir.
        <br /><br />
        <span style={{ color: '#a39c93', fontSize: 13 }}>Platforma katılarak bu kuralları okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan etmiş olursunuz.</span>
      </p>
    ),
  },
  {
    n: '02',
    title: 'Buluşmadan Önce',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.7rem' }}>
        {[
          'Gerçek kimliğinizle kayıt olun. Sahte isim, fotoğraf veya bilgi kullanmak yasaktır ve hesabınızın kalıcı olarak kapatılmasına neden olur.',
          'OCEAN kişilik testini dürüstçe yanıtlayın. Manipüle edilmiş sonuçlar eşleştirme kalitesini düşürür ve topluluğun tamamına zarar verir.',
          'kimlik doğrulama sürecini eksiksiz tamamlayın. Bu hem sizin hem de diğer kullanıcıların güvenliği içindir.',
          'Buluşma daveti aldığınızda katılıp katılmayacağınıza zamanında karar verin. Son dakika iptalleri diğer katılımcıları olumsuz etkiler. Katılamayacaksanız en az 24 saat öncesinden platform üzerinden bildirin.',
          'Buluşma lokasyonunu ve saatini önceden not alın. Ahenk sistem bildirimleri gönderir ancak takip sorumluluğu size aittir.',
          'Buluşmaya gitmeden önce kendinize ait herhangi bir beklenti veya ön yargıyı bir kenara bırakmaya çalışın. Her insan sürpriz yapabilir.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.65 }}>
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
            'Zamanında gelin. 15 dakikadan fazla gecikeceğinizi anlarsanız platform üzerinden bildirim gönderin.',
            'Masadaki herkese eşit ilgi ve saygı gösterin. Birini ya da bir grubu dışlamak, görmezden gelmek veya yalnızlaştırmak kabul edilemez.',
            'Kendinizi gerçek kimliğinizle tanıtın. Masa arkadaşlarınızı yanıltacak bilgiler vermeyin.',
            'Sohbeti tekelleştirmeyin. Herkesin konuşma fırsatı bulduğundan emin olmaya gayret edin.',
            'Alkol tüketimi konusunda diğer katılımcılara baskı uygulamayın. Herkes kendi tercihini özgürce yapar.',
            'Masada fotoğraf veya video çekmek için diğer katılımcıların açık onayını alın. Sosyal medyada paylaşırken kimliği açığa çıkarmayın.',
            'Ticari ürün, hizmet veya yatırım tekliflerini buluşma ortamına taşımayın. Ahenk masaları ticari faaliyet alanı değildir.',
            'Masa arkadaşlarınızın kişisel bilgilerini (telefon, adres, iş yeri) açıkça talep etmeyin. İletişim kurmak istiyorsanız platform üzerinden yapın.',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.65 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </li>
          ))}
        </ul>
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f', marginBottom: '0.6rem' }}>Masada kaçınılacak konular</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
            {[
              'Siyasi parti propagandası veya seçim kampanyası',
              'Dini inançlar üzerinden tartışma veya yargılama',
              'Irk, etnisite, cinsiyet veya cinsel yönelim üzerinden ayrımcı yorum',
              'Kişisel gelir veya servet üzerine baskı kurucu sorular',
              'Diğer kullanıcıların özel hayatına müdahale edecek sorular',
            ].map((item) => (
              <li key={item} style={{ display: 'flex', gap: '0.6rem', color: '#a39c93', fontSize: 13, lineHeight: 1.55 }}>
                <span style={{ color: '#8f887f', flexShrink: 0 }}>—</span>{item}
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
          'Değerlendirmenizi dürüstçe yapın. Puanlarınız ve yorumlarınız algoritmanın gelişmesine ve topluluğun kalitesine doğrudan katkı sunar.',
          'Bir katılımcının davranışı sizi rahatsız ettiyse değerlendirme ekranında bildirin veya bilgi@ahenk.co adresine yazın. Her bildirim gizlilik içinde değerlendirilir.',
          'Masa arkadaşlarınızın iletişim bilgilerini onların onayı olmadan üçüncü taraflarla paylaşmayın.',
          'Buluşmada edindiğiniz kişisel bilgileri kötüye kullanmayın. Bu bilgiler size güven ortamında paylaşılmıştır.',
          'Bir katılımcıyla tekrar eşleşmek istemiyorsanız Rehber Engelleme veya değerlendirme ekranındaki bloklama özelliğini kullanın. Taciz veya misilleme niteliğindeki davranışlar hesap kapatma sebebidir.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.65 }}>
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
            'Cinsel içerikli mesaj, teklif veya fiziksel yaklaşım. Buluşmalar romantik değil sosyal amaçlıdır.',
            'Irk, etnisite, din, cinsiyet, cinsel yönelim, engellilik veya yaş temelinde ayrımcı tutum ve söylem.',
            'Siyasi parti propagandası, seçim kampanyası veya ideolojik baskı.',
            'Dini baskı, inanç dayatması veya dini ayin çağrısı.',
            'Yasadışı madde kullanımı veya teşviki.',
            'Diğer kullanıcıları dolandırma, kandırma veya manipüle etme girişimi.',
            'Platform verilerini veya diğer kullanıcıların bilgilerini izinsiz toplama, kaydetme veya paylaşma.',
            'Sahte kimlikle katılım veya başka bir kullanıcının kimliğine bürünme.',
            'Ahenk sistemlerine yetkisiz erişim girişimi.',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.65 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </li>
          ))}
        </ul>
        <div style={{ padding: '0.85rem 1.1rem', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: '10px' }}>
          <p style={{ color: '#f4f1ec', fontSize: 13 }}>
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
        Ahenk yalnızca <strong style={{ color: '#f4f1ec' }}>18 yaş ve üzeri</strong> bireylere yönelik bir platformdur. Reşit olmayan bireyleri platforma dahil etmek veya buluşmalara getirmek kesinlikle yasaktır. Bu ihlal derhal yetkili makamlara bildirilir.
      </p>
    ),
  },
  {
    n: '07',
    title: 'Yaptırımlar',
    content: (
      <>
        <p style={{ marginBottom: '1rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.7 }}>
          Topluluk kurallarının ihlali durumunda Ahenk şu yaptırımları uygulayabilir:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.65rem', marginBottom: '1rem' }}>
          {[
            { level: 'Uyarı', desc: 'Bildirim gönderme: hafif ihlaller için ilk adım.' },
            { level: 'Askıya Alma', desc: 'Hesabı geçici olarak kapatma: 1-30 gün arası.' },
            { level: 'Kalıcı Kapatma', desc: 'Hesabı kalıcı olarak kapatma ve platforma erişimi engelleme.' },
          ].map((row) => (
            <div key={row.level} style={{ display: 'flex', gap: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.06em', color: '#c0392b', minWidth: '100px', paddingTop: '0.1rem' }}>{row.level.toUpperCase()}</span>
              <span style={{ color: '#c9c2b8', fontSize: 13, lineHeight: 1.55 }}>{row.desc}</span>
            </div>
          ))}
        </div>
        <p style={{ color: '#a39c93', fontSize: 13, lineHeight: 1.65 }}>
          Fiziksel tehdit veya cinsel taciz içeren davranışlar doğrudan kalıcı kapatma ile sonuçlanır ve yetkili makamlara bildirilir.
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
            <li key={i} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </li>
          ))}
        </ul>
        <p style={{ color: '#a39c93', fontSize: 13, lineHeight: 1.65 }}>
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
        <p style={{ color: '#a39c93', fontSize: 13 }}>{COMPANY_ADDRESS}</p>
        <TaxInfo />
        <p><a href="tel:+905403060080" style={{ color: '#c0392b', fontSize: 13 }}>0540 306 0080</a></p>
        <p style={{ marginTop: '0.5rem', color: '#8f887f', fontSize: 13 }}>{JURISDICTION}</p>
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
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <h1 className="ll-title">
            Topluluk Kuralları
          </h1>
          <p style={{ marginTop: '0.5rem', color: '#a39c93', fontSize: 13 }}>
            Ahenk'te herkesin güvende ve rahat hissetmesi için.
          </p>
          <p style={{ marginTop: '0.2rem', color: '#8f887f', fontSize: 11 }}>
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
                <h2 className="ll-title">{sec.title}</h2>
              </div>
              <div style={{ color: '#c9c2b8', fontSize: 13, lineHeight: 1.75 }}>{sec.content}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
