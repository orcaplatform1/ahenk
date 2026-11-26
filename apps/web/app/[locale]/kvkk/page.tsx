'use client';
import { useLocale } from 'next-intl';
import KvkkEn from './KvkkEn';

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
            items: ['Ad, soyad, doğum tarihi, cinsiyet', 'Kimlik belgesi türü (Kimlik Kartı, Ehliyet, Pasaport, Oturma İzni) ve belge görselleri (ön ve arka yüz; pasaportta fotoğraflı sayfa)', 'Web ödemesinde girilen T.C. kimlik, yabancı kimlik (YKN) ya da pasaport numarası: Ahenk tarafından saklanmaz, yalnız iyzico\'ya iletilir'],
          },
          {
            cat: 'Biyometrik Veri',
            items: ['Canlılık videosu ve yüz eşleştirme (videodaki yüzün kimlik belgesindeki fotoğrafla karşılaştırılması): biyometrik veri, özel nitelikli kişisel veridir (KVKK m.6), yalnız açık rızanla işlenir'],
            special: true,
          },
          {
            cat: 'İletişim Verisi',
            items: ['Telefon numarası (WhatsApp doğrulama kodu ve bildirimler için)', 'E-posta adresi', 'Kankamla davetinde girilen, davet edilen kişinin telefon numarası'],
          },
          {
            cat: 'Konum Verisi',
            items: [
              'Şehir tercihi: katılmak istediğin şehir (ve varsa ikinci tercih şehir); eşleştirmede kullanılır',
              'Acil Yardım hassas konumu: yalnız Acil Yardım butonuna basıldığında toplanır ve talep çözülene kadar canlı alınır (izin vermen hâlinde uygulama arka plandayken veya kapalıyken de, cihazın izin verdiği ölçüde). Diğer katılımcıların konumu alınmaz. Konum ekibimize, acil durum kişilerine ve emniyet birimlerine iletilir. Talep çözülünce koordinatlar ve konum geçmişi silinir, son açık adres 2 yıl saklanır. Hukuki sebep: KVKK m.5/2-b (hayati menfaat) ve m.5/2-ç (hukuki yükümlülük).',
              'Acil durum kişileri (en fazla 2): Profilim\'de eklediğin kişilerin adı ve telefon numarası yalnız Acil Yardım talebinde bulunduğunda, bu kişilere WhatsApp üzerinden otomatik bilgi (adın, soyadın ve talep anındaki konumunun Google Maps bağlantısı) gönderilmesi amacıyla kullanılır; başka amaçla kullanılmaz. Kişileri istediğin zaman silebilirsin; hesap silinince de silinir.',
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
            cat: 'Profil ve Tercih Verileri',
            items: ['Meslek alanı', 'Dil tercihleri (arayüz dili, ana dil, yabancılarla masaya oturma tercihi)', 'Mekân kategorisi ve alkol tercihi', 'Profil fotoğrafı: yönetici onayından sonra masa katılımcılarına gösterilir'],
          },
          {
            cat: 'İletişim İçerikleri ve Şikâyet Verileri',
            items: ['Masa sohbeti mesajları (sohbet kapanınca kullanıcı tarafında görünmez olur, yönetim tarafında saklanır)', 'Sohbet şikâyetleri ve otomatik engel kayıtları', 'Ekran görüntüsü ihlal kayıtları: ekran görüntüsünü alan kullanıcı, fotoğrafı görüntülenen kullanıcı, platform ve tarih-saat bilgisi. Kayıtları yalnız ADMIN ve SUPERADMIN görür', 'Sorun bildirimleri ve ekli görseller', 'Canlı destek sohbet kayıtları: destek konusu, mesajlar, gönderdiğin görseller, saat ve okundu bilgisi, temsilci numarası, temsilcilerin iç notları ve devir notları, değerlendirmen; destek amaçlı yapay zekâ asistanı (Claude Haiku) sorgu kayıtları'],
          },
          {
            cat: 'Davranış Verileri',
            items: ['Masa buluşma geçmişi', 'Değerlendirme puanları ve yorumlar', 'Gelmedi bildirimleri', 'Yaptırım kayıtları (uyarı, askı, ban)'],
          },
          {
            cat: 'Güvenlik Verileri',
            items: ['Rehber engelleme için eklenen telefon numaraları', 'IP adresi, oturum bilgileri', 'Giriş kayıtları: IP adresi, tarayıcı bilgisi, platform (web / iOS / Android), tarih-saat, başarılı / başarısız', 'Mesafeli satış sözleşmesi, ön bilgilendirme ve biyometrik açık rıza onay kayıtları: belge türü ve versiyonu, tarih-saat, IP, platform, paket'],
          },
          {
            cat: 'Teknik Veriler',
            items: ['Tarayıcı türü, cihaz bilgisi, çerez verileri', 'Mobil bildirim cihaz anahtarı (FCM token) ve bildirim içerikleri', 'Mobil uygulamada cihazda tutulan oturum bilgileri ("beni hatırla" bilgisi, dil ve izin tercihleri)'],
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
          'Kullanıcıyla push bildirimi ve WhatsApp aracılığıyla iletişim kurulması',
          'Eşleştirmede yaş, mekân kategorisi ve dil tercihlerinin kullanılması',
          'Yapay zekâ ile masa uyum raporunun oluşturulması',
          'Masa sohbetinin yapay zekâ ile otomatik denetimi ve topluluk kurallarının uygulanması (uyarı, askı, ban)',
          'Acil Yardım talebinin yürütülmesi: konumun takibi, acil durum kişilerine bildirim ve emniyet birimleriyle paylaşım',
          'Eşleştirme ve sohbet denetimi otomatik sistemlerle yapılır; bu işlemlerin sonucuna itiraz hakkın 8. maddede yazılıdır',
          'Yasal yükümlülüklerin yerine getirilmesi, yetkili kurum ve kuruluşlara bilgi/belge sunulması',
          'Şikâyet ve taleplerin yönetilmesi',
          'Ekran görüntüsü ihlal kayıtları: topluluk kurallarının uygulanması ve kullanıcıların kişisel verilerinin korunması',
          'Canlı destek hizmetinin yürütülmesi: taleplerinin yanıtlanması, hizmet kalitesinin artırılması ve güvenliğin için görüşmelerin kayıt altına alınması (KVKK m.5/2-c ve m.5/2-f). Canlı destek sohbetinde yazdığın metin, göndermeden önce müşteri temsilcisinin ekranında anlık olarak görünebilir. Gönderilmeyen metin kaydedilmez.',
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
            basis: 'Açık Rıza: Madde 6',
            desc: 'Canlılık videosu ve yüz eşleştirme (biyometrik veri). Açık rıza kimlik doğrulama adımında, canlılık videosundan önce ayrı onay kutusuyla alınır.',
          },
          {
            basis: 'Sözleşmenin Kurulması veya İfası: Madde 5/2-c',
            desc: 'Ad, soyad, telefon numarası, e-posta, şehir, meslek, dil ve mekân tercihleri, OCEAN kişilik testi, kimlik belgesi, paket ve ödeme verileri, masa sohbeti mesajları, yapay zekâ masa uyum raporu, push bildirimleri ve WhatsApp doğrulama kodu (OTP). Kankamla için kanka davetinde girilen telefon numarası (davetin iletilmesi ve doğrulanmış hesapla eşleştirilmesi amacıyla) ve kanka bağlantısı, ekran görüntüsü ihlal kayıtları.',
          },
          {
            basis: 'Veri Sorumlusunun Meşru Menfaati: Madde 5/2-f',
            desc: 'Teknik veriler, IP adresi, güvenlik logları, kimlik belgesi (sahte profillerin engellenmesi), rehber engelleme için eklenen telefon numaraları, masa sohbetinin otomatik denetimi (sohbet moderasyonu), şikâyet, yaptırım ve gelmedi kayıtları, profil fotoğrafı onayı, sorun bildirimleri, banlı kullanıcının okunamaz telefon özeti, ekran görüntüsü ihlal kayıtları.',
          },
          {
            basis: 'Hukuki Yükümlülüğün Yerine Getirilmesi: Madde 5/2-ç',
            desc: 'Ödeme kayıtları, fatura bilgileri, giriş / IP kayıtları ve sunucu logları (5651 sayılı Kanun), mesafeli satış ve ticari ileti onay kayıtları, yetkili kurum talepleri.',
          },
          {
            basis: 'Hayati Menfaat ve Hukuki Yükümlülük: Madde 5/2-b ve 5/2-ç',
            desc: 'Acil Yardım talebindeki konum verisi (cihaz konum izniyle), acil durum kişilerine bildirim ve emniyet birimleriyle paylaşım: kişinin kendisinin ya da bir başkasının hayatı veya beden bütünlüğünün korunması ve yasal yükümlülükler için.',
          },
          {
            basis: 'Hakkın Tesisi, Kullanılması veya Korunması: Madde 5/2-e',
            desc: 'Acil Yardım, şikâyet veya ban kaydına karışmış kullanıcının kimliği, Acil Yardım talebinin son açık adresi, şikâyet ve moderasyon kayıtları ile şikâyet edilen mesajlar.',
          },
          {
            basis: 'Yurt Dışına Aktarım: Madde 9',
            desc: 'Standart sözleşme imzalanabilen sağlayıcılara aktarım KVKK m.9/4 standart sözleşmeyle yapılır ve sözleşme imzalandıktan sonra 5 iş günü içinde Kişisel Verileri Koruma Kurumu\'na bildirilir; standart sözleşme imzalanamayan sağlayıcılara aktarım KVKK m.9/6 kapsamında arızi aktarımdır. Her alıcı 6. maddede ayrı ayrı yazılıdır.',
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
    title: 'Kişilik Testi, Kimlik Belgesi ve Canlılık Verisi',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.85rem' }}>
        {[
          {
            basis: 'Kişilik Testi (OCEAN)',
            desc: <>OCEAN Big Five kişilik testi cevapları ve skorları eşleştirme ve yapay zekâ masa uyum raporu için işlenir. Hukuki sebep: KVKK m.5/2-c (sözleşmenin kurulması veya ifası).</>,
          },
          {
            basis: 'Kimlik Belgesi',
            desc: <>Belge türü ve belge görselleri (ön ve arka yüz; pasaportta fotoğraflı sayfa) kimlik doğrulama ve sahte profillerin engellenmesi için işlenir. Kimlik belgelerinde özel nitelikli veriler bulunabilir (örneğin ehliyette kan grubu); bu veriler işlenmez. Hukuki sebep: KVKK m.5/2-c (sözleşmenin kurulması veya ifası) ve m.5/2-f (meşru menfaat).</>,
          },
          {
            basis: 'Canlılık Videosu ve Yüz Eşleştirme',
            desc: <>Canlılık videosu ve videodaki yüzün kimlik belgesindeki fotoğrafla karşılaştırılması (yüz eşleştirme) biyometrik veridir, yani özel nitelikli kişisel veridir (KVKK m.6). Yalnız açık rızanla işlenir. Açık rıza kimlik doğrulama adımında, canlılık videosundan önce ayrı bir onay kutusuyla alınır ve kayıt altına alınır. Ayrıntılar: <a href="/acik-riza-metni" style={{ color: '#c0392b' }}>Açık Rıza Metni</a>.</>,
          },
          {
            basis: 'Saklama ve Güvenlik',
            desc: <>Kimlik belgesi görselleri ve canlılık videosu Ahenk&apos;in kendi sunucusunda AES-256-GCM ile şifreli saklanır, yalnız yetkili yönetici tarafından görüntülenir, üçüncü taraflarla paylaşılmaz ve yurt dışına aktarılmaz. Hesap silme onayından sonra 48 saat içinde silinir; istisna 7. maddede yazılıdır.</>,
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
    n: '06',
    title: 'Kişisel Verilerin Aktarımı',
    content: (
      <>
        <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f', marginBottom: '0.6rem' }}>Yurt İçi Aktarım</p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>iyzico Ödeme Hizmetleri A.Ş.</strong>
          : ödeme ve paket işlemleri için zorunlu finansal veriler ve web ödemesinde girilen T.C. kimlik, YKN ya da pasaport numarası aktarılır (numara Ahenk tarafından saklanmaz); iyzico kendi KVKK yükümlülüklerini yerine getirmektedir.
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Kimlik belgeleri ve liveness videosu</strong>
          : yurt dışına aktarılmaz; Ahenk&apos;in kendi sunucusunda AES-256-GCM ile şifreli saklanır.
        </p>
        <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f', marginBottom: '0.6rem' }}>Yurt Dışı Aktarım</p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Anthropic (yapay zekâ, ABD)</strong>
          : Aktarılan veri: masa uyum raporu için masadaki her katılımcının adı yerine P1, P2 gibi bir etiketle beş OCEAN skoru ve varsa meslek alanı, masa türü, katılımcı sayısı ve masanın genel uyum skoru; masa sohbeti denetimi için şüpheli kelime içeren sohbet mesajının yalnız metni (en fazla 1.000 karakter). Ad, cinsiyet, yaş, iletişim ve kimlik bilgisi aktarılmaz. Amaç: yapay zekâ ile masa uyum raporu ve sohbet denetimi. Aktarım dayanağı: KVKK m.9/4 standart sözleşme; Kişisel Verileri Koruma Kurumu'na sözleşmenin imzalanmasından itibaren 5 iş günü içinde bildirim yapılır. İşleme sebebi: masa uyum raporunda KVKK m.5/2-c (sözleşmenin ifası), sohbet denetiminde KVKK m.5/2-f (meşru menfaat).
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Anthropic (yapay zekâ, ABD), canlı destek</strong>
          : Aktarılan veri: temsilci istediğinde canlı destek sohbetinin metni, temsilci isterse sohbette gönderdiğin görseller ve yalnız o sohbetin bağlı olduğu hesabın destek için gereken kayıtları (ad soyad, şehir, dil, kayıt tarihi, paketler ve kalan haklar, Premium aboneliği, ödemeler, masalar, masa seçimi, KYC durumu, uyarı / askı / ban durumu, davet ve indirim durumu; mekân hesabında mekân bilgisi, onay durumu ve atanmış masalar). KYC görselleri ve videosu, kimlik numarası, telefon numarası, OCEAN sonuçları, Masa Sohbeti içerikleri, Acil Yardım kayıtları ve başka kullanıcıların verisi aktarılmaz. Yapay zekâ yalnız okur, kullanıcıya mesaj göndermez ve hiçbir kaydı değiştirmez. Amaç: temsilcinin talebini hızlı ve doğru yanıtlaması. İşleme sebebi: KVKK m.5/2-c (sözleşmenin ifası) ve m.5/2-f (meşru menfaat). Aktarım dayanağı: KVKK m.9/4 standart sözleşme; Kişisel Verileri Koruma Kurumu'na sözleşmenin imzalanmasından itibaren 5 iş günü içinde bildirim yapılır.
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Google Firebase Cloud Messaging (push bildirimi, ABD)</strong>
          : Aktarılan veri: bildirim cihaz anahtarı (FCM token) ve bildirim içeriği. Amaç: push bildirimlerinin iletilmesi. Aktarım dayanağı: KVKK m.9/4 standart sözleşme; Kişisel Verileri Koruma Kurumu'na sözleşmenin imzalanmasından itibaren 5 iş günü içinde bildirim yapılır. İşleme sebebi: KVKK m.5/2-c (sözleşmenin ifası).
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Meta WhatsApp Business API (ABD)</strong>
          : Aktarılan veri: telefon numarası, WhatsApp doğrulama kodu (OTP), bildirim içerikleri (kimlik doğrulama sonucu, masa onayı), Kankamla davetinde davet edilen kişinin telefon numarası ve davet bağlantısı; Acil Yardım talebinde acil durum kişilerinin telefon numarası, talep edenin adı soyadı ve konum bağlantısı. Amaç: doğrulama kodu ve bildirimlerin iletilmesi. Aktarım dayanağı: KVKK m.9/4 standart sözleşme; Kişisel Verileri Koruma Kurumu'na sözleşmenin imzalanmasından itibaren 5 iş günü içinde bildirim yapılır. İşleme sebebi: doğrulama kodu (OTP) ve bildirimlerde KVKK m.5/2-c (sözleşmenin ifası); Acil Yardım bildiriminde KVKK m.5/2-b (hayati menfaat).
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>OpenStreetMap Nominatim (adres çözümleme, Birleşik Krallık)</strong>
          : Aktarılan veri: Acil Yardım talebindeki konum koordinatları (yönetici acil yardım haritasında OpenStreetMap harita servisi de kullanılır). Amaç: koordinatların açık adrese çevrilmesi. Aktarım dayanağı: KVKK m.9/6 kapsamında arızi aktarım (sözleşmenin ifası için zorunlu olması); standart sözleşme imzalanamamaktadır. İşleme sebebi: KVKK m.5/2-b (hayati menfaat) ve m.5/2-ç (hukuki yükümlülük).
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Google Maps (ABD)</strong>
          : Aktarılan veri: Acil Yardım talebindeki konum koordinatları. Kullanıldığı yerler ve amaçları: (1) yönetici Acil Yardım haritası (web ve mobil yönetim paneli): talep edenin konumunun haritada gösterilmesi; (2) açık adres çözümleme (Google Geocoding): açık Acil Yardım talebindeki konum koordinatlarının açık adrese çevrilmesi; (3) acil durum kişilerine WhatsApp ile giden bildirimdeki ve yönetici Acil Yardım ekranındaki konum bağlantısı: talep anındaki konumun haritada açılması; (4) masa detay kartındaki &quot;Haritada Gör&quot; bağlantısı: mekânın, mekân paneli ya da iş ortaklığı formunda girilen Google Maps bağlantısıyla veya adresiyle haritada açılması; (5) yönetici mekân formundaki harita bağlantısı: mekân adresinin haritada kontrol edilmesi. Aktarım dayanağı: sözleşmenin ifası.
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Apple (App Store) ve Google (Google Play), ABD</strong>
          : Aktarılan veri: mobil uygulama içi satın alma ve abonelik işlem bilgileri. Amaç: satın almaların ve aboneliklerin doğrulanması ve yönetilmesi. Aktarım dayanağı: sözleşmenin ifası (ödeme ve abonelik işlemleri).
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
            Kişisel verilerin satılmaz.
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
          'İşlenen verilerin münhasıran otomatik sistemler aracılığıyla analiz edilmesi nedeniyle aleyhine bir sonucun ortaya çıkmasına itiraz etme',
          'Kişisel verilerin kanuna aykırı işlenmesi nedeniyle zarara uğraman halinde zararın giderilmesini talep etme',
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
          Haklarını kullanmak için{' '}
          <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a>
          {' '}adresine e-posta gönder.
        </p>
        <p style={{ marginBottom: '0.6rem', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f' }}>
          Başvuruda yer alması gerekenler
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.4rem', marginBottom: '1rem' }}>
          {['Adın ve soyadın', 'T.C. kimlik numaran; yabancıysan uyruğun ve pasaport numaran ya da varsa kimlik numaran (kimliğini doğrulamak için)', 'Talep konusu', 'İletişim bilgilerin'].map((item) => (
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
        Başvurunun reddedilmesi, verilen cevabın yetersiz bulunması veya süresinde yanıt verilmemesi halinde{' '}
        <strong style={{ color: '#f4f1ec' }}>Kişisel Verileri Koruma Kurulu</strong>'na şikâyette bulunabilirsin.
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

function KvkkPageTr() {
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
export default function KvkkPage() {
  return useLocale() === 'en' ? <KvkkEn /> : <KvkkPageTr />;
}
