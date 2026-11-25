'use client';

// Sadakat Programı "Paylaş" alt paneli (sistem paylaşım penceresi yerine). 1. satır: WhatsApp, Telegram, Facebook kare kartlar
// (yalnız renkli marka logosu); 2. satır: "Kartı İndir" (Sadakat paylaşım kartı 1080×1920 PNG indirilir) ve "Diğer".
// Instagram butonu INSTAGRAM_SHARE_ENABLED false iken gizli (kod duruyor; true olunca 1. satırın başına gelir): kart dosya
// paylaşımı destekleniyorsa sistem paylaşımıyla, desteklenmiyorsa indirilir. Mobil karşılığı: apps/mobile/components/LoyaltyShareSheet.tsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { drawLoyaltyCard } from '@ahenk/ui';
import { INSTAGRAM_SHARE_ENABLED, SHARE_BRAND_COLORS, SHARE_BRAND_PATHS } from '@ahenk/shared';

export interface LoyaltySharer { firstName: string; lastName: string; photoUrl: string | null }

type Target = 'instagram' | 'whatsapp' | 'telegram' | 'facebook';

// Resmî renkli marka logoları: WhatsApp yeşil daire üzerinde beyaz logo; Telegram ve Facebook marka renginde daire, beyaz uçak / f
function BrandLogo({ target, size }: { target: Target; size: number }) {
  if (target === 'instagram') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={SHARE_BRAND_COLORS.instagram} strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill={SHARE_BRAND_COLORS.instagram} stroke="none" />
      </svg>
    );
  }
  if (target === 'whatsapp') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill={SHARE_BRAND_COLORS.whatsapp} />
        <path d={SHARE_BRAND_PATHS.whatsapp} fill="#ffffff" transform="translate(4.8 4.8) scale(0.6)" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="#ffffff" />
      <path d={SHARE_BRAND_PATHS[target as 'telegram' | 'facebook']} fill={SHARE_BRAND_COLORS[target as 'telegram' | 'facebook']} />
    </svg>
  );
}

const PANEL_BTN: React.CSSProperties = {
  borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#f4f1ec', cursor: 'pointer',
};

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

  async function downloadCard() {
    if (busy) return;
    setBusy(true); setMsg('');
    try {
      const file = await cardFile();
      if (!file) { setMsg(t('share.saveFailed')); return; }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally { setBusy(false); }
  }

  async function more() {
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch (e) { if ((e as Error).name === 'AbortError') return; }
    navigator.clipboard?.writeText(text).then(() => setMsg(t('loyalty.copied'))).catch(() => {});
  }

  const brands: [Target, string, () => void][] = [
    ...(INSTAGRAM_SHARE_ENABLED ? [['instagram', t('loyalty.shareInstagram'), instagram] as [Target, string, () => void]] : []),
    ['whatsapp', t('loyalty.shareWhatsapp'), () => open(`https://wa.me/?text=${encodeURIComponent(text)}`)],
    ['telegram', t('loyalty.shareTelegram'), () => open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(textNoLink)}`)],
    ['facebook', t('loyalty.shareFacebook'), () => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`)],
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
        {/* 1. satır: eşit genişlikte kare kartlar, yalnız renkli marka logosu (erişilebilirlik etiketi uygulama adı) */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${brands.length}, 1fr)`, gap: 8 }}>
          {brands.map(([target, label, onPress]) => (
            <button key={target} type="button" onClick={onPress} aria-label={label} title={label} disabled={target === 'instagram' && busy}
              style={{ ...PANEL_BTN, aspectRatio: '1 / 1', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: target === 'instagram' && busy ? 0.5 : 1 }}>
              <BrandLogo target={target} size={40} />
            </button>
          ))}
        </div>
        {/* 2. satır: Kartı İndir ve Diğer, eşit genişlikte */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <button type="button" onClick={downloadCard} disabled={busy}
            style={{ ...PANEL_BTN, minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 12px', fontSize: 15, fontWeight: 600, opacity: busy ? 0.5 : 1 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f4f1ec" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
            </svg>
            <span>{t('loyalty.downloadCard')}</span>
          </button>
          <button type="button" onClick={more}
            style={{ ...PANEL_BTN, minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 12px', fontSize: 15, fontWeight: 600 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#f4f1ec" aria-hidden="true">
              <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
            </svg>
            <span>{t('loyalty.shareMore')}</span>
          </button>
        </div>
        {msg && <p role="status" style={{ margin: '12px 0 0', fontSize: 12, color: '#a39c93', textAlign: 'center' }}>{msg}</p>}
      </div>
    </div>,
    document.body,
  );
}
