import { COMPANY_ADDRESS, COMPANY_TITLE } from '@/lib/companyInfo';

// KVKK ve Gizlilik metinlerindeki "Kariyer Başvuruları" bölümü; atıflar metne göre verilir
// en: İngilizce yasal sayfalar
const ROWS_EN = (transferRef: string, rightsRef: string): [string, string][] => [
  ['Data Controller', `${COMPANY_TITLE}, ${COMPANY_ADDRESS}`],
  ['Data Processed', 'Full name, email, phone number, date of birth, city and district, education, foreign languages and levels, preferred work type, salary expectation, CV file and the information in it including the photo, LinkedIn link (if provided), application statement and how you heard about us (if provided).'],
  ['Purpose', 'Running the recruitment process, evaluating the candidate and contacting the candidate.'],
  ['Legal Basis', 'KVKK Article 5/2-c (directly related to entering into a contract) and Article 5/2-f (legitimate interest of the data controller).'],
  ['Access', 'Only authorized administrators can access the data and CV file; they are not shared with other users.'],
  ['Retention', 'Data is kept for the periods required by law and the purpose of processing, then deleted, destroyed or anonymized.'],
  ['Transfers and Rights', `${transferRef} applies to transfers of personal data, and ${rightsRef} applies to data subject rights.`],
];

export function CareerDataNotice({ transferRef, rightsRef, en = false }: { transferRef: string; rightsRef: string; en?: boolean }) {
  const rows: [string, string][] = en ? ROWS_EN(transferRef, rightsRef) : [
    ['Veri Sorumlusu', `${COMPANY_TITLE}, ${COMPANY_ADDRESS}`],
    ['İşlenen Veriler', 'Ad soyad, e-posta, telefon numarası, doğum tarihi, şehir ve ilçe, öğrenim durumu, yabancı dil ve seviyeleri, çalışma türü tercihi, ücret beklentisi, özgeçmiş (CV) dosyası ve içinde yer alan fotoğraf dahil bilgiler, LinkedIn bağlantısı (verilirse), başvuru açıklaması ve "beni nereden duydun" bilgisi (verilirse).'],
    ['Amaç', 'İşe alım sürecinin yürütülmesi, adayın değerlendirilmesi ve adayla iletişim kurulması.'],
    ['Hukuki Sebep', 'KVKK m.5/2-c (bir sözleşmenin kurulmasıyla doğrudan ilgili olması) ve m.5/2-f (veri sorumlusunun meşru menfaati).'],
    ['Erişim', 'Verilere ve CV dosyasına yalnızca yetkili yöneticiler erişir, diğer kullanıcılarla paylaşılmaz.'],
    ['Saklama', 'Veriler mevzuatta öngörülen süreler ve işleme amacının gerektirdiği süre boyunca saklanır, sonrasında silinir, yok edilir veya anonim hale getirilir.'],
    ['Aktarım ve Haklar', `Kişisel verilerin aktarımı için ${transferRef}, ilgili kişi hakları için ${rightsRef} geçerlidir.`],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <p>{en ? 'Personal data submitted through the career application form is processed as follows:' : 'Kariyer başvuru formu üzerinden iletilen kişisel veriler aşağıdaki şekilde işlenir:'}</p>
      {rows.map(([label, text]) => (
        <p key={label}>
          <strong style={{ color: '#f4f1ec' }}>{label}:</strong> {text}
        </p>
      ))}
    </div>
  );
}
