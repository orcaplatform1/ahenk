'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatNamed, splitE164, toE164, type Lang } from '@ahenk/shared';
import { api } from '@/lib/api';
import { CountryCodeButton } from '@/components/PhoneCountryField';

interface ServerBlock { id: string; phoneNumber?: string; hashedPhone?: string; createdAt: string; }

export function TabRehber() {
  const t = useTranslations();
  const locale = useLocale() as Lang;
  const [serverBlocks, setServerBlocks] = useState<ServerBlock[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  // Ülke kodu: varsayılan kayıtlı telefonun ülkesi; numara E.164 gönderilir (libphonenumber-js)
  const [country, setCountry] = useState('TR');

  function loadBlocks() {
    api.get<{ count: number; items: ServerBlock[] }>('/contact-blocks')
      .then(r => setServerBlocks(r.items ?? []))
      .catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    loadBlocks();
    api.get<{ phone?: string | null }>('/auth/me').then((me) => setCountry(splitE164(me.phone).country)).catch(() => {});
  }, []);

  async function handleAdd() {
    const display = toE164(country, input);
    if (!display) { setError(t('phone.invalid')); return; }
    if (serverBlocks.length >= 50) { setError(t('block.max50')); return; }
    setAdding(true); setError('');
    try {
      await api.post('/contact-blocks/sync', { hashedPhones: [display] });
      setInput('');
      loadBlocks();
    } catch (e) { setError((e as Error).message); }
    finally { setAdding(false); }
  }

  async function handleServerDelete(b: ServerBlock) {
    setDeleting(b.id);
    try {
      await api.delete(`/contact-blocks/${b.id}`);
      setServerBlocks(prev => prev.filter(x => x.id !== b.id));
    } catch (e) { setError((e as Error).message); }
    finally { setDeleting(null); }
  }

  function resolveDisplay(b: ServerBlock, i: number): string {
    const val = b.phoneNumber ?? b.hashedPhone ?? '';
    if (val.startsWith('+') || /^\d{10,}$/.test(val)) return val;
    return t('block.numberN', { n: i + 1 });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Sayaç */}
      <div className="ll-card">
        <div className="ll-head"><h3 className="ll-title">{t('block.title')}</h3></div>
        <p className="text-2xl font-semibold text-[#f5f5f5]">
          {serverBlocks.length}<span className="text-sm font-normal text-[#a39c93]">/50</span>
        </p>
        <p className="text-xs text-[#a39c93] mt-1">
          {t('block.info')}
        </p>
      </div>

      {/* Yeni numara girişi */}
      <div className="flex gap-2">
        <CountryCodeButton country={country} onChange={(c) => { setCountry(c); setError(''); }} />
        <input
          type="tel"
          value={input}
          onChange={(e) => { setInput(e.target.value.replace(/\D/g, '').slice(0, 15)); setError(''); }}
          placeholder={country === 'TR' ? '5XX XXX XX XX' : ''}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="input-glass flex-1 px-4 py-3 text-sm"
        />
        <button
          onClick={handleAdd}
          disabled={adding || serverBlocks.length >= 50}
          className="btn-primary disabled:opacity-50"
        >
          {adding ? '…' : t('prof.add')}
        </button>
      </div>

      {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
      {serverBlocks.length >= 50 && <p className="text-[#ff6b6b] text-xs">{t('block.maxReached')}</p>}

      {/* Kaydedilmiş engeller */}
      {serverBlocks.length > 0 && (
        <div className="flex flex-col gap-2">
          {serverBlocks.map((b, i) => (
            <div key={b.id} className="ll-card flex items-center justify-between" style={{ padding: '12px 16px' }}>
              <div>
                <span className="text-[13px] text-[#c9c2b8]">{resolveDisplay(b, i)}</span>
                <span className="block text-xs text-[#8f887f] mt-0.5">
                  {formatNamed(b.createdAt, locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <button
                onClick={() => handleServerDelete(b)}
                disabled={deleting === b.id}
                className="text-xs text-[#a39c93] hover:text-[#f5f5f5] transition-colors disabled:opacity-40 px-3 py-1"
                style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
              >
                {deleting === b.id ? '…' : t('block.remove')}
              </button>
            </div>
          ))}
        </div>
      )}

      {serverBlocks.length === 0 && (
        <p className="text-sm text-[#8f887f] text-center py-4">{t('block.empty')}</p>
      )}
    </div>
  );
}
