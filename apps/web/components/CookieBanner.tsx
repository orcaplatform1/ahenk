'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';

type Prefs = { analitik: boolean; pazarlama: boolean };

const BTN_OUTLINE = 'btn-ghost';
const BTN_PRIMARY = 'btn-primary';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 42,
        height: 24,
        borderRadius: 9999,
        border: 'none',
        background: on ? '#c0392b' : 'rgba(255,255,255,0.12)',
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: on ? 21 : 3,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [managing, setManaging] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ analitik: true, pazarlama: false });

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cookie-consent');
      if (!stored) setVisible(true);
    } catch { /* */ }
  }, []);

  function acceptAll() {
    try { localStorage.setItem('cookie-consent', 'all'); } catch { /* */ }
    setVisible(false);
  }

  function reject() {
    try { localStorage.setItem('cookie-consent', 'essential'); } catch { /* */ }
    setVisible(false);
  }

  function savePrefs() {
    try { localStorage.setItem('cookie-consent', JSON.stringify(prefs)); } catch { /* */ }
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: '110%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '110%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, padding: '0 1rem 1rem' }}
        >
          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            background: 'rgba(10,10,10,0.97)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(192,57,43,0.28)',
            borderRadius: '28px',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.7), 0 0 40px rgba(192,57,43,0.1), inset 0 1px 0 rgba(255,255,255,0.10)',
            padding: '1.5rem 1.6rem',
          }}>

            <AnimatePresence mode="wait">
              {!managing ? (
                <motion.div
                  key="main"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <p style={{ color: '#ccc', fontSize: '0.875rem', lineHeight: 1.6, margin: '0 0 0.5rem' }}>
                    Oturum güvenliğinizi sağlamak, algoritmik eşleştirme deneyiminizi iyileştirmek ve tercihlerinizi hatırlamak için yasal düzenlemelere uygun çerezler kullanıyoruz.
                  </p>
                  <p style={{ color: '#666', fontSize: '0.78rem', lineHeight: 1.55, margin: '0 0 1.2rem' }}>
                    Tercihlerinizi dilediğiniz zaman yönetebilir, onayınızı geri çekebilirsiniz. Detaylı bilgi için{' '}
                    <Link href="/cerez-politikasi" style={{ color: '#c0392b', textDecoration: 'underline', textUnderlineOffset: '3px' }}>Çerez Politikası</Link>
                    {' '}ve{' '}
                    <Link href="/gizlilik-politikasi" style={{ color: '#c0392b', textDecoration: 'underline', textUnderlineOffset: '3px' }}>Gizlilik Politikası</Link>
                    {' '}sayfalarımızı inceleyebilirsiniz.
                  </p>
                  <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={() => setManaging(true)} className={BTN_OUTLINE}>
                      Tercihleri Yönet
                    </button>
                    <button onClick={reject} className={BTN_OUTLINE}>
                      Reddet
                    </button>
                    <button onClick={acceptAll} className={BTN_PRIMARY}>
                      Tümünü Kabul Et
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="prefs"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <button
                      onClick={() => setManaging(false)}
                      style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
                    >
                      ←
                    </button>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#f5f5f5' }}>
                      Çerez Tercihleri
                    </h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.2rem' }}>
                    {/* Zorunlu — her zaman açık */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.83rem', fontWeight: 500, color: '#e0e0e0' }}>Zorunlu Çerezler</p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#555', lineHeight: 1.4 }}>Oturum ve güvenlik işlemleri için zorunludur.</p>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#c0392b', fontWeight: 600, flexShrink: 0 }}>Her zaman açık</span>
                    </div>

                    {/* Analitik */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.83rem', fontWeight: 500, color: '#e0e0e0' }}>Analitik Çerezler</p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#555', lineHeight: 1.4 }}>Platform kullanımını anlamamıza ve iyileştirmemize yardımcı olur.</p>
                      </div>
                      <Toggle on={prefs.analitik} onChange={(v) => setPrefs(p => ({ ...p, analitik: v }))} />
                    </div>

                    {/* Pazarlama */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.83rem', fontWeight: 500, color: '#e0e0e0' }}>Pazarlama Çerezleri</p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#555', lineHeight: 1.4 }}>Size uygun içerik ve kampanya önerileri sunmak için kullanılır.</p>
                      </div>
                      <Toggle on={prefs.pazarlama} onChange={(v) => setPrefs(p => ({ ...p, pazarlama: v }))} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.55rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button onClick={reject} className={BTN_OUTLINE}>
                      Tümünü Reddet
                    </button>
                    <button onClick={savePrefs} className={BTN_PRIMARY}>
                      Tercihleri Kaydet
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
