'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { COMPANY_ADDRESS, JURISDICTION } from '@/lib/companyInfo';
import { TaxInfo } from '@/components/TaxInfo';

const sections = [
  {
    n: '01',
    title: 'Çerez Nedir?',
    content: (
      <p>
        Çerezler, ziyaret ettiğiniz web sitelerinin tarayıcınıza yerleştirdiği küçük metin dosyalarıdır. Bu dosyalar sayesinde site sizi tanır, tercihlerinizi hatırlar ve daha iyi bir kullanıcı deneyimi sunar. Çerezler zararlı yazılım içermez ve kişisel verilerinize doğrudan erişemez.
      </p>
    ),
  },
  {
    n: '02',
    title: 'Ahenk\'in Kullandığı Çerez Türleri',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '1.25rem' }}>
        {/* Zorunlu */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f' }}>
              Zorunlu Çerezler
            </span>
            <span style={{ fontSize: 11, padding: '0.15rem 0.6rem', background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', borderRadius: '999px', color: '#c0392b', fontWeight: 600 }}>
              Kapatılamaz
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
            {[
              { name: 'access_token', desc: 'Giriş yapmış kullanıcının API isteklerini doğrular. Süre: 15 dakika. HttpOnly: Evet.' },
              { name: 'refresh_token', desc: 'Erişim süresi dolduğunda oturumu yeniler. Süre: 7 gün. HttpOnly: Evet.' },
              { name: 'ahenk_session', desc: 'Yalnızca oturumun açık olup olmadığını gösteren bir işarettir, içinde kişisel veri bulunmaz. Süre: 7 gün. HttpOnly: Hayır.' },
              { name: 'venue_token', desc: 'Mekân paneli oturumunu doğrular, yalnızca mekân hesaplarında kullanılır. Süre: 7 gün. HttpOnly: Evet.' },
            ].map((c) => (
              <div key={c.name} style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#ff6b6b', display: 'block', marginBottom: '0.2rem' }}>{c.name}</span>
                <span style={{ color: '#a39c93', fontSize: 13 }}>{c.desc}</span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '0.75rem', color: '#8f887f', fontSize: 13, lineHeight: 1.6 }}>
            Bu çerezler platformun çalışması için teknik olarak zorunludur. Kapatılmaları halinde giriş yapma ve platform kullanımı mümkün olmaz. Önceki sürümden kalan ahenk_token çerezi tarayıcınızda bulunuyorsa otomatik olarak silinir.
          </p>
        </div>

        {/* Yerel depolama */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f' }}>
              Tarayıcı Yerel Depolaması (localStorage)
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
            {[
              { name: 'cookie-consent', desc: 'Çerez onayınızı tutar. Çerez değildir; tarayıcınızın yerel depolamasında, siz silene kadar saklanır.' },
              { name: 'ahenk_masa_tab', desc: 'Masalar ekranında son seçtiğiniz sekmeyi hatırlar. Çerez değildir; tarayıcınızın yerel depolamasında saklanır.' },
            ].map((c) => (
              <div key={c.name} style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>{c.name}</span>
                <span style={{ color: '#a39c93', fontSize: 13 }}>{c.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Analitik */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f' }}>
              Analitik Çerezler
            </span>
            <span style={{ fontSize: 11, padding: '0.15rem 0.6rem', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '999px', color: '#a39c93', fontWeight: 600 }}>
              Onaya Bağlı
            </span>
          </div>
          <div style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Google Analytics 4: _ga ve _ga_ ile başlayan çerezler</span>
            <span style={{ color: '#a39c93', fontSize: 13 }}>Sağlayıcı: Google LLC. Amaç: ziyaret ve trafik kaynağı istatistiği. Süre: 2 yıl.</span>
          </div>
          <p style={{ marginTop: '0.6rem', color: '#8f887f', fontSize: 13 }}>
            Onay verilmeden Google'a çerez içermeyen anonim sinyaller gönderilir; bu sinyallerle kimlik belirlenmez.
          </p>
        </div>

        {/* Pazarlama */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f' }}>
              Pazarlama Çerezleri
            </span>
            <span style={{ fontSize: 11, padding: '0.15rem 0.6rem', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '999px', color: '#a39c93', fontWeight: 600 }}>
              Onaya Bağlı
            </span>
          </div>
          <div style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>Meta Pixel: _fbp</span>
            <span style={{ color: '#a39c93', fontSize: 13 }}>Sağlayıcı: Meta Platforms. Amaç: reklam ölçümü ve yeniden hedefleme. Süre: 3 ay. Yalnızca onayla çalışır.</span>
          </div>
        </div>

        <p style={{ color: '#8f887f', fontSize: 13 }}>
          Onayınızı banner'daki Tercihler bölümünden her zaman değiştirebilirsiniz. Banner'ı yeniden açmak için bu sayfanın sonundaki Çerez Tercihlerimi Güncelle düğmesini kullanabilirsiniz.
        </p>
      </div>
    ),
  },
  {
    n: '03',
    title: 'Üçüncü Taraf Çerezleri',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '1rem' }}>
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
          <p style={{ fontWeight: 600, color: '#f4f1ec', marginBottom: '0.4rem', fontSize: 13 }}>iyzico Ödeme Sistemi</p>
          <p style={{ color: '#a39c93', fontSize: 13, lineHeight: 1.6 }}>
            Paket satın alma sayfasında iyzico kendi güvenlik ve dolandırıcılık önleme çerezlerini kullanır. Bu çerezler iyzico'nun gizlilik politikası kapsamındadır ve Ahenk tarafından kontrol edilmez.
          </p>
        </div>
      </div>
    ),
  },
  {
    n: '04',
    title: 'Çerez Yönetimi',
    content: (
      <>
        <p style={{ marginBottom: '1rem' }}>Tüm modern tarayıcılar çerezleri yönetme imkânı sunar:</p>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.5rem', marginBottom: '1rem' }}>
          {[
            ['Chrome', 'Ayarlar → Gizlilik ve Güvenlik → Çerezler'],
            ['Firefox', 'Ayarlar → Gizlilik ve Güvenlik → Çerezler'],
            ['Safari', 'Tercihler → Gizlilik → Çerezler'],
          ].map(([browser, path]) => (
            <div key={browser} style={{ display: 'flex', gap: '1rem', padding: '0.7rem 1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
              <span style={{ color: '#f4f1ec', fontWeight: 600, fontSize: 13, minWidth: '70px' }}>{browser}</span>
              <span style={{ color: '#a39c93', fontSize: 13 }}>{path}</span>
            </div>
          ))}
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
          <li style={{ display: 'flex', gap: '0.6rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b' }}>›</span>
            Zorunlu çerezler kapatıldığında platforma giriş yapılamaz ve hizmetlerden yararlanılamaz.
          </li>
          <li style={{ display: 'flex', gap: '0.6rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b' }}>›</span>
            Analitik ve pazarlama çerezleri kapatıldığında platform işlevselliği etkilenmez.
          </li>
        </ul>
      </>
    ),
  },
  {
    n: '05',
    title: 'Çerez Onay Banneri',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Siteye ilk girişinizde çerez tercihlerinizi belirlemenizi isteyen bir bildirim gösterilir. Çerez onayınız çerez olarak değil, tarayıcınızın yerel depolamasında (localStorage) tutulur ve bildirim bir daha gösterilmez. Tercihlerinizi istediğiniz zaman bu sayfadan güncelleyebilirsiniz.
      </p>
    ),
  },
  {
    n: '06',
    title: 'Veri Güvenliği',
    content: (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.55rem' }}>
        {[
          'Çerezler aracılığıyla işlenen veriler SSL/TLS şifrelemesiyle korunur.',
          'access_token, refresh_token ve venue_token çerezleri HttpOnly ve Secure olarak işaretlenmiştir, JavaScript ile erişilemez.',
          'ahenk_session çerezi Secure olarak işaretlenmiştir ancak HttpOnly değildir. Yalnızca oturumun açık olup olmadığını gösterir, içinde kişisel veri bulunmaz.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#c9c2b8', fontSize: 13, lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b', flexShrink: 0 }}>›</span>{item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: '07',
    title: 'KVKK Kapsamında Çerezler',
    content: (
      <p style={{ lineHeight: 1.75 }}>
        Zorunlu çerezler <strong style={{ color: '#f4f1ec' }}>meşru menfaat</strong> hukuki dayanağıyla, analitik ve pazarlama çerezleri ise <strong style={{ color: '#f4f1ec' }}>açık rıza</strong> hukuki dayanağıyla işlenmektedir. Detaylı bilgi için{' '}
        <Link href="/kvkk" style={{ color: '#c0392b' }}>KVKK Aydınlatma Metnimizi</Link>
        {' '}inceleyiniz.
      </p>
    ),
  },
  {
    n: '08',
    title: 'İletişim',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
        <p>Çerez politikamıza ilişkin sorularınız için:</p>
        <p><a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a></p>
        <p style={{ color: '#a39c93', fontSize: 13 }}>{COMPANY_ADDRESS}</p>
        <TaxInfo />
        <p style={{ color: '#a39c93', fontSize: 13 }}><a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a></p>
      </div>
    ),
  },
  {
    n: '09',
    title: 'Uyuşmazlık',
    content: (
      <p>
        {JURISDICTION}
      </p>
    ),
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

function resetConsent() {
  try {
    localStorage.removeItem('cookie-consent');
    window.location.reload();
  } catch {
    // ignore
  }
}

export default function CerezPolitikasiPage() {
  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <h1 className="ll-title">
            Çerez Politikası
          </h1>
          <p style={{ marginTop: '0.6rem', color: '#8f887f', fontSize: 13 }}>
            Son güncelleme: Kasım 2026
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

        {/* Tercih güncelle butonu */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ marginTop: '2rem', textAlign: 'center' as const }}
        >
          <button
            onClick={resetConsent}
            className="btn-ghost"
          >
            Çerez Tercihlerimi Güncelle
          </button>
          <p style={{ marginTop: '0.6rem', color: '#444', fontSize: 11 }}>
            Tıklandığında tercihleriniz sıfırlanır ve banner tekrar gösterilir.
          </p>
        </motion.div>
      </div>
    </main>
  );
}
