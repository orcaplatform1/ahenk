'use client';
import { useLocale } from 'next-intl';
import PrivacyEn from './PrivacyEn';

import Link from 'next/link';
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
        <p>
          Ahenk platformunun veri sorumlusu {COMPANY_TITLE}&apos;dır. Aşağıdaki iletişim bilgilerini kullanabilirsin:
        </p>
        <div
          style={{
            marginTop: '1rem',
            padding: '1.25rem 1.5rem',
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '0.5rem',
          }}
        >
          <p>
            <span style={{ color: '#a39c93' }}>Adres:</span>{' '}
            {COMPANY_ADDRESS}
          </p>
          <TaxInfo />
          <p>
            <span style={{ color: '#a39c93' }}>E-posta:</span>{' '}
            <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a>
          </p>
          <p>
            <span style={{ color: '#a39c93' }}>Telefon:</span>{' '}
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
        <List items={['Ad ve soyad', 'E-posta adresi', 'Doğum tarihi', 'Cinsiyet']} />
        <SubTitle style={{ marginTop: '1.25rem' }}>Konum Verileri</SubTitle>
        <List
          items={[
            'Şehir tercihi: katılmak istediğin şehir (ve varsa ikinci tercih şehir); eşleştirmede kullanılır',
            'Acil Yardım hassas konumu: yalnız Acil Yardım butonuna basıldığında toplanır, talep çözülene kadar canlı alınır, ekibimize, acil durum kişilerine ve emniyet birimlerine iletilir. Talep çözülünce koordinatlar silinir, son açık adres 2 yıl saklanır. Hukuki sebep: KVKK m.5/2-b (hayati menfaat) ve m.5/2-ç (hukuki yükümlülük)',
          ]}
        />

        <SubTitle style={{ marginTop: '1.25rem' }}>Kimlik Doğrulama Sırasında</SubTitle>
        <p style={{ color: '#a39c93', fontSize: 13, marginBottom: '0.6rem' }}>
          Kimlik belgesi kimlik doğrulama ve sahte profillerin engellenmesi için işlenir (KVKK m.5/2-c ve m.5/2-f). Canlılık videosu ve yüz eşleştirme <strong style={{ color: '#f4f1ec' }}>biyometrik veri, yani özel nitelikli kişisel veridir</strong> ve yalnız açık rızanla işlenir (KVKK m.6; <a href="/acik-riza-metni" style={{ color: '#c0392b' }}>Açık Rıza Metni</a>).
        </p>
        <List
          items={[
            'Kimlik belgesi türü ve belge görselleri (ön ve arka yüz; pasaportta fotoğraflı sayfa). Belgede bulunabilecek özel nitelikli veriler (örneğin ehliyette kan grubu) işlenmez',
            'Canlılık videosu ve yüz eşleştirme (videodaki yüzün kimlik belgesindeki fotoğrafla karşılaştırılması)',
          ]}
        />

        <SubTitle style={{ marginTop: '1.25rem' }}>Platform Kullanımı Sırasında</SubTitle>
        <List
          items={[
            'OCEAN kişilik testi sonuçları ve skorları (KVKK m.5/2-c)',
            'Masa buluşma geçmişi',
            'Değerlendirme ve yorum verileri',
            'Rehber engelleme listesi: eklenen telefon numaraları',
            'Ekran görüntüsü ihlal kayıtları: ekran görüntüsünü alan kullanıcı, fotoğrafı görüntülenen kullanıcı, platform ve tarih-saat bilgisi. Kayıtları yalnız ADMIN ve SUPERADMIN görür',
            'Canlı destek sohbet kayıtları: destek konusu, mesajlar, gönderdiğin görseller, saat ve okundu bilgisi, temsilci numarası, temsilcilerin iç notları ve devir notları, değerlendirmen; destek amaçlı yapay zekâ asistanı (Claude Haiku) sorgu kayıtları',
          ]}
        />

        <SubTitle style={{ marginTop: '1.25rem' }}>Teknik Veriler</SubTitle>
        <List items={['IP adresi', 'Tarayıcı türü', 'Cihaz bilgisi', 'Oturum verileri', 'Giriş kayıtları (IP, tarayıcı bilgisi, platform, tarih-saat, başarılı / başarısız)', 'Mesafeli satış, ön bilgilendirme ve biyometrik açık rıza onay kayıtları (belge türü ve versiyonu, tarih-saat, IP, platform, paket)', 'Çerez verileri']} />
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
          'Kimlik doğrulama sürecinin yürütülmesi ve güvenli platform ortamının sağlanması',
          'OCEAN kişilik modeline dayalı algoritmik eşleştirme ile uyumlu masa buluşmalarının organize edilmesi',
          'Masa uyum raporu oluşturulması: buluşma günü sabahı onaylı masadaki her katılımcı için adı yerine P1, P2 gibi bir etiketle beş OCEAN skoru ve varsa meslek alanı; ayrıca masa türü, katılımcı sayısı ve masanın genel uyum skoru yapay zekâ hizmeti Anthropic\'e gönderilir; oluşan rapor masa katılımcılarına masa kartında gösterilir. Ad, cinsiyet, yaş, iletişim ve kimlik bilgisi yapay zekâ sistemine aktarılmaz',
          'Masa sohbeti denetimi: şüpheli kelime içeren sohbet mesajının yalnız metni (en fazla 1.000 karakter) kural ihlali kontrolü için yapay zekâ hizmeti Anthropic\'e gönderilir. Gönderenin adı, kimliği ve masa bilgisi gönderilmez',
          'Paket satın alma ve ödeme işlemlerinin gerçekleştirilmesi',
          'Kullanıcıyla push bildirimi ve WhatsApp aracılığıyla iletişim kurulması',
          'Yasal yükümlülüklerin yerine getirilmesi ve yetkili kurumlara bildirim yapılması',
          'Platform güvenliğinin sağlanması ve kötüye kullanımın önlenmesi',
          'Ekran görüntüsü ihlal kayıtları: topluluk kurallarının uygulanması ve kullanıcıların kişisel verilerinin korunması',
          'Canlı destek hizmetinin yürütülmesi: taleplerinin yanıtlanması, hizmet kalitesinin artırılması ve güvenliğin için görüşmelerin kayıt altına alınması (KVKK m.5/2-c ve m.5/2-f). Canlı destek sohbetinde yazdığın metin, göndermeden önce müşteri temsilcisinin ekranında anlık olarak görünebilir. Gönderilmeyen metin kaydedilmez.',
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
            basis: 'Açık Rıza: KVKK Madde 6',
            desc: 'Canlılık videosu ve yüz eşleştirme (biyometrik veri)',
          },
          {
            basis: 'Sözleşmenin İfası: KVKK Madde 5/2-c',
            desc: 'Kayıt, OCEAN kişilik testi, kimlik belgesi, ödeme ve hizmet sunumu, yapay zekâ masa uyum raporu, push bildirimleri ve WhatsApp doğrulama kodu (OTP), ekran görüntüsü ihlal kayıtları',
          },
          {
            basis: 'Meşru Menfaat: KVKK Madde 5/2-f',
            desc: 'Platform güvenliği, teknik veriler, kimlik belgesi (sahte profillerin engellenmesi), masa sohbeti denetimi (sohbet moderasyonu), sorun bildirimleri, banlı kullanıcının okunamaz telefon özeti, ekran görüntüsü ihlal kayıtları',
          },
          {
            basis: 'Yasal Yükümlülük: KVKK Madde 5/2-ç',
            desc: 'Mali kayıtlar, mesafeli satış ve ticari ileti onay kayıtları, giriş / IP kayıtları ve sunucu logları (5651), yetkili kurum talepleri',
          },
          {
            basis: 'Hayati Menfaat ve Yasal Yükümlülük: KVKK Madde 5/2-b ve 5/2-ç',
            desc: 'Acil Yardım konumu ve emniyet birimleriyle paylaşım',
          },
          {
            basis: 'Hakkın Tesisi, Kullanılması veya Korunması: KVKK Madde 5/2-e',
            desc: 'Acil Yardım, şikâyet veya ban kaydına karışmış kullanıcının kimliği, Acil Yardım talebinin son açık adresi, şikâyet ve moderasyon kayıtları',
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
            <p style={{ fontWeight: 600, color: '#f4f1ec', marginBottom: '0.25rem' }}>{row.basis}</p>
            <p style={{ color: '#a39c93', fontSize: 13 }}>{row.desc}</p>
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
          ['Ödeme ve fatura kayıtları (iyzico, App Store, Google Play)', '10 yıl (TTK m.82, VUK m.253), işlemin yapıldığı yılı izleyen takvim yılı başından. Hesap silinse de saklanır; süre sonunda kişisel alanlar anonimleştirilir. Hukuki sebep: KVKK m.5/2-ç'],
          ['Mesafeli satış onay kayıtları (mesafeli satış sözleşmesi ve ön bilgilendirme onayı)', '3 yıl (Mesafeli Sözleşmeler Yönetmeliği). Hukuki sebep: KVKK m.5/2-ç'],
          ['Ticari elektronik ileti onayları', 'Onayın sona ermesinden itibaren 3 yıl. Hukuki sebep: KVKK m.5/2-ç'],
          ['Giriş / IP kayıtları ve sunucu (nginx) logları', '2 yıl (5651 sayılı Kanun). Hukuki sebep: KVKK m.5/2-ç'],
          ['Kimlik belgeleri ve canlılık videosu', 'Hesap silme onayından sonra 48 saat içinde silinir. İstisna: Acil Yardım, şikâyet veya ban kaydına karışmış kullanıcının kimliği kilitli tutulur, 2 yıl saklanır ve yalnız SUPERADMIN erişir. Hukuki sebep: KVKK m.5/2-e'],
          ['Acil Yardım kaydı', 'Koordinat ve konum geçmişi talep çözülünce silinir, son açık adres 2 yıl saklanır. Hukuki sebep: KVKK m.5/2-b ve m.5/2-e'],
          ['Şikâyet ve moderasyon kayıtları ile şikâyet edilen mesajlar', '2 yıl. Hukuki sebep: KVKK m.5/2-e'],
          ['Ekran görüntüsü ihlal kayıtları', '2 yıl (şikâyet ve moderasyon kayıtlarıyla aynı). Hukuki sebep: KVKK m.5/2-f ve m.5/2-c'],
          ['Şikâyet edilmemiş masa sohbeti mesajları', 'Masa tarihinden 6 ay sonra silinir. Hukuki sebep: KVKK m.5/2-c'],
          ['Sorun bildirimleri', '2 yıl. Hukuki sebep: KVKK m.5/2-f'],
          ['Canlı destek sohbetleri, görseller, iç notlar, değerlendirmeler ve yapay zekâ sorgu kayıtları', '2 yıl. Hesap silinince sohbetin hesapla bağı koparılır, ad soyad anonimleştirilir. Hukuki sebep: KVKK m.5/2-c ve m.5/2-f'],
          ['Profil, kişilik testi (OCEAN) ve push token', 'Hesap silinene kadar. Hukuki sebep: KVKK m.5/2-c'],
          ['Banlı kullanıcının okunamaz telefon özeti', 'Ban süresince. Hukuki sebep: KVKK m.5/2-f'],
          ['Çerezler', 'Oturum çerezi 365 gün; ayrıntılar Çerez Politikası\'nda'],
          ['KVKK aydınlatma ve açık rıza onay kayıtları', 'Hesabın silinmesinden itibaren 10 yıl (TBK genel zamanaşımı)'],
          ['Diğer veriler: rehber ve kullanıcı engelleri', 'Hesap silme talebi onaylanınca silinir; rehber engelleri kullanıcı silince de silinir'],
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
            <span style={{ color: '#a39c93', fontSize: 13, textAlign: 'right' as const, flex: 1 }}>{value}</span>
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
          <strong style={{ color: '#f4f1ec' }}>iyzico Ödeme Hizmetleri A.Ş.</strong>
          : ödeme tahsilatı ve paket yönetimi amacıyla.
        </p>

        <p>
          <strong style={{ color: '#f4f1ec' }}>Kimlik belgeleri ve liveness videosu</strong>
          : Ahenk&apos;in kendi sunucusunda AES-256-GCM ile şifreli saklanır, yalnızca yetkili yöneticiler görüntüleyebilir ve hiçbir üçüncü tarafla paylaşılmaz.
        </p>

        <SubTitle style={{ marginTop: '1.25rem' }}>Yurt Dışı Aktarımlar</SubTitle>
        <p>
          <strong style={{ color: '#f4f1ec' }}>Meta Platforms (WhatsApp Business API)</strong>
          : telefon numarası, WhatsApp doğrulama kodu ve kritik bildirimlerin (kimlik doğrulama sonucu, masa onayı) iletilmesi amacıyla. İşleme sebebi: KVKK m.5/2-c (sözleşmenin ifası); Acil Yardım bildiriminde m.5/2-b (hayati menfaat). Aktarım dayanağı: KVKK m.9/4 standart sözleşme; Kişisel Verileri Koruma Kurumu'na sözleşmenin imzalanmasından itibaren 5 iş günü içinde bildirim yapılır.
        </p>
        <p>
          <strong style={{ color: '#f4f1ec' }}>Google (Firebase Cloud Messaging)</strong>
          : anlık bildirimlerin iletilmesi amacıyla bildirim cihaz anahtarı ve bildirim içeriği. İşleme sebebi: KVKK m.5/2-c (sözleşmenin ifası). Aktarım dayanağı: KVKK m.9/4 standart sözleşme; Kişisel Verileri Koruma Kurumu'na sözleşmenin imzalanmasından itibaren 5 iş günü içinde bildirim yapılır.
        </p>
        <p>
          <strong style={{ color: '#f4f1ec' }}>Anthropic (yapay zekâ)</strong>
          : masa uyum raporunun oluşturulması amacıyla masadaki her katılımcı için adı yerine P1, P2 gibi bir etiketle beş OCEAN skoru ve varsa meslek alanı, masa türü, katılımcı sayısı ve masanın genel uyum skoru; masa sohbeti denetimi amacıyla şüpheli kelime içeren sohbet mesajının yalnız metni (en fazla 1.000 karakter). Ad, cinsiyet, yaş, iletişim ve kimlik bilgisi gönderilmez. İşleme sebebi: masa uyum raporunda KVKK m.5/2-c (sözleşmenin ifası), sohbet denetiminde m.5/2-f (meşru menfaat). Aktarım dayanağı: KVKK m.9/4 standart sözleşme; Kişisel Verileri Koruma Kurumu'na sözleşmenin imzalanmasından itibaren 5 iş günü içinde bildirim yapılır.
        </p>
        <p>
          <strong style={{ color: '#f4f1ec' }}>Anthropic (yapay zekâ, ABD), canlı destek</strong>
          : Aktarılan veri: temsilci istediğinde canlı destek sohbetinin metni, temsilci isterse sohbette gönderdiğin görseller ve yalnız o sohbetin bağlı olduğu hesabın destek için gereken kayıtları (ad soyad, şehir, dil, kayıt tarihi, paketler ve kalan haklar, Premium aboneliği, ödemeler, masalar, masa seçimi, KYC durumu, uyarı / askı / ban durumu, davet ve indirim durumu; mekân hesabında mekân bilgisi, onay durumu ve atanmış masalar). KYC görselleri ve videosu, kimlik numarası, telefon numarası, OCEAN sonuçları, Masa Sohbeti içerikleri, Acil Yardım kayıtları ve başka kullanıcıların verisi aktarılmaz. Yapay zekâ yalnız okur, kullanıcıya mesaj göndermez ve hiçbir kaydı değiştirmez. Amaç: temsilcinin talebini hızlı ve doğru yanıtlaması. İşleme sebebi: KVKK m.5/2-c (sözleşmenin ifası) ve m.5/2-f (meşru menfaat). Aktarım dayanağı: KVKK m.9/4 standart sözleşme; Kişisel Verileri Koruma Kurumu'na sözleşmenin imzalanmasından itibaren 5 iş günü içinde bildirim yapılır.
        </p>
        <p>
          <strong style={{ color: '#f4f1ec' }}>OpenStreetMap (Nominatim)</strong>
          : acil yardım talebindeki konum koordinatlarının açık adrese çevrilmesi amacıyla. Aktarım dayanağı: KVKK m.9/6 kapsamında arızi aktarım (sözleşmenin ifası için zorunlu olması); standart sözleşme imzalanamamaktadır.
        </p>
        <p>
          <strong style={{ color: '#f4f1ec' }}>Acil durum kişisi</strong>
          : Profilim&apos;de eklediğin kişinin adı ve telefon numarası yalnız Acil Yardım talebinde bulunduğunda bu kişiye WhatsApp (Meta WhatsApp Business API) üzerinden otomatik bilgi gönderilmesi amacıyla kullanılır; başka amaçla kullanılmaz. Kişiyi istediğin zaman silebilirsin; hesap silinince de silinir.
        </p>
        <p>
          <strong style={{ color: '#f4f1ec' }}>Apple (App Store) ve Google (Google Play)</strong>
          : mobil uygulama içi satın almaların ve aboneliklerin doğrulanması ve yönetilmesi amacıyla satın alma işlem bilgileri. Aktarım dayanağı: sözleşmenin ifası (ödeme ve abonelik işlemleri).
        </p>
        <p>
          <strong style={{ color: '#f4f1ec' }}>Google Maps</strong>
          : Acil Yardım talebindeki konum koordinatları. Kullanıldığı yerler ve amaçları: (1) yönetici Acil Yardım haritası (web ve mobil yönetim paneli): talep edenin konumunun haritada gösterilmesi; (2) açık adres çözümleme (Google Geocoding): açık Acil Yardım talebindeki konum koordinatlarının açık adrese çevrilmesi; (3) acil durum kişilerine WhatsApp ile giden bildirimdeki ve yönetici Acil Yardım ekranındaki konum bağlantısı: talep anındaki konumun haritada açılması; (4) masa detay kartındaki &quot;Haritada Gör&quot; bağlantısı: mekânın, mekân paneli ya da iş ortaklığı formunda girilen Google Maps bağlantısıyla veya adresiyle haritada açılması; (5) yönetici mekân formundaki harita bağlantısı: mekân adresinin haritada kontrol edilmesi. Aktarım dayanağı: sözleşmenin ifası.
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
          <p style={{ color: '#f4f1ec', fontSize: 13 }}>
            Kişisel verilerin satılmaz.
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
          <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a>
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
        <p style={{ marginTop: '1rem', color: '#a39c93', fontSize: 13 }}>
          Başvurular <strong style={{ color: '#f4f1ec' }}>30 gün</strong> içinde yanıtlanır.
        </p>
      </>
    ),
  },
  {
    n: '08',
    title: 'Çerezler',
    content: (
      <p>
        Ahenk, platform işlevselliği için zorunlu çerezler kullanır. Bu çerezler oturum yönetimi ve güvenlik amacıyla kullanılır. Detaylı bilgi için{' '}
        <Link href="/cerez-politikasi" style={{ color: '#c0392b' }}>Çerez Politikamı</Link>
        {' '}incele.
      </p>
    ),
  },
  {
    n: '09',
    title: 'Güvenlik',
    content: (
      <List
        items={[
          'SSL/TLS şifrelemesi: tüm veri iletimlerinde',
          'Kimlik belgeleri ve liveness videosu Ahenk sunucusunda AES-256-GCM ile şifreli saklanır; yalnızca yetkili yönetici, yetkili uç üzerinden bellekte çözülmüş hâliyle görüntüleyebilir',
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
        Bu politika gerektiğinde güncellenebilir. Önemli değişiklikler push bildirimi ve WhatsApp ile bildirilir. Güncel politikaya her zaman{' '}
        <Link href="/gizlilik-politikasi" style={{ color: '#c0392b' }}>ahenk.co/gizlilik-politikasi</Link>
        {' '}adresinden ulaşabilirsin.
      </p>
    ),
  },
  {
    n: '11',
    title: 'İletişim ve Uyuşmazlık',
    content: (
      <>
        <p>
          Her türlü soru, talep ve şikayetlerin için:{' '}
          <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a>
        </p>
        <p style={{ marginTop: '0.75rem', color: '#a39c93', fontSize: 13 }}>
          {JURISDICTION}
        </p>
      </>
    ),
  },
  {
    n: '12',
    title: 'Kariyer Başvuruları',
    content: <CareerDataNotice transferRef="bu politikanın 6. maddesi (Kişisel Verilerin Aktarıldığı Üçüncü Taraflar)" rightsRef="7. maddesi (Kişisel Veri Sahibinin Hakları)" />,
  },
];

function SubTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      style={{
        fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        color: '#8f887f',
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
        <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
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

function GizlilikPolitikasiPageTr() {
  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        {/* Başlık */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <h1 className="ll-title">
            Gizlilik Politikası
          </h1>
          <p style={{ marginTop: '0.6rem', color: '#8f887f', fontSize: 13, letterSpacing: '0.03em' }}>
            Son güncelleme: Kasım 2026
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

// Arayüz dili İngilizceyse İngilizce çeviri (çelişkide Türkçe metin geçerlidir)
export default function GizlilikPolitikasiPage() {
  return useLocale() === 'en' ? <PrivacyEn /> : <GizlilikPolitikasiPageTr />;
}
