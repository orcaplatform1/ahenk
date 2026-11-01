import { COMPANY_ADDRESS, COMPANY_TITLE } from '@/lib/companyInfo';

// KVKK ve Gizlilik metinlerindeki "Kariyer Başvuruları" bölümü; atıflar metne göre verilir
export function CareerDataNotice({ transferRef, rightsRef }: { transferRef: string; rightsRef: string }) {
  const rows: [string, string][] = [
    ['Veri Sorumlusu', `${COMPANY_TITLE}, ${COMPANY_ADDRESS}`],
    ['İşlenen Veriler', 'Ad soyad, e-posta, telefon numarası, doğum tarihi, şehir ve ilçe, öğrenim durumu, yabancı dil ve seviyeleri, çalışma türü tercihi, ücret beklentisi, özgeçmiş (CV) dosyası ve içinde yer alan fotoğraf dahil bilgiler, LinkedIn bağlantısı (verilirse), başvuru açıklaması ve "bizi nereden duydun" bilgisi (verilirse).'],
    ['Amaç', 'İşe alım sürecinin yürütülmesi, adayın değerlendirilmesi ve adayla iletişim kurulması.'],
    ['Hukuki Sebep', 'KVKK m.5/2-c (bir sözleşmenin kurulmasıyla doğrudan ilgili olması) ve m.5/2-f (veri sorumlusunun meşru menfaati).'],
    ['Erişim', 'Verilere ve CV dosyasına yalnızca yetkili yöneticiler erişir, diğer kullanıcılarla paylaşılmaz.'],
    ['Saklama', 'Veriler mevzuatta öngörülen süreler ve işleme amacının gerektirdiği süre boyunca saklanır, sonrasında silinir, yok edilir veya anonim hale getirilir.'],
    ['Aktarım ve Haklar', `Kişisel verilerin aktarımı için ${transferRef}, ilgili kişi hakları için ${rightsRef} geçerlidir.`],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <p>Kariyer başvuru formu üzerinden iletilen kişisel veriler aşağıdaki şekilde işlenir:</p>
      {rows.map(([label, text]) => (
        <p key={label}>
          <strong style={{ color: '#f4f1ec' }}>{label}:</strong> {text}
        </p>
      ))}
    </div>
  );
}
