'use client';

// Sadakat Programı "Paylaş" alt paneli (sistem paylaşım penceresi yerine): Instagram, WhatsApp, Telegram, Facebook, Diğer.
// Instagram: Sadakat paylaşım kartı (1080×1920) tarayıcıda çizilir; dosya paylaşımı destekleniyorsa sistem paylaşımıyla,
// desteklenmiyorsa görsel indirilir. Diğerleri davet metni / linkiyle ilgili web adresini açar. Mobil karşılığı: apps/mobile/components/LoyaltyShareSheet.tsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { drawLoyaltyCard } from '@ahenk/ui';
import { SHARE_BRAND_COLORS, SHARE_BRAND_PATHS } from '@ahenk/shared';

export interface LoyaltySharer { firstName: string; lastName: string; photoUrl: string | null }

type Target = 'instagram' | 'whatsapp' | 'telegram' | 'facebook' | 'more';

function BrandIcon({ target }: { target: Target }) {
  if (target === 'instagram') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={SHARE_BRAND_COLORS.instagram} strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill={SHARE_BRAND_COLORS.instagram} stroke="none" />
      </svg>
    );
  }
  if (target === 'more') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#f4f1ec" aria-hidden="true">
        <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={SHARE_BRAND_COLORS[target]} aria-hidden="true">
      <path d={SHARE_BRAND_PATHS[target]} />
    </svg>
  );
}

const upper = (x: string) => x.toLocaleUpperCase('tr-TR');

export function LoyaltyShareSheet({ link, text, sharer, onClose }: { link: string; text: string; sharer: LoyaltySharer | null; onClose: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const textNoLink = text.replace(link, '').trim();

  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  // Kart görselini çizer (yazı tipleri ve görseller yüklendikten sonra); yüklenemeyen görselde yedek kullanılır
  async function cardFile(): Promise<File | null> {
    const load = (src: string | null) => new Promise<HTMLImageElement | null>((resolve) => {
      if (!src) { resolve(null); return; }
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
    const [, bg, logo, photo] = await Promise.all([
      (document.fonts?.ready ?? Promise.resolve()).catch(() => undefined),
      load('/share-bg/sadakat.webp'),
      load('/logo-white.webp'),
      load(sharer?.photoUrl ?? null),
    ]);
    const first = (sharer?.firstName ?? '').trim();
    const last = (sharer?.lastName ?? '').trim();
    const canvas = document.createElement('canvas');
    drawLoyaltyCard(canvas, {
      link,
      sharerName: last ? `${first} ${upper(last[0])}.` : first,
      sharerInitials: `${upper(first[0] ?? '')}${upper(last[0] ?? '')}`,
    }, {
      tag: t('loyalty.cardTag'), title1: t('loyalty.cardTitle1'), title2: t('loyalty.cardTitle2'),
      sub1: t('loyalty.cardSub1'), sub2: t('loyalty.cardSub2'), invites: t('loyalty.cardInvites'),
    }, { bg, logo, photo }, locale);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    return blob ? new File([blob], 'ahenk-davet.png', { type: 'image/png' }) : null;
  }

  async function instagram() {
    if (busy) return;
    setBusy(true); setMsg('');
    try {
      const file = await cardFile();
      if (!file) { setMsg(t('share.saveFailed')); return; }
      try {
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
      } catch (e) { if ((e as Error).name === 'AbortError') return; }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMsg(t('share.storyHint'));
    } finally { setBusy(false); }
  }

  async function more() {
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch (e) { if ((e as Error).name === 'AbortError') return; }
    navigator.clipboard?.writeText(text).then(() => setMsg(t('loyalty.copied'))).catch(() => {});
  }

  const actions: [Target, string, () => void][] = [
    ['instagram', t('loyalty.shareInstagram'), instagram],
    ['whatsapp', t('loyalty.shareWhatsapp'), () => open(`https://wa.me/?text=${encodeURIComponent(text)}`)],
    ['telegram', t('loyalty.shareTelegram'), () => open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(textNoLink)}`)],
    ['facebook', t('loyalty.shareFacebook'), () => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`)],
    ['more', t('loyalty.shareMore'), more],
  ];

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="loyalty-share-title" onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '24px 20px 36px', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p id="loyalty-share-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f5f5f5' }}>{t('loyalty.share')}</p>
          <button type="button" onClick={onClose} aria-label={t('share.close')}
            style={{ width: 44, height: 44, marginRight: -10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#a39c93', fontSize: 24, lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>
        <div className="flex flex-col gap-2">
          {actions.map(([target, label, onPress]) => (
            <button key={target} type="button" onClick={onPress} disabled={target === 'instagram' && busy}
              style={{ minHeight: 52, display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#f4f1ec', fontSize: 15, fontWeight: 600, cursor: 'pointer', textAlign: 'left', opacity: target === 'instagram' && busy ? 0.5 : 1 }}>
              <BrandIcon target={target} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        {msg && <p role="status" style={{ margin: '12px 0 0', fontSize: 12, color: '#a39c93', textAlign: 'center' }}>{msg}</p>}
      </div>
    </div>,
    document.body,
  );
}
