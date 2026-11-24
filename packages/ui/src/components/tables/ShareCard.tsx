'use client';

// "Ahenk Masa Dinamiği (Yapay Zekâ Raporu)" paylaşım kartı: dikey görsel kart (1080×1920, hikâye oranı) tarayıcıda canvas ile
// çizilir. İçerik: masa türü, Genel Uyum (büyük), masa DNA'sının kısa özeti, mekân, tarih ve saat, teaser, alt satır.
// Diğer katılımcıların fotoğrafı, adı, baş harfi ya da herhangi bir bilgisi kartta yoktur. Paylaşım metnindeki link
// kullanıcının kişisel davet linkidir.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { documentLang } from '../../lib/lang';

type MeetingKind = 'GROUP' | 'ONE_ON_ONE' | 'KANKA';
interface CardData {
  type: MeetingKind;
  uyumSkoru: number;
  dnaShort: string | null;
  venueName: string | null;
  scheduledAt: string;
  teaser: number;
  inviteLink: string;
}

// Masa türü renkleri (paket kartı paletinden: Grup mavi, Baş Başa kırmızı, Kankamla mor)
const TYPE_COLORS: Record<MeetingKind, { accent: string; from: string; to: string }> = {
  GROUP: { accent: '#3b7dd8', from: '#071a3a', to: '#1d4f9c' },
  ONE_ON_ONE: { accent: '#d6453a', from: '#3d0907', to: '#a3231b' },
  KANKA: { accent: '#8b5cf6', from: '#1f0a3a', to: '#5b2a9c' },
};

const W = 1080;
const H = 1920;
const PAD = 96;
const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';
const SERIF = '"DM Serif Display", Georgia, serif';

function cardDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const loc = locale === 'en' ? 'en-GB' : 'tr-TR';
  const tz = 'Europe/Istanbul';
  const dm = d.toLocaleDateString(loc, { day: 'numeric', month: 'long', timeZone: tz });
  const wd = d.toLocaleDateString(loc, { weekday: 'long', timeZone: tz });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz });
  return locale === 'en' ? `${wd}, ${dm} ${time}` : `${dm}, ${wd} ${time}`;
}

// Metni genişliğe göre satırlara böler (en fazla maxLines; taşan son satır … ile biter)
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxW || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

function drawCard(canvas: HTMLCanvasElement, d: CardData, texts: { title: string; type: string; overall: string; teaser: string; footer: string; date: string }) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const col = TYPE_COLORS[d.type];
  canvas.width = W; canvas.height = H;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b0b0b');
  bg.addColorStop(0.45, col.from);
  bg.addColorStop(1, col.to);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Hafif parıltı
  const glow = ctx.createRadialGradient(W * 0.8, H * 0.32, 0, W * 0.8, H * 0.32, 700);
  glow.addColorStop(0, `${col.accent}55`);
  glow.addColorStop(1, `${col.accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = `400 84px ${SERIF}`;
  ctx.fillText('Ahenk', PAD, PAD + 70);

  // Masa türü rozeti (sağ üst)
  ctx.font = `700 34px ${SANS}`;
  const label = texts.type.toLocaleUpperCase(documentLang() === 'en' ? 'en' : 'tr-TR');
  const lw = ctx.measureText(label).width + 56;
  const lx = W - PAD - lw, ly = PAD + 14;
  ctx.fillStyle = col.accent;
  ctx.beginPath();
  ctx.roundRect(lx, ly, lw, 72, 36);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, lx + 28, ly + 48);

  // Başlık
  let y = PAD + 230;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `600 46px ${SANS}`;
  for (const line of wrap(ctx, texts.title, W - PAD * 2, 2)) { ctx.fillText(line, PAD, y); y += 60; }

  // Genel Uyum (büyük)
  y += 230;
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 300px ${SANS}`;
  ctx.fillText(`%${Math.max(0, Math.min(100, d.uyumSkoru))}`, PAD - 10, y);
  y += 90;
  ctx.fillStyle = '#4ade80';
  ctx.font = `700 52px ${SANS}`;
  ctx.fillText(texts.overall, PAD, y);

  // Masa DNA'sı (kısa özet)
  y += 70;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(PAD, y, W - PAD * 2, 2);
  y += 100;
  if (d.dnaShort) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `400 58px ${SERIF}`;
    for (const line of wrap(ctx, d.dnaShort, W - PAD * 2, 3)) { ctx.fillText(line, PAD, y); y += 76; }
  }

  // Mekân, tarih ve saat
  y += 60;
  if (d.venueName) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 50px ${SANS}`;
    for (const line of wrap(ctx, d.venueName, W - PAD * 2, 2)) { ctx.fillText(line, PAD, y); y += 64; }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `500 42px ${SANS}`;
  ctx.fillText(texts.date, PAD, y);

  // Teaser
  y += 130;
  ctx.font = `italic 400 50px ${SERIF}`;
  const tLines = wrap(ctx, `“${texts.teaser}”`, W - PAD * 2 - 30, 4);
  ctx.fillStyle = col.accent;
  ctx.fillRect(PAD, y - 46, 8, tLines.length * 66);
  ctx.fillStyle = '#ffffff';
  for (const line of tLines) { ctx.fillText(line, PAD + 34, y); y += 66; }

  // Alt satır
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(PAD, H - PAD - 90, W - PAD * 2, 2);
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 40px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText(texts.footer, W / 2, H - PAD - 10);
  ctx.textAlign = 'left';
}

const BTN: React.CSSProperties = {
  minHeight: 44, borderRadius: 9999, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)',
  color: '#f4f1ec', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif', cursor: 'pointer', padding: '0 14px',
};

export function ShareCardModal({ meetingId, apiBase, headers, onClose }: {
  meetingId: string; apiBase: string; headers: Record<string, string>; onClose: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [data, setData] = useState<CardData | null>(null);
  const [err, setErr] = useState('');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState('');
  const [storyNotice, setStoryNotice] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/meetings/${meetingId}/share-card`, { headers, credentials: 'include' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((j as { message?: string }).message ?? t('masa.connError'));
        setData(j as CardData);
      })
      .catch((e: Error) => setErr(e.message));
  }, [apiBase, meetingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const teaserText = data ? t(`share.teasers.${data.type}.t${data.teaser}`) : '';

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      const canvas = canvasRef.current ?? document.createElement('canvas');
      canvasRef.current = canvas;
      drawCard(canvas, data, {
        title: t('share.title'), type: t(`share.type${data.type}`), overall: t('masa.aiOverall'),
        teaser: teaserText, footer: t('share.footer'), date: cardDate(data.scheduledAt, locale),
      });
      setImg(canvas.toDataURL('image/png'));
    };
    // Yazı tipleri yüklenince çizilir
    (document.fonts?.ready ?? Promise.resolve()).then(render, render);
    return () => { cancelled = true; };
  }, [data, teaserText, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeTeaser = useCallback(async () => {
    if (!data || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`${apiBase}/meetings/${meetingId}/share-card/teaser`, { method: 'POST', headers, credentials: 'include' });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setData({ ...data, teaser: (j as { teaser: number }).teaser });
    } finally { setBusy(false); }
  }, [apiBase, meetingId, data, busy, headers]);

  const shareText = data ? t('share.shareText', { teaser: teaserText, link: data.inviteLink }) : '';

  function download() {
    if (!img) return;
    const a = document.createElement('a');
    a.href = img;
    a.download = 'ahenk-masa-dinamigi.png';
    a.click();
  }

  // Hikâye: cihaz paylaşım menüsü görsel dosyasını destekliyorsa onunla açılır (Instagram / Facebook seçilebilir);
  // desteklemiyorsa görsel indirilir ve hikâyede paylaşma notu gösterilir
  async function shareStory() {
    if (!img) return;
    setHint('');
    try {
      const blob = await (await fetch(img)).blob();
      const file = new File([blob], 'ahenk-masa-dinamigi.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText });
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    download();
    setHint(t('share.storyHint'));
  }

  // Hikâye: paylaşımdan önce kişisel davet linki panoya kopyalanır ve uyarı gösterilir; "Devam Et" ile paylaşım başlar
  function story() {
    if (!data) return;
    navigator.clipboard?.writeText(data.inviteLink).catch(() => {});
    setStoryNotice(true);
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, maxHeight: '94vh', overflowY: 'auto', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p id="share-title" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f4f1ec', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>{t('share.title')}</p>
        {err && <p role="alert" style={{ margin: 0, fontSize: 13, color: '#ff6b6b', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>{err}</p>}
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={t('share.title')} style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 12, display: 'block' }} />
        )}
        {data && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>{teaserText}</span>
            <button type="button" onClick={changeTeaser} disabled={busy} style={{ ...BTN, flexShrink: 0, opacity: busy ? 0.5 : 1 }}>{t('share.change')}</button>
          </div>
        )}
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button type="button" onClick={download} disabled={!img} style={BTN}>{t('share.download')}</button>
            <button type="button" onClick={story} disabled={!img} style={BTN}>{t('share.igStory')}</button>
            <button type="button" onClick={story} disabled={!img} style={BTN}>{t('share.fbStory')}</button>
            <button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer')} style={BTN}>{t('share.whatsapp')}</button>
            <button type="button" onClick={() => { window.location.href = `sms:?&body=${encodeURIComponent(shareText)}`; }} style={{ ...BTN, gridColumn: '1 / -1' }}>{t('share.message')}</button>
          </div>
        )}
        {storyNotice && (
          <div role="alertdialog" aria-modal="true" aria-describedby="story-notice" onClick={(e) => { e.stopPropagation(); setStoryNotice(false); }}
            style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 340, background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p id="story-notice" style={{ margin: 0, fontSize: 14, color: '#f4f1ec', fontFamily: 'Inter, sans-serif', lineHeight: 1.55, textAlign: 'center' }}>{t('share.linkCopied')}</p>
              <button type="button" className="btn-primary justify-center" style={{ minHeight: 44, width: '100%' }} onClick={() => { setStoryNotice(false); shareStory(); }}>{t('share.continue')}</button>
            </div>
          </div>
        )}
        {hint && <p style={{ margin: 0, fontSize: 12, color: '#a39c93', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>{hint}</p>}
        <button type="button" className="btn-ghost justify-center" onClick={onClose} style={{ minHeight: 44, width: '100%' }}>{t('share.close')}</button>
      </div>
    </div>
  );
}
