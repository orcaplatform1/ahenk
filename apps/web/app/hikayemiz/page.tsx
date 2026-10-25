'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useRef } from 'react';
import { useInView } from 'framer-motion';
import { usePlanPrices } from '@/components/PlanPrice';

/* ─── Fade-in wrapper ────────────────────────────────────────────────────── */
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Sol başlık / sağ metin düzeni ─────────────────────────────────────── */
function TwoCol({ title, body }: { title: string; body: string }) {
  return (
    <FadeIn>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-8 md:gap-16 max-w-5xl mx-auto px-6 py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
        <h2
          className="font-serif text-2xl sm:text-3xl md:text-4xl leading-tight"
          style={{ background: 'linear-gradient(135deg,#c0392b,#e8925a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
        >
          {title}
        </h2>
        <p className="text-[#ccc] text-base sm:text-lg leading-relaxed">{body}</p>
      </div>
    </FadeIn>
  );
}

/* ─── Tam genişlik tek cümle ─────────────────────────────────────────────── */
function FullQuote({ text }: { text: string }) {
  return (
    <FadeIn>
      <div className="py-20 px-6 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
        <p
          className="font-serif italic text-white mx-auto"
          style={{ fontSize: 'clamp(1.3rem, 3.5vw, 2rem)', maxWidth: 720, lineHeight: 1.4 }}
        >
          "{text}"
        </p>
        <div
          className="mx-auto mt-6 rounded-full"
          style={{ width: 80, height: 2, background: 'linear-gradient(90deg,#c0392b,#e8925a)' }}
        />
      </div>
    </FadeIn>
  );
}

/* ─── Sayfa ──────────────────────────────────────────────────────────────── */
export default function HikayemizPage() {
  const prices = usePlanPrices();
  const tl = (v?: number) => (v === undefined ? '—' : v);
  return (
    <main className="min-h-screen bg-[#121212] text-[#f5f5f5] overflow-x-hidden pt-[52px]">

      {/* Tam ekran açılış */}
      <FadeIn>
        <section className="flex flex-col items-center justify-center text-center py-32 px-6" style={{ minHeight: '60vh' }}>
          <h1
            className="font-serif font-bold text-white leading-none"
            style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)' }}
          >
            Milyonlarca insan.
          </h1>
          <h1
            className="font-serif font-bold leading-none mt-2"
            style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', background: 'linear-gradient(135deg,#c0392b,#e8925a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
          >
            Hep aynı çevre.
          </h1>
          <div
            className="mt-8 rounded-full"
            style={{ width: 80, height: 2, background: 'linear-gradient(90deg,#c0392b,#e8925a)' }}
          />
        </section>
      </FadeIn>

      {/* Bölüm 1 */}
      <TwoCol
        title="Nereden çıktı bu fikir?"
        body="İstanbul'da 15 milyon insan yaşıyor. Ankara'da 5 milyon. İzmir'de 4 milyon. Bu şehirlerde her gün milyonlarca hikaye kesişiyor ama çoğu zaman hiç tanışmıyoruz bile. Sosyal hayatımız daraldı. İş arkadaşları, eski okul arkadaşları, ailenin tanıdıkları. Hep aynı yüzler, hep aynı sohbetler. Yeni biriyle tanışmak için ya bir uygulamaya sığınıyoruz ya da tesadüfe güveniyoruz. İkisi de hayal kırıklığıyla bitiyor. Biz bunu değiştirmek için yola çıktık."
      />

      {/* Tam genişlik alıntı 1 */}
      <FullQuote text="Ekran arkasında kurulan bağ, aynı masada geçirilen bir akşamın yerini tutmuyor." />

      {/* Bölüm 2 */}
      <TwoCol
        title="İki format, tek felsefe."
        body="Ahenk'te iki farklı buluşma formatı sunuyoruz. Grup masalarında 4 veya 6 kişi, algoritmanın bir araya getirdiği insanlar olarak buluşuyor. Başbaşa buluşmalarda ise algoritma sizi ikili olarak eşleştiriyor; derinlemesine, bire bir, karşılıklı. Her iki formatta da buluşma bir restoran ya da kafede, kamuya açık bir ortamda, yüz yüze gerçekleşiyor. Kapalı kapılar yok, belirsizlik yok. Sadece gerçek insanlar, gerçek bir ortam."
      />

      {/* Bölüm 3 */}
      <TwoCol
        title="Bilim işin içinde."
        body="Eşleştirme sistemimiz sezgiye değil, bilime dayanıyor. OCEAN (Big Five) kişilik modeli, 1980'lerden bu yana milyonlarca kişi üzerinde doğrulanmış psikoloji araştırmalarının altın standardı. Açıklık, Özdisiplin, Dışadönüklük, Uyumluluk ve Duygusal Denge. Bu beş boyut senin kişilik profilini oluşturuyor. Algoritma bu profili baz alıyor. Yaşını, meslek alanını, mekan tercihini ve beklentini de hesaba katıyor. Sonuç: rastgele değil, tam olarak sana göre bir masa."
      />

      {/* Tam genişlik alıntı 2 */}
      <FullQuote text="Güvenlik bir tercih değil, bir standart." />

      {/* Bölüm 4 */}
      <TwoCol
        title="Kimler geliyor?"
        body="Platforma katılan her kullanıcı telefon numarasını doğruluyor, kimliğini ibraz ediyor ve kısa bir video doğrulamasından geçiyor. Masanda oturan herkes bu süreçten geçmiş, gerçekliği onaylanmış biri. Anonim hesap yok, sahte profil yok. Buluşma sonrası değerlendirme sistemi var. Tekrar eşleşmek istemediğin biri varsa belirtiyorsun; bir daha o kişiyle asla karşılaşmıyorsun. Ciddi bir durum bildirirsen kürasyon ekibimiz devreye giriyor, hesap süresiz kapatılıyor."
      />

      {/* Bölüm 5 */}
      <TwoCol
        title="Fiyat mı?"
        body={`Türkiye'deki benzer platformlar çok daha yüksek ücret talep ediyor ve performans olarak bizden çok daha geride. Ahenk'te 2 grup masası hakkı ${tl(prices?.MASADA?.webTL)} TL, başbaşa masası ${tl(prices?.KARSIMDA?.webTL)} TL. İçerde paketinde ikisini birden alıyorsun (2 grup + 1 başbaşa), ${tl(prices?.ICERDE?.webTL)} TL. Paketler tek seferlik; abonelik ve otomatik ödeme yok. Bunların dışında gizli bir ücret yok. Mekan masrafı sana ait; biz sadece masayı kuruyoruz.`}
      />

      {/* Bölüm 6 */}
      <TwoCol
        title="Neredeyiz?"
        body="Ahenk şu an İstanbul, Ankara, İzmir, Antalya, Muğla, Aydın ve Balıkesir (Ayvalık/Akçay)'da aktif. Her Cumartesi grup masaları, her Pazar başbaşa buluşmalar gerçekleşiyor. Topluluk büyüdükçe yeni şehirler ekleniyor."
      />

      {/* Kapanış */}
      <FadeIn>
        <section className="flex flex-col items-center justify-center text-center py-32 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
          <h2
            className="font-serif font-bold text-white"
            style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)' }}
          >
            Sen de gel.
          </h2>
          <Link
            href="/kayit"
            className="inline-flex items-center gap-2 rounded-full font-medium text-white mt-8 transition-all"
            style={{
              background: 'linear-gradient(135deg,#c0392b,#ff6b6b)',
              boxShadow: '0 0 28px rgba(192,57,43,0.4)',
              padding: '14px 40px',
              fontSize: '1rem',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 44px rgba(192,57,43,0.75)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 28px rgba(192,57,43,0.4)'; }}
          >
            Hemen Katıl →
          </Link>
        </section>
      </FadeIn>

    </main>
  );
}
