'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ID_TYPES, isValidIdNumber, type IdType } from '@ahenk/shared';
import { StdButton } from '@ahenk/ui';

// Web ödeme ekranı: "Paket Al" / "Abone Ol" sonrası önce kimlik türü (TC / YKN / Pasaport), sonra numara istenir. Zorunlu.
// TC: 11 hane rakam (mevcut kural); YKN: 11 hane rakam, "99" ile başlar; Pasaport: 6–9 harf ve rakam.
// Numara yalnız iyzico'ya gönderilir, veritabanına yazılmaz; her web ödemesinde yeniden sorulur.
export default function TcknModal({ open, busy, error, onCancel, onSubmit }: {
  open: boolean;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onSubmit: (identityNumber: string, identityType: IdType) => void;
}) {
  const t = useTranslations();
  const [type, setType] = useState<IdType>('TC');
  const [tckn, setTckn] = useState('');
  const locale = useLocale();
  // Ön Bilgilendirme Formu + Mesafeli Satış Sözleşmesi onay kutusu: işaretlenmeden ödeme butonu pasif (onay kaydı backend'de)
  const [agreed, setAgreed] = useState(false);
  useEffect(() => { if (open) setAgreed(false); }, [open]);
  if (!open) return null;
  const legal = (path: string) => (locale === 'en' ? `/en${path}` : path);
  const valid = isValidIdNumber(type, tckn);
  const clean = (v: string) => (type === 'PASSPORT' ? v.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 9) : v.replace(/\D/g, '').slice(0, 11));
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }} role="dialog" aria-modal="true" aria-labelledby="tckn-title">
      <div className="ll-card w-full max-w-md flex flex-col gap-3" style={{ background: '#121212' }}>
        <h3 id="tckn-title" className="ll-title">{t('pay.title')}</h3>
        <div className="flex gap-2" role="radiogroup" aria-label={t('pay.idType')}>
          {ID_TYPES.map((it) => (
            <button key={it} type="button" role="radio" aria-checked={type === it} onClick={() => { setType(it); setTckn(''); }}
              className="flex-1 text-xs rounded-xl" style={{ minHeight: 44, padding: '0 6px', border: `1px solid ${type === it ? '#d6453a' : 'rgba(255,255,255,0.12)'}`, background: type === it ? 'rgba(214,69,58,0.12)' : 'transparent', color: '#f4f1ec' }}>
              {t(`pay.type${it}`)}
            </button>
          ))}
        </div>
        <label htmlFor="tckn-input" className="text-sm text-[#f4f1ec]">{t(`pay.label${type}`)}</label>
        <input
          id="tckn-input"
          value={tckn}
          onChange={(e) => setTckn(clean(e.target.value))}
          inputMode={type === 'PASSPORT' ? 'text' : 'numeric'}
          autoComplete="off"
          required
          maxLength={type === 'PASSPORT' ? 9 : 11}
          placeholder={t(`pay.placeholder${type}`)}
          style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '11px 14px', fontSize: 14, color: '#f5f5f5', outline: 'none', letterSpacing: '0.06em' }}
        />
        {tckn.length > 0 && !valid && <p className="text-xs text-[#ff6b6b]">{t(`pay.invalid${type}`)}</p>}
        <p style={{ fontSize: 11, lineHeight: 1.5, color: '#a39c93', margin: 0 }}>
          {t('pay.iyzicoNote')}
        </p>
        <label className="flex items-start gap-3 cursor-pointer" style={{ minHeight: 44 }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: '#c0392b', flexShrink: 0, marginTop: 2 }}
          />
          <span style={{ fontSize: 12, lineHeight: 1.6, color: '#c9c2b8' }}>
            {t('pay.agreePre')}
            <a href={legal('/on-bilgilendirme-formu')} target="_blank" rel="noopener noreferrer" style={{ color: '#c0392b' }}>{t('pay.agreePreInfo')}</a>
            {t('pay.agreeMid')}
            <a href={legal('/mesafeli-satis-sozlesmesi')} target="_blank" rel="noopener noreferrer" style={{ color: '#c0392b' }}>{t('pay.agreeDistance')}</a>
            {t('pay.agreePost')}
          </span>
        </label>
        {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}
        <div className="flex flex-wrap gap-2 mt-1">
          <StdButton variant="ghost" onClick={() => { setTckn(''); setAgreed(false); onCancel(); }} className="flex-1 justify-center">{t('pay.cancel')}</StdButton>
          <StdButton variant="primary" onClick={() => valid && agreed && onSubmit(tckn, type)} disabled={!valid || !agreed || busy} className="flex-1 justify-center disabled:opacity-50">
            {busy ? t('pay.redirecting') : t('pay.proceed')}
          </StdButton>
        </div>
      </div>
    </div>
  );
}
