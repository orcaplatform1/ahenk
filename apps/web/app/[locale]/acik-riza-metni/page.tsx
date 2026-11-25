'use client';
import { useLocale } from 'next-intl';
import ConsentEn from './ConsentEn';
import { motion } from 'framer-motion';
import { COMPANY_ADDRESS, COMPANY_TITLE } from '@/lib/companyInfo';

const sections: { n: string; title: string; body: string[] }[] = [
  {
    n: '01',
    title: "Veri Sorumlusu",
    body: [
      "6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca veri sorumlusu " + COMPANY_TITLE + ". Bu metin, kimlik doğrulama adımında işlenen biyometrik veriler için açık rızanı almak amacıyla hazırlanmıştır.",
    ],
  },
  {
    n: '02',
    title: "Açık Rızaya Konu Veri",
    body: [
      "Kimlik doğrulama sırasında çektiğin canlılık videosu (yüz görüntün ve videoda söylediğin cümle) ve bu videodaki yüzünün kimlik belgendeki fotoğrafla karşılaştırılması (yüz eşleştirme).",
      "Bu veriler KVKK madde 6 kapsamında biyometrik veri, yani özel nitelikli kişisel veridir.",
    ],
  },
  {
    n: '03',
    title: "İşleme Amacı",
    body: [
      "Hesabın sahibinin gerçek bir kişi olduğunu ve kimlik belgesindeki kişiyle aynı olduğunu doğrulamak, sahte profillerin platformu kullanmasını engellemek ve masadaki herkesin doğrulanmış kişiler olmasını sağlamak.",
      "Yüz eşleştirme, kimlik doğrulama ekibimiz tarafından canlılık videosunun kimlik belgesindeki fotoğrafla karşılaştırılmasıyla yapılır.",
    ],
  },
  {
    n: '04',
    title: "Hukuki Sebep",
    body: [
      "Biyometrik veriler KVKK madde 6 uyarınca yalnız açık rızana dayanılarak işlenir. Açık rıza, kimlik doğrulama adımında canlılık videosundan önce ayrı bir onay kutusuyla alınır; kutu işaretlenmeden bu adıma geçilemez.",
      "Onayın; belge türü, belge versiyonu, tarih-saat, IP adresi ve platform (web / iOS / Android) bilgisiyle kayıt altına alınır.",
    ],
  },
  {
    n: '05',
    title: "Kimlik Belgesindeki Diğer Özel Nitelikli Veriler",
    body: [
      "Kimlik belgelerinde özel nitelikli veriler bulunabilir (örneğin ehliyette kan grubu). Bu veriler okunmaz, ayrıca kaydedilmez ve hiçbir amaçla işlenmez.",
    ],
  },
  {
    n: '06',
    title: "Saklama ve Güvenlik",
    body: [
      "Kimlik belgesi görselleri ve canlılık videosu Ahenk sunucusunda AES-256-GCM ile şifreli saklanır, yurt dışına aktarılmaz ve yalnız yetkili yöneticiler tarafından görüntülenebilir.",
      "Hesap silme talebin onaylandıktan sonra 48 saat içinde silinir. İstisna: Acil Yardım, şikâyet veya ban kaydına karışmış kullanıcının kimliği kilitli tutulur, 2 yıl saklanır ve yalnız SUPERADMIN erişir (KVKK m.5/2-e).",
    ],
  },
  {
    n: '07',
    title: "Rızanın Geri Alınması",
    body: [
      "Açık rızanı dilediğin zaman bilgi@ahenk.co adresine yazarak geri alabilirsin. Rızanı geri aldığında kimlik doğrulaman yapılamaz; kimliği doğrulanmamış kullanıcı masalara katılamaz. Geri alma, o tarihe kadar yapılan işlemleri etkilemez.",
      "KVKK madde 11 kapsamındaki diğer hakların için KVKK Aydınlatma Metni'ni inceleyebilirsin.",
    ],
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

function AcikRizaMetniTr() {
  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <h1 className="ll-title">
            Açık Rıza Metni
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
              <div style={{ color: '#c9c2b8', fontSize: 13, lineHeight: 1.75, display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' }}>
                {sec.body.map((p, j) => <p key={j}>{p}</p>)}
              </div>
            </motion.div>
          ))}
        </div>

        <p style={{ marginTop: '2rem', color: '#a39c93', fontSize: 13 }}>
          Sorular ve rızanı geri almak için: <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a> · {COMPANY_ADDRESS}
        </p>
      </div>
    </main>
  );
}

// Arayüz dili İngilizceyse İngilizce çeviri (çelişkide Türkçe metin geçerlidir)
export default function AcikRizaMetniPage() {
  return useLocale() === 'en' ? <ConsentEn /> : <AcikRizaMetniTr />;
}
