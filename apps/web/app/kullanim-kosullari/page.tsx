'use client';

import { motion } from 'framer-motion';
import { PlanPriceText } from '@/components/PlanPrice';
import { COMPANY_ADDRESS, JURISDICTION } from '@/lib/companyInfo';
import { TaxInfo } from '@/components/TaxInfo';

const sections = [
  {
    n: '01',
    title: 'Taraflar ve Kapsam',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Bu kullanım koşulları, {COMPANY_ADDRESS} adresinde faaliyet gösteren <strong style={{ color: '#f4f1ec' }}>Ahenk</strong> platformu ile platforma üye olan <strong style={{ color: '#f4f1ec' }}>Kullanıcı</strong> arasındaki hak ve yükümlülükleri düzenler. Platforma üye olarak veya platformu kullanarak bu koşulları kabul etmiş sayılırsınız.
      </p>
    ),
  },
  {
    n: '02',
    title: 'Hizmet Tanımı',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Ahenk, <strong style={{ color: '#f4f1ec' }}>OCEAN Big Five</strong> kişilik modeline dayalı algoritmik eşleştirme sistemiyle kullanıcıları şehirlerindeki restoran ve kafelerde grup masası veya başbaşa buluşmalar için bir araya getiren dijital bir sosyal platform hizmetidir. Ahenk; mekan seçimi, masa rezervasyonu ve algoritmik eşleştirmeyi organize eder ancak buluşma sırasında yaşanan kişisel deneyimlerden sorumlu tutulamaz.
      </p>
    ),
  },
  {
    n: '03',
    title: 'Üyelik Koşulları',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'Platforma üye olmak için 18 yaşını doldurmuş olmak zorunludur.',
          'Gerçek kimlik bilgileriyle kayıt yapılması gerekir; sahte veya başkasına ait bilgilerle kayıt yasaktır.',
          'Her kullanıcı yalnızca bir hesap açabilir — birden fazla hesap tespitinde tüm hesaplar kapatılır.',
          'kimlik doğrulama süreci zorunludur; doğrulama tamamlanmadan paket satın alınamaz ve masa eşleştirmesine dahil olunamaz.',
          'Üyelik sırasında verilen bilgilerin güncel ve doğru tutulması kullanıcının sorumluluğundadır.',
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
    title: 'Kullanıcı Yükümlülükleri',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'Platforma kayıt sırasında gerçek ad, soyad, doğum tarihi ve cinsiyet bilgilerini doğru olarak girmek.',
          'kimlik doğrulama sürecinde gerçek kimlik belgesini ve liveness videosunu yüklemek.',
          'OCEAN kişilik testini dürüstçe ve gerçek kişiliği yansıtacak şekilde yanıtlamak.',
          'Buluşmalarda diğer katılımcılara saygılı ve dürüst davranmak.',
          'Platform kurallarına ve Türkiye Cumhuriyeti yasalarına uymak.',
          'Hesap bilgilerini ve şifresini üçüncü kişilerle paylaşmamak.',
          'Platformu yalnızca belirtilen amaçlar doğrultusunda kullanmak.',
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
    title: 'Yasaklı Davranışlar',
    content: (
      <>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem', marginBottom: '1rem' }}>
          {[
            'Sahte veya yanıltıcı profil oluşturmak.',
            'Başka bir kullanıcının kimliğine bürünmek.',
            'Diğer kullanıcılara yönelik taciz, tehdit, hakaret veya ayrımcı davranış sergilemek.',
            'Buluşmalar sırasında veya platform üzerinden ticari ürün veya hizmet satmaya çalışmak.',
            'Platformu spam, reklam veya promosyon amaçlı kullanmak.',
            'Algoritma veya eşleştirme sistemini manipüle etmeye çalışmak.',
            'Yasadışı içerik paylaşmak veya yasadışı faaliyetleri teşvik etmek.',
            'Platform altyapısına zarar vermeye yönelik girişimlerde bulunmak.',
            'Başka kullanıcıların kişisel bilgilerini izinsiz toplamak veya paylaşmak.',
          ].map((item) => (
            <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
              <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
            </li>
          ))}
        </ul>
        <div style={{ padding: '0.85rem 1.1rem', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: '10px' }}>
          <p style={{ color: '#f4f1ec', fontSize: 13 }}>
            Bu yasaklara aykırı davranış tespitinde hesap <strong>uyarısız kapatılabilir</strong>.
          </p>
        </div>
      </>
    ),
  },
  {
    n: '06',
    title: 'Paketler ve Ödeme',
    content: (
      <>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.65rem', marginBottom: '1.25rem' }}>
          {[
            { name: 'Masada', price: <PlanPriceText plan="MASADA" suffix="₺" />, desc: '2 grup masası hakkı, 4 döngü geçerli' },
            { name: 'Karşımda', price: <PlanPriceText plan="KARSIMDA" suffix="₺" />, desc: '1 başbaşa masası hakkı, 4 döngü geçerli' },
            { name: 'İçerde', price: <PlanPriceText plan="ICERDE" suffix="₺" />, desc: '2 grup + 1 başbaşa masası hakkı (her kısım 4 döngü geçerli), öncelikli eşleştirme' },
            { name: 'Kankamla', price: <PlanPriceText plan="KANKAMLA" suffix="₺" />, desc: '2 Kankamla masası hakkı (4 döngü geçerli); alıcı öder, aynı cinsiyetteki kankası ücretsiz katılır, 4 kişilik masa' },
          ].map((pkg) => (
            <div key={pkg.name} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
              <span style={{ fontWeight: 700, color: '#f4f1ec', minWidth: '90px', fontSize: 13 }}>{pkg.name}</span>
              <span style={{ color: '#ff6b6b', fontWeight: 700, fontSize: 13, minWidth: '80px' }}>{pkg.price}</span>
              <span style={{ color: '#a39c93', fontSize: 13 }}>{pkg.desc}</span>
            </div>
          ))}
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
          {[
            'Ödemeler iyzico Ödeme Hizmetleri A.Ş. altyapısı üzerinden kredi kartı veya banka kartıyla tahsil edilir.',
            'Paketler tek seferliktir; abonelik ve otomatik yenileme yoktur. Haklar kullanıldığında ya da 4 döngü (yaklaşık 1 ay) dolduğunda paket sona erer.',
            'Fiyatlar KDV dahildir.',
            'Ahenk, makul süre öncesinden bildirim yapmak kaydıyla paket fiyatlarını güncelleme hakkını saklı tutar.',
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
    n: '07',
    title: 'İptal ve İade Politikası',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'Paketler tek seferlik olduğundan iptal edilecek bir abonelik yoktur.',
          'Paketin bir kısmında 4 döngü boyunca hiç masa kurulamazsa o kısım için iade talep edilebilir (İçerde paketinde grup ve başbaşa kısımları ayrı değerlendirilir).',
          'Bir masa kurulduysa kalan hak bulunsa dahi hizmet alınmış sayılır ve iade yapılmaz; kullanılmayan haklar için kısmi iade yapılmaz.',
          'Kankamla rezervasyonunu çiftten biri iptal ederse iki kişi birlikte masadan düşer ve paketten 1 masa hakkı düşer; pakette tek iptal hakkı vardır.',
          'Kanka daveti telefon numarasıyla yapılır ve 48 saat geçerlidir; davet yalnızca o numarayı doğrulamış hesap tarafından kabul edilebilir. Kanka, seçildiği hafta değiştirilemez. Bir kullanıcının banlanması kankalığı sona erdirir.',
          'kimlik doğrulaması tamamlanmamış kullanıcılar eşleştirmeye dahil edilmez; bu nedenle iade talep edilemez.',
          'Hesabın Ahenk tarafından kural ihlali nedeniyle kapatılması durumunda kalan haklar için iade yapılmaz.',
          'Masa kurulduktan sonra bir veya birden fazla katılımcının buluşmaya katılmaması, hizmetin ifa edilmediği anlamına gelmez ve iade sebebi teşkil etmez.',
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
    title: 'Eşleştirme Algoritması ve Hizmet Garantisi',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'Ahenk, OCEAN Big Five modeline dayalı algoritmik eşleştirme yapar ancak belirli bir kişiyle eşleşme garantisi vermez.',
          'Ahenk, eşleştirme sonucunda kurulan masada yer alan katılımcıların tamamının buluşmaya katılacağını garanti etmez. Buluşmaya katılım her kullanıcının kendi iradesine bağlıdır ve Ahenk tarafından zorunlu tutulamaz.',
          'Ahenk, masaların kurulabilmesi ve katılımcı dengesinin sağlanabilmesi amacıyla masa kompozisyonunda sistemsel düzenlemeler yapma hakkını saklı tutar.',
          'Ahenk, buluşma günü OCEAN uyum skorlarını yapay zeka yardımıyla analiz ederek gruba özel bir masa raporu oluşturabilir. Bu rapor yalnızca grup uyumunu özetleyen bilgilendirici bir içeriktir; herhangi bir taahhüt ya da garanti oluşturmaz.',
          'Kullanıcı sayısının yetersiz olduğu şehir veya dönemlerde eşleştirme gerçekleşmeyebilir; bu durumda ilgili dönem için iade değerlendirilebilir.',
          'Ahenk, buluşmanın gerçekleşeceği mekanın kalitesini veya hizmetini garanti etmez.',
          'Buluşma sırasında yaşanan kişisel anlaşmazlıklardan Ahenk sorumlu tutulamaz.',
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
    title: 'Hesap Askıya Alma ve Kapatma',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Kullanım koşullarının ihlali, sahte kimlik kullanımı, başka kullanıcılara zarar verici davranış veya yasal düzenlemelere aykırı eylemler tespit edildiğinde Ahenk, kullanıcı hesabını önceden bildirim yapmaksızın geçici olarak askıya alabilir veya kalıcı olarak kapatabilir. Hesap kapatma kararı Ahenk'in takdir yetkisindedir. Kapatılan hesabın yeniden açılması talep edilebilir; değerlendirme Ahenk tarafından yapılır.
      </p>
    ),
  },
  {
    n: '10',
    title: 'Fikri Mülkiyet',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Ahenk platformundaki tüm tasarım, yazılım, içerik, logo, marka adı ve algoritmalar Ahenk'e aittir veya lisanslıdır. Kullanıcılar bu içerikleri <strong style={{ color: '#f4f1ec' }}>izinsiz kopyalayamaz</strong>, dağıtamaz veya ticari amaçla kullanamaz.
      </p>
    ),
  },
  {
    n: '11',
    title: 'Sorumluluk Sınırı',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
        {[
          'Ahenk, platform üzerinden gerçekleşen buluşmalar sırasında veya sonrasında kullanıcılar arasında yaşanan kişisel anlaşmazlıklardan, maddi veya manevi zararlardan sorumlu tutulamaz.',
          "Ahenk'in sorumluluğu her halükarda ilgili paket için ödenen ücret ile sınırlıdır.",
          'Mücbir sebep halleri (doğal afet, pandemi, altyapı kesintisi vb.) nedeniyle hizmetin aksamasından Ahenk sorumlu tutulamaz.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '12',
    title: 'Koşulların Değiştirilmesi',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Ahenk, bu kullanım koşullarını önceden bildirimde bulunmak kaydıyla güncelleme hakkını saklı tutar. Güncellemeler e-posta veya platform bildirimi aracılığıyla duyurulur. Güncelleme sonrası platformu kullanmaya devam etmek yeni koşulları kabul etmek anlamına gelir.
      </p>
    ),
  },
  {
    n: '13',
    title: 'İletişim',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.45rem' }}>
        <p>Her türlü soru, şikâyet ve talep için:</p>
        <p><a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a></p>
        <p style={{ color: '#a39c93', fontSize: 13 }}>{COMPANY_ADDRESS}</p>
        <TaxInfo />
        <p style={{ color: '#a39c93', fontSize: 13 }}><a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a></p>
      </div>
    ),
  },
  {
    n: '14',
    title: 'Uyuşmazlık ve Yetkili Mahkeme',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Bu kullanım koşullarından doğan veya bunlarla bağlantılı her türlü uyuşmazlıkta <strong style={{ color: '#f4f1ec' }}>Türkiye Cumhuriyeti hukuku</strong> uygulanır. {JURISDICTION}
      </p>
    ),
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.5, ease: 'easeOut' as const },
  }),
};

export default function KullanimKosullariPage() {
  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <h1 className="ll-title">
            Kullanım Koşulları
          </h1>
          <p style={{ marginTop: '0.6rem', color: '#8f887f', fontSize: 13 }}>
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
