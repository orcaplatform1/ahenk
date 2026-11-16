'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { ENGLISH_ENABLED, type Lang } from '@ahenk/shared';
import { usePathname, useRouter } from '@/i18n/navigation';
import { storeLocale } from '@/lib/locale';

// Dünya ikonu (dil seçici): solunda seçili dilin kısaltması (TR / EN), basınca altında koyu kart (Türkçe / English, seçilide ✓).
// Seçim /en öneki ile Türkçe adres arasında geçiş yapar. ENGLISH_ENABLED = false iken görünmez.
export function GlobeIcon({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" /><ellipse cx="12" cy="12" rx="4" ry="9.5" /><path d="M2.5 12 H21.5" /><path d="M3.8 7.5 Q12 10 20.2 7.5" /><path d="M3.8 16.5 Q12 14 20.2 16.5" />
    </svg>
  );
}

export default function LanguageSwitcher() {
  const locale = useLocale() as Lang;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!ENGLISH_ENABLED) return null;

  function choose(lang: Lang) {
    setOpen(false);
    if (lang === locale) return;
    storeLocale(lang);
    router.replace(pathname, { locale: lang });
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open} aria-label="Dil / Language"
        style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 44, minHeight: 44, justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <span style={{ fontSize: 13, color: '#FFFFFF', opacity: 0.7 }}>{locale === 'en' ? 'EN' : 'TR'}</span>
        <GlobeIcon />
      </button>
      {open && (
        <div role="listbox" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#181818', borderRadius: 12, padding: 4, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 60 }}>
          {([['tr', 'Türkçe'], ['en', 'English']] as const).map(([lang, label]) => (
            <button key={lang} type="button" role="option" aria-selected={locale === lang} onClick={() => choose(lang)}
              style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44, padding: '0 12px', background: 'none', border: 'none', color: '#FFFFFF', fontSize: 14, cursor: 'pointer', borderRadius: 8 }}>
              <span>{label}</span>
              {locale === lang && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
