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
              { name: 'auth-token', desc: 'JWT oturum tokeni: kullanıcının giriş durumunu korur, oturum süresince geçerlidir.' },
              { name: 'session-id', desc: 'Oturum kimliği: güvenli bağlantı için gereklidir.' },
              { name: 'csrf-token', desc: 'Siteler arası istek sahteciliğini önler, güvenlik için zorunludur.' },
            ].map((c) => (
              <div key={c.name} style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#ff6b6b', display: 'block', marginBottom: '0.2rem' }}>{c.name}</span>
                <span style={{ color: '#a39c93', fontSize: 13 }}>{c.desc}</span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '0.75rem', color: '#8f887f', fontSize: 13, lineHeight: 1.6 }}>
            Bu çerezler platformun çalışması için teknik olarak zorunludur. Kapatılmaları halinde giriş yapma ve platform kullanımı mümkün olmaz.
          </p>
        </div>

        {/* Tercih */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8f887f' }}>
              Tercih Çerezleri
            </span>
            <span style={{ fontSize: 11, padding: '0.15rem 0.6rem', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '999px', color: '#a39c93', fontWeight: 600 }}>
              Opsiyonel
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
            {[
              { name: 'cookie-consent', desc: 'Çerez tercihlerinizi hatırlar, 1 yıl geçerlidir.' },
              { name: 'theme-preference', desc: 'Tema tercihinizi hatırlar.' },
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
              Opsiyonel
            </span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
            {['Platform kullanım istatistikleri', 'Hangi sayfaların daha çok ziyaret edildiği', 'Hata takibi'].map((item) => (
              <li key={item} style={{ display: 'flex', gap: '0.6rem', color: '#c9c2b8', fontSize: 13 }}>
                <span style={{ color: '#c0392b' }}>›</span>{item}
              </li>
            ))}
          </ul>
          <p style={{ marginTop: '0.6rem', color: '#8f887f', fontSize: 13 }}>
            Bu veriler anonim olarak işlenir ve platform iyileştirme amacıyla kullanılır.
          </p>
        </div>
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
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' }}>
          <p style={{ fontWeight: 600, color: '#f4f1ec', marginBottom: '0.4rem', fontSize: 13 }}>Cloudflare</p>
          <p style={{ color: '#a39c93', fontSize: 13, lineHeight: 1.6 }}>
            DDoS koruması ve güvenlik için Cloudflare teknik çerezler kullanabilir.
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
            Analitik çerezler kapatıldığında platform işlevselliği etkilenmez.
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
        Siteye ilk girişinizde çerez tercihlerinizi belirlemenizi isteyen bir bildirim gösterilir. <strong style={{ color: '#f4f1ec' }}>Kabul Et</strong> seçeneğiyle tüm çerezleri, <strong style={{ color: '#f4f1ec' }}>Reddet</strong> seçeneğiyle yalnızca zorunlu çerezleri etkinleştirebilirsiniz. Tercihleriniz localStorage'a kaydedilir ve bir daha gösterilmez. Tercihlerinizi istediğiniz zaman bu sayfadan güncelleyebilirsiniz.
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
          'Oturum çerezleri HttpOnly ve Secure flag\'leriyle işaretlenmiştir. JavaScript ile erişilemez.',
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
        Zorunlu çerezler <strong style={{ color: '#f4f1ec' }}>meşru menfaat</strong> hukuki dayanağıyla, analitik çerezler ise <strong style={{ color: '#f4f1ec' }}>açık rıza</strong> hukuki dayanağıyla işlenmektedir. Detaylı bilgi için{' '}
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
