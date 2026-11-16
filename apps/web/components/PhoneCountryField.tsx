'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { countryByCode, countryName, flagEmoji, searchCountries, toE164, type Lang } from '@ahenk/shared';

// Ülke kodlu telefon alanı: bayrak + ülke kodu (varsayılan 🇹🇷 +90). Basınca ortak 42 ülkelik listenin (sabit sıra) olduğu, ad ve kodla aranabilir
// liste açılır (ülke adları arayüz dilinde). Doğrulama libphonenumber-js ile seçilen ülkeye göre; değer E.164 olarak döner.
export function usePhoneE164(country: string, national: string): string | null {
  return toE164(country, national);
}

export function CountryCodeButton({ country, onChange, disabled }: { country: string; onChange: (code: string) => void; disabled?: boolean }) {
  const t = useTranslations();
  const locale = useLocale() as Lang;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const c = countryByCode(country);

  useEffect(() => {
    if (!open) return;
    setQ('');
    requestAnimationFrame(() => inputRef.current?.focus());
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open]);

  const list = searchCountries(q, locale);

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} aria-label={t('common.selectCountry')}
        className="flex items-center gap-1.5 px-3 text-[#c9c2b8] text-[13px] select-none shrink-0 disabled:opacity-60"
        style={{ minHeight: 44, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, cursor: disabled ? 'default' : 'pointer' }}>
        <span aria-hidden="true">{flagEmoji(c.code)}</span>
        <span>{c.dial}</span>
        <span aria-hidden="true" style={{ color: '#ff6b6b', fontSize: '0.65rem' }}>▾</span>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }} role="dialog" aria-modal="true" aria-label={t('common.selectCountry')}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-md flex flex-col" style={{ background: '#121212', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, maxHeight: '80vh' }}>
            <div className="flex items-center gap-2 p-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.countrySearch')} aria-label={t('common.countrySearch')}
                style={{ flex: 1, minHeight: 44, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '0 12px', color: '#f5f5f5', fontSize: 16, outline: 'none' }} />
              <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')} style={{ minWidth: 44, minHeight: 44, background: 'none', border: 'none', color: '#a39c93', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <ul role="listbox" style={{ overflowY: 'auto', margin: 0, padding: 6, listStyle: 'none' }}>
              {list.length === 0 && <li style={{ padding: 12, color: '#888', fontSize: 14 }}>{t('common.noResults')}</li>}
              {list.map((it) => (
                <li key={it.code} role="option" aria-selected={it.code === country}>
                  <button type="button" onClick={() => { onChange(it.code); setOpen(false); }}
                    className="w-full flex items-center gap-3 text-left" style={{ minHeight: 44, padding: '0 10px', borderRadius: 8, background: it.code === country ? 'rgba(192,57,43,0.18)' : 'transparent', border: 'none', color: '#f5f5f5', fontSize: 14, cursor: 'pointer' }}>
                    <span aria-hidden="true">{flagEmoji(it.code)}</span>
                    <span className="flex-1 min-w-0 truncate">{countryName(it, locale)}</span>
                    <span style={{ color: '#a39c93' }}>{it.dial}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
