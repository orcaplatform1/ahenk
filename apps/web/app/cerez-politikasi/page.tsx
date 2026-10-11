'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

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
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#666' }}>
              Zorunlu Çerezler
            </span>
            <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.6rem', background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', borderRadius: '999px', color: '#c0392b', fontWeight: 600 }}>
              Kapatılamaz
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
            {[
              { name: 'auth-token', desc: 'JWT oturum tokeni — kullanıcının giriş durumunu korur, oturum süresince geçerlidir.' },
              { name: 'session-id', desc: 'Oturum kimliği — güvenli bağlantı için gereklidir.' },
              { name: 'csrf-token', desc: 'Siteler arası istek sahteciliğini önler — güvenlik için zorunludur.' },
            ].map((c) => (
              <div key={c.name} style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#ff6b6b', display: 'block', marginBottom: '0.2rem' }}>{c.name}</span>
                <span style={{ color: '#888', fontSize: '0.83rem' }}>{c.desc}</span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: '0.75rem', color: '#555', fontSize: '0.8rem', lineHeight: 1.6 }}>
            Bu çerezler platformun çalışması için teknik olarak zorunludur. Kapatılmaları halinde giriş yapma ve platform kullanımı mümkün olmaz.
          </p>
        </div>

        {/* Tercih */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#666' }}>
              Tercih Çerezleri
            </span>
            <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.6rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '999px', color: '#888', fontWeight: 600 }}>
              Opsiyonel
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.6rem' }}>
            {[
              { name: 'cookie-consent', desc: 'Çerez tercihlerinizi hatırlar — 1 yıl geçerlidir.' },
              { name: 'theme-preference', desc: 'Tema tercihinizi hatırlar.' },
            ].map((c) => (
              <div key={c.name} style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#aaa', display: 'block', marginBottom: '0.2rem' }}>{c.name}</span>
                <span style={{ color: '#888', fontSize: '0.83rem' }}>{c.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Analitik */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#666' }}>
              Analitik Çerezler
            </span>
            <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.6rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '999px', color: '#888', fontWeight: 600 }}>
              Opsiyonel
            </span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
            {['Platform kullanım istatistikleri', 'Hangi sayfaların daha çok ziyaret edildiği', 'Hata takibi'].map((item) => (
              <li key={item} style={{ display: 'flex', gap: '0.6rem', color: '#ccc', fontSize: '0.87rem' }}>
                <span style={{ color: '#c0392b' }}>›</span>{item}
              </li>
            ))}
          </ul>
          <p style={{ marginTop: '0.6rem', color: '#555', fontSize: '0.8rem' }}>
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
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
          <p style={{ fontWeight: 600, color: '#e8e8e8', marginBottom: '0.4rem', fontSize: '0.9rem' }}>iyzico Ödeme Sistemi</p>
          <p style={{ color: '#888', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Paket satın alma sayfasında iyzico kendi güvenlik ve dolandırıcılık önleme çerezlerini kullanır. Bu çerezler iyzico'nun gizlilik politikası kapsamındadır ve Ahenk tarafından kontrol edilmez.
          </p>
        </div>
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
          <p style={{ fontWeight: 600, color: '#e8e8e8', marginBottom: '0.4rem', fontSize: '0.9rem' }}>Cloudflare</p>
          <p style={{ color: '#888', fontSize: '0.85rem', lineHeight: 1.6 }}>
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
            <div key={browser} style={{ display: 'flex', gap: '1rem', padding: '0.7rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
              <span style={{ color: '#e8e8e8', fontWeight: 600, fontSize: '0.87rem', minWidth: '70px' }}>{browser}</span>
              <span style={{ color: '#888', fontSize: '0.85rem' }}>{path}</span>
            </div>
          ))}
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
          <li style={{ display: 'flex', gap: '0.6rem', color: '#ccc', fontSize: '0.85rem', lineHeight: 1.6 }}>
            <span style={{ color: '#c0392b' }}>›</span>
            Zorunlu çerezler kapatıldığında platforma giriş yapılamaz ve hizmetlerden yararlanılamaz.
          </li>
          <li style={{ display: 'flex', gap: '0.6rem', color: '#ccc', fontSize: '0.85rem', lineHeight: 1.6 }}>
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
        Siteye ilk girişinizde çerez tercihlerinizi belirlemenizi isteyen bir bildirim gösterilir. <strong style={{ color: '#f5f5f5' }}>Kabul Et</strong> seçeneğiyle tüm çerezleri, <strong style={{ color: '#f5f5f5' }}>Reddet</strong> seçeneğiyle yalnızca zorunlu çerezleri etkinleştirebilirsiniz. Tercihleriniz localStorage'a kaydedilir ve bir daha gösterilmez. Tercihlerinizi istediğiniz zaman bu sayfadan güncelleyebilirsiniz.
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
          'Oturum çerezleri HttpOnly ve Secure flag\'leriyle işaretlenmiştir — JavaScript ile erişilemez.',
        ].map((item) => (
          <li key={item} style={{ display: 'flex', gap: '0.65rem', color: '#ccc', fontSize: '0.87rem', lineHeight: 1.6 }}>
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
        Zorunlu çerezler <strong style={{ color: '#f5f5f5' }}>meşru menfaat</strong> hukuki dayanağıyla, analitik çerezler ise <strong style={{ color: '#f5f5f5' }}>açık rıza</strong> hukuki dayanağıyla işlenmektedir. Detaylı bilgi için{' '}
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
        <p><a href="mailto:bilgi@ahenk.tr" style={{ color: '#c0392b' }}>bilgi@ahenk.tr</a></p>
        <p style={{ color: '#888', fontSize: '0.87rem' }}>Metropol İstanbul, Atatürk Mah. Ataşehir Bulvarı, Ertuğrul Gazi Sokak, Ataşehir / İstanbul</p>
        <p style={{ color: '#888', fontSize: '0.87rem' }}><a href="tel:+905403060080" style={{ color: '#c0392b' }}>0540 306 0080</a></p>
      </div>
    ),
  },
  {
    n: '09',
    title: 'Uyuşmazlık',
    content: (
      <p>
        Bu politikadan doğan uyuşmazlıklarda{' '}
        <strong style={{ color: '#f5f5f5' }}>İstanbul Mahkemeleri ve İcra Müdürlükleri</strong> yetkilidir.
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
    <main
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#f5f5f5',
        fontFamily: 'var(--font-sans, system-ui)',
        position: 'relative' as const,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'fixed' as const,
          top: -120,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 700,
          height: 340,
          background: 'radial-gradient(ellipse at center, rgba(192,57,43,0.22) 0%, transparent 70%)',
          pointerEvents: 'none' as const,
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative' as const, zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <Link
          href="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#555', fontSize: '0.8rem', letterSpacing: '0.05em', textDecoration: 'none', marginBottom: '2.5rem' }}
        >
          ← Ana Sayfa
        </Link>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <h1
            style={{
              fontFamily: 'var(--font-serif, Georgia, serif)',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1.15,
            }}
          >
            Çerez Politikası
          </h1>
          <p style={{ marginTop: '0.6rem', color: '#555', fontSize: '0.82rem' }}>
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
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.4)',
                borderRadius: '16px',
                padding: '1.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', color: '#c0392b' }}>{sec.n}</span>
                <h2 style={{ fontFamily: 'var(--font-serif, Georgia, serif)', fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)', fontWeight: 400, color: '#f5f5f5', lineHeight: 1.2 }}>
                  {sec.title}
                </h2>
              </div>
              <div style={{ color: '#ccc', fontSize: '0.9rem', lineHeight: 1.75 }}>
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
            style={{
              padding: '0.75rem 2rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '9999px',
              color: '#ccc',
              fontSize: '0.87rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
          >
            Çerez Tercihlerimi Güncelle
          </button>
          <p style={{ marginTop: '0.6rem', color: '#444', fontSize: '0.75rem' }}>
            Tıklandığında tercihleriniz sıfırlanır ve banner tekrar gösterilir.
          </p>
        </motion.div>

        {/* Footer */}
        <div
          style={{
            marginTop: '3rem',
            paddingTop: '2rem',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexWrap: 'wrap' as const,
            justifyContent: 'center',
            gap: '0.5rem 1.5rem',
          }}
        >
          <p style={{ width: '100%', textAlign: 'center' as const, color: '#e8e8e8', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            © 2026 Ahenk. Tüm hakları saklıdır.
          </p>
          <p style={{ width: '100%', textAlign: 'center' as const, color: '#888', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
            Ahenk bir{' '}
            <a href="https://ahenk.tr" style={{ textDecoration: 'none' }}>
              <span style={{ color: '#f5f5f5', fontWeight: 600 }}>Traders</span>
              <span style={{ color: '#1e90ff', fontWeight: 700 }}>.TR</span>
            </a>
            <span style={{ marginLeft: '3px' }}>🇹🇷</span>{' '}ticari markasıdır.
          </p>
          {[
            { label: 'Ana Sayfa', href: '/' },
            { label: 'Gizlilik Politikası', href: '/gizlilik-politikasi' },
            { label: 'KVKK', href: '/kvkk' },
            { label: 'Kullanım Koşulları', href: '/kullanim-kosullari' },
            { label: 'Site Haritası', href: '/site-haritasi' },
          ].map((link) => (
            <Link key={link.href} href={link.href} style={{ color: '#555', fontSize: '0.78rem', textDecoration: 'none' }}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
