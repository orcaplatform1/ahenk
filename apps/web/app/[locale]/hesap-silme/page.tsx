'use client';

import { useLocale, useTranslations } from 'next-intl';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { StdButton } from '@ahenk/ui';

// Herkese açık hesap silme sayfası (Google Play hesap silme bağlantısı). Giriş yapmamış kişi otomatik olarak mevcut giriş
// sayfasına yönlendirilir, giriş sonrası buraya döner (giris?donus=/hesap-silme) ve
// Profilim'deki mevcut talep akışını (POST /users/me/deletion-request) başlatır.
// Metin backend/src/users/account-deletion.service.ts approve() kurallarına göre yazılmıştır.

// Metinler çeviri anahtarı (del.del<n>, del.anon<n>, del.ret<n>L / R)
const DELETED = ["del.del0", "del.del1", "del.del2", "del.del3", "del.del4", "del.del5", "del.del6", "del.del7", "del.del8", "del.del9"];

const ANONYMIZED = ["del.anon0", "del.anon1", "del.anon2"];

const RETAINED: [string, string][] = [["del.ret0L", "del.ret0R"], ["del.ret1L", "del.ret1R"], ["del.ret2L", "del.ret2R"]];

export default function HesapSilmePage() {
  const t = useTranslations();
  const locale = useLocale();
  const [session, setSession] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const toLogin = () => window.location.replace(locale === 'en' ? '/en/giris?donus=/hesap-silme' : '/giris?donus=/hesap-silme');
    if (!api.hasSession()) { toLogin(); return; }
    setSession(true);
    api.silentGet<{ request: { id: string } | null }>('/users/me/deletion-request')
      .then((r) => { if (r === null) toLogin(); else setPending(!!r?.request?.id); })
      .catch(() => {});
  }, []);

  async function confirmDelete() {
    setBusy(true); setError('');
    try {
      await api.post('/users/me/deletion-request', {});
      setPending(true);
      setOpen(false);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const card = (title: string, body: React.ReactNode, i: number) => (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.06 * i }} className="ll-card">
      <h2 className="ll-title" style={{ marginBottom: '1rem' }}>{title}</h2>
      <div style={{ color: '#c9c2b8', fontSize: 13, lineHeight: 1.75 }}>{body}</div>
    </motion.div>
  );
  const list = (items: string[]) => (
    <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {items.map((k) => <li key={k}>{t(k)}</li>)}
    </ul>
  );

  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <h1 className="ll-title">{t('del.title')}</h1>
          <p style={{ marginTop: '0.6rem', color: '#8f887f', fontSize: 13, letterSpacing: '0.03em' }}>
            {t('del.intro')}
          </p>
        </motion.div>

        <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {card(t('del.createRequest'), (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {!session ? null : pending ? (
                <p style={{ textAlign: 'center', color: '#a39c93' }}>{t('del.pending')}</p>
              ) : (
                <StdButton variant="ghost" redDot type="button" onClick={() => { setError(''); setOpen(true); }} className="mx-auto block" style={{ width: '72%' }}>
                  {t('del.deleteMine')}
                </StdButton>
              )}
            </div>
          ), 0)}

          {card(t('del.howLong'), (
            <>
              <p>{t('del.howLongBody')}</p>
              <p style={{ marginTop: '0.6rem' }}>{t('del.activeTable')}</p>
            </>
          ), 1)}

          {card(t('del.deletedTitle'), list(DELETED), 2)}
          {card(t('del.anonTitle'), list(ANONYMIZED), 3)}

          {card(t('del.retainedTitle'), (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {RETAINED.map(([label, value], i) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', padding: '0.85rem 0', borderBottom: i < RETAINED.length - 1 ? '1px solid rgba(255,255,255,0.10)' : 'none' }}>
                  <span style={{ color: '#c9c2b8', fontSize: 13, flex: 1 }}>{t(label)}</span>
                  <span style={{ color: '#a39c93', fontSize: 13, textAlign: 'right', flex: 1 }}>{t(value)}</span>
                </div>
              ))}
            </div>
          ), 4)}

          {card(t('del.contact'), (
            <p>{t('del.contactPre')} <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a>{t('del.contactPost')}</p>
          ), 5)}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t('del.deleteMine')}>
        <p className="text-sm text-[#c9c2b8] leading-relaxed">
          {t('del.modalBody')}
        </p>
        {error && <p className="text-[#ff6b6b] text-sm mt-3">{error}</p>}
        <div className="mt-5 flex flex-col gap-3">
          <button type="button" onClick={confirmDelete} disabled={busy} className="mx-auto block btn-primary btn-tone-danger disabled:opacity-40" style={{ width: '72%' }}>
            {busy ? t('del.sending') : t('del.confirm')}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="mx-auto block btn-primary btn-tone-safe" style={{ width: '72%' }}>
            {t('del.cancel')}
          </button>
        </div>
      </Modal>
    </main>
  );
}
