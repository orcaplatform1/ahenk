'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('cookie-consent');
      if (!consent) setVisible(true);
    } catch {
      // localStorage erişilemez
    }
  }, []);

  function accept() {
    try { localStorage.setItem('cookie-consent', 'accepted'); } catch { /* */ }
    setVisible(false);
  }

  function reject() {
    try { localStorage.setItem('cookie-consent', 'rejected'); } catch { /* */ }
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
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            padding: '0 1rem 1rem',
          }}
        >
          <div
            style={{
              maxWidth: '860px',
              margin: '0 auto',
              background: 'rgba(12,12,12,0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderTop: '2px solid #c0392b',
              borderRadius: '16px',
              boxShadow: '0 -4px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
              padding: '1.1rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.25rem',
              flexWrap: 'wrap' as const,
            }}
          >
            <p
              style={{
                color: '#ccc',
                fontSize: '0.875rem',
                lineHeight: 1.55,
                flex: 1,
                minWidth: '200px',
                margin: 0,
              }}
            >
              Ahenk, daha iyi bir deneyim sunmak için çerezler kullanır.{' '}
              <Link href="/cerez-politikasi" style={{ color: '#888', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                Çerez Politikası
              </Link>
            </p>
            <div style={{ display: 'flex', gap: '0.65rem', flexShrink: 0 }}>
              <button
                onClick={reject}
                style={{
                  padding: '0.55rem 1.25rem',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '9999px',
                  color: '#aaa',
                  fontSize: '0.83rem',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                  whiteSpace: 'nowrap' as const,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.3)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
              >
                Reddet
              </button>
              <button
                onClick={accept}
                style={{
                  padding: '0.55rem 1.4rem',
                  background: 'linear-gradient(135deg, #c0392b 0%, #ff6b6b 100%)',
                  border: 'none',
                  borderRadius: '9999px',
                  color: '#fff',
                  fontSize: '0.83rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'filter 0.2s',
                  whiteSpace: 'nowrap' as const,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1)'; }}
              >
                Kabul Et
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
