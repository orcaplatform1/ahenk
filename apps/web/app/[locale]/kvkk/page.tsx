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
            items: ['Liveness (canlılık) videosu: yüz görüntüsü içerdiğinden özel nitelikli kişisel veri sayılır, açık rıza alınarak işlenir'],
            special: true,
          },
          {
            cat: 'İletişim Verisi',
            items: ['Telefon numarası (WhatsApp doğrulama kodu ve bildirimler için)', 'E-posta adresi', 'Kankamla davetinde girilen, davet edilen kişinin telefon numarası'],
          },
          {
            cat: 'Konum Verisi',
            items: [
              'Şehir tercihi',
              'Acil yardım konumu: yalnız acil yardım talebinde bulunan kişiden, talep anında ve talep çözülene kadar alınır. Kişinin izin vermesi hâlinde konum, uygulama arka plandayken veya kapatılmış olsa dahi, cihazın izin verdiği ölçüde alınmaya devam eder. Diğer katılımcıların konumu alınmaz. Konum emniyet birimleriyle paylaşılır ve ekibim tarafından takip edilir. Talep çözülünce koordinatlar ve konum geçmişi silinir; son konumun açık adresi ve talep kaydı yasal yükümlülükler, olası hukuki uyuşmazlıklar ve resmi makam talepleri için saklanır.',
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
            items: ['Masa sohbeti mesajları (sohbet kapanınca kullanıcı tarafında görünmez olur, yönetim tarafında saklanır)', 'Sohbet şikâyetleri ve otomatik engel kayıtları', 'Sorun bildirimleri ve ekli görseller'],
          },
          {
            cat: 'Davranış Verileri',
            items: ['Masa buluşma geçmişi', 'Değerlendirme puanları ve yorumlar', 'Gelmedi bildirimleri', 'Yaptırım kayıtları (uyarı, askı, ban)'],
          },
          {
            cat: 'Güvenlik Verileri',
            items: ['Rehber engelleme için eklenen telefon numaraları', 'IP adresi, oturum bilgileri'],
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
            basis: 'Açık Rıza: Madde 5/1 ve 6/2',
            desc: 'OCEAN kişilik testi sonuçları, kimlik belgesi görselleri ve liveness videosu. Kullanıcı kayıt ve kimlik doğrulama sürecinde açık onay verir.',
          },
          {
            basis: 'Sözleşmenin Kurulması veya İfası: Madde 5/2-c',
            desc: 'Ad, soyad, telefon numarası, e-posta, şehir, meslek, dil ve mekân tercihleri, paket ve ödeme verileri, masa sohbeti mesajları. Kankamla için kanka davetinde girilen telefon numarası (davetin iletilmesi ve doğrulanmış hesapla eşleştirilmesi amacıyla) ve kanka bağlantısı.',
          },
          {
            basis: 'Veri Sorumlusunun Meşru Menfaati: Madde 5/2-f',
            desc: 'Teknik veriler, IP adresi, güvenlik logları, rehber engelleme için eklenen telefon numaraları, masa sohbetinin otomatik denetimi, şikâyet, yaptırım ve gelmedi kayıtları, profil fotoğrafı onayı.',
          },
          {
            basis: 'Hukuki Yükümlülüğün Yerine Getirilmesi: Madde 5/2-ç',
            desc: 'Ödeme kayıtları, fatura bilgileri, giriş ve trafik kayıtları (5651 sayılı Kanun), mesafeli satış ve ticari ileti onay kayıtları, yetkili kurum talepleri.',
          },
          {
            basis: 'Açık Rıza ve Hayati Menfaat: Madde 5/1 ve 5/2-b',
            desc: 'Acil Yardım talebindeki konum verisi (cihaz konum izniyle) ve acil durum kişilerine bildirim: kişinin kendisinin ya da bir başkasının hayatı veya beden bütünlüğünün korunması için.',
          },
          {
            basis: 'Yurt Dışına Aktarım: Madde 9',
            desc: 'Her alıcı için aktarılan veri, amaç ve aktarım dayanağı 6. maddede ayrı ayrı yazılıdır.',
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
            'Ahenk\'in kendi sunucusunda AES-256-GCM ile şifreli saklanır',
            'Yalnızca yetkili admin personeli tarafından, yetkili uç üzerinden bellekte çözülmüş hâliyle görüntülenebilir',
            'Üçüncü taraflarla paylaşılmaz',
            'Hesap silinene kadar saklanır; hesap silme talebi onaylanınca kimlik görselleri, canlılık videosu ve KYC kaydı silinir',
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
          <strong style={{ color: '#f4f1ec' }}>Google Analytics ve Meta Pixel</strong>
          : bu araçlar aracılığıyla çerez verisi işlenir. Bu veri yurt dışındaki sunuculara aktarılabilir. Aktarım açık rızana dayanır (KVKK m.9/6-a) ve rızanı çerez tercihlerinden her zaman geri alabilirsin.
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Anthropic (yapay zekâ, ABD)</strong>
          : Aktarılan veri: masa uyum raporu için masadaki her katılımcının adı yerine P1, P2 gibi bir etiketle beş OCEAN skoru ve varsa meslek alanı, masa türü, katılımcı sayısı ve masanın genel uyum skoru; masa sohbeti denetimi için şüpheli kelime içeren sohbet mesajının yalnız metni (en fazla 1.000 karakter). Ad, cinsiyet, yaş, iletişim ve kimlik bilgisi aktarılmaz. Amaç: yapay zekâ ile masa uyum raporu ve sohbet denetimi. Aktarım dayanağı: KVKK m.9/6-b (sözleşmenin ifası için zorunlu olması).
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Google Firebase Cloud Messaging (push bildirimi, ABD)</strong>
          : Aktarılan veri: bildirim cihaz anahtarı (FCM token) ve bildirim içeriği. Amaç: push bildirimlerinin iletilmesi. Aktarım dayanağı: KVKK m.9/6-b (sözleşmenin ifası için zorunlu olması).
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Meta WhatsApp Business API (ABD)</strong>
          : Aktarılan veri: telefon numarası, WhatsApp doğrulama kodu (OTP), bildirim içerikleri (kimlik doğrulama sonucu, masa onayı), Kankamla davetinde davet edilen kişinin telefon numarası ve davet bağlantısı; Acil Yardım talebinde acil durum kişilerinin telefon numarası, talep edenin adı soyadı ve konum bağlantısı. Amaç: doğrulama kodu ve bildirimlerin iletilmesi. Aktarım dayanağı: KVKK m.9/6-b (sözleşmenin ifası için zorunlu olması); acil durum kişilerine bildirimde KVKK m.9/6-e (hayat veya beden bütünlüğünün korunması).
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>OpenStreetMap Nominatim (adres çözümleme, Birleşik Krallık)</strong>
          : Aktarılan veri: Acil Yardım talebindeki konum koordinatları (yönetici acil yardım haritasında OpenStreetMap harita servisi de kullanılır). Amaç: koordinatların açık adrese çevrilmesi. Aktarım dayanağı: KVKK m.9/6-e (hayat veya beden bütünlüğünün korunması).
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Google Maps (Acil Yardım haritası, ABD)</strong>
          : Aktarılan veri: Acil Yardım talebindeki konum koordinatları (yönetici acil yardım haritası ve açık adres çözümleme; acil durum kişilerine giden konum bağlantısı da Google Maps bağlantısıdır). Amaç: talep edenin konumunun haritada gösterilmesi ve açık adresinin bulunması. Aktarım dayanağı: KVKK m.9/6-e (hayat veya beden bütünlüğünün korunması).
        </p>
        <p style={{ marginBottom: '1.25rem' }}>
          <strong style={{ color: '#f4f1ec' }}>Apple (App Store) ve Google (Google Play), ABD</strong>
          : Aktarılan veri: mobil uygulama içi satın alma ve abonelik işlem bilgileri. Amaç: satın almaların ve aboneliklerin doğrulanması ve yönetilmesi. Aktarım dayanağı: KVKK m.9/6-b (sözleşmenin ifası için zorunlu olması).
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
            Kişisel verilerin satılmaz. Çerez verileri yalnızca açık rızanla Google ve Meta ile reklam ve istatistik amacıyla paylaşılır.
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
          ['Ödeme, fatura ve işlem kayıtları (iyzico, App Store, Google Play)', '10 yıl, işlemin yapıldığı yılı izleyen takvim yılı başından (TTK m.82, VUK m.253). Hesap silinse de saklanır; süre sonunda kişisel alanlar anonimleştirilir, tutar, tarih ve işlem numarası korunur'],
          ['Mesafeli satış ve abonelik onay kayıtları (sözleşme kabulü, ön bilgilendirme onayı, zaman damgası, IP)', '3 yıl, işlem tarihinden (Mesafeli Sözleşmeler Yönetmeliği)'],
          ['Ticari ileti onay ve ret kayıtları', 'Onayın sona erdiği tarihten 3 yıl (Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik)'],
          ['Giriş, IP ve trafik kayıtları', '2 yıl, kayıt tarihinden (5651 sayılı Kanun m.5)'],
          ['KVKK aydınlatma ve açık rıza onay kayıtları', 'Hesabın silinmesinden itibaren 10 yıl (TBK genel zamanaşımı)'],
          ['Acil yardım talebi, şikâyet ya da ban ile ilişkili kişinin kimlik bilgileri (ad, soyad, e-posta, telefon; kilitli, yalnız yetkili yönetici görür)', 'Olayın kapanışından itibaren 2 yıl (yasal sabit süre yok, şirket politikası)'],
          ['Banlı hesabın telefon numarasının okunamaz özeti (hash)', 'Süresiz (yeniden kayıt engeli)'],
          ['kimlik belgeleri (kimlik görselleri ve liveness videosu)', 'Hesap silinene kadar saklanır; hesap silme talebi onaylanınca kimlik görselleri, canlılık videosu ve KYC kaydı silinir'],
          ['Diğer veriler: profil, OCEAN test sonuçları, profil fotoğrafları, sohbet mesajları, sorun bildirimleri, rehber ve kullanıcı engelleri', 'Hesap silme talebi onaylanınca silinir; rehber engelleri kullanıcı silince de silinir'],
          ['Acil yardım konum koordinatları ve konum geçmişi', 'Talep çözülünce silinir'],
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
