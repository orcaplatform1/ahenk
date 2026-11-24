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
  peopleCount: number; // Masanın gerçek katılımcı sayısı
  cityName: string | null; // Masanın şehri
  scheduledAt: string;
  teaser: number;
  inviteCode: number | null;
  inviteLink: string | null;
  sharerName: string; // Paylaşan kullanıcı: "Ahmet Y."
  sharerInitials: string; // Fotoğraf yoksa: "AY"
  sharerPhotoUrl: string | null; // Onaylı profil fotoğrafı
}

// Masa türüne göre isteğe bağlı arka plan görseli (1080 × 1920 WebP): apps/web/public/share-bg/<dosya>.webp.
// Dosya varsa gradyan ve ışıma yerine bu görsel çizilir; yoksa gradyan ve ışıma aynen kullanılır.
const BG_FILE: Record<MeetingKind, string> = { GROUP: 'grup', ONE_ON_ONE: 'basbasa', KANKA: 'kankamla' };

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

// Kartta çizilen görseller: masa türünün arka planı (yoksa gradyan), Ahenk logosu (/logo-white.webp: beyaz, tek renk, transparan zemin), paylaşanın profil fotoğrafı (yoksa baş harfler)
type CardImages = { bg?: CanvasImageSource | null; logo?: CanvasImageSource | null; photo?: CanvasImageSource | null };

function drawCard(canvas: HTMLCanvasElement, d: CardData, texts: { title: string; type: string; overall: string; teaser: string; footer: string; date: string; people: string; atTable: string }, imgs: CardImages = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const col = TYPE_COLORS[d.type];
  canvas.width = W; canvas.height = H;
  const MAXW = W - PAD * 2;

  if (imgs.bg) {
    // Masa türünün arka plan görseli tam boyut
    ctx.drawImage(imgs.bg, 0, 0, W, H);
  } else {
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
  }

  // Üst: Ahenk logosu "Ahenk" yazısının üstünde, yazıya göre yatayda ortalı; masa türü etiketi sağa yaslı, "Ahenk" yazısıyla aynı hizada
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 84px ${SERIF}`;
  const brandW = ctx.measureText('Ahenk').width;
  const LOGO = 120;
  if (imgs.logo) ctx.drawImage(imgs.logo, PAD + (brandW - LOGO) / 2, PAD, LOGO, LOGO);
  const brandBase = PAD + LOGO + 82; // "Ahenk" taban çizgisi
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Ahenk', PAD, brandBase);
  const brandMid = brandBase - 30; // yazının dikey ortası (büyük harf yüksekliğinin yarısı)

  ctx.font = `700 34px ${SANS}`;
  const label = texts.type.toLocaleUpperCase(documentLang() === 'en' ? 'en' : 'tr-TR');
  const lw = ctx.measureText(label).width + 56;
  const lx = W - PAD - lw, ly = brandMid - 36;
  ctx.fillStyle = col.accent;
  ctx.beginPath();
  ctx.roundRect(lx, ly, lw, 72, 36);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, lx + 28, ly + 48);
  const TOP = brandBase + 24;

  // Alt: paylaşan kullanıcı satırı (fotoğraf / baş harfler, "Ahmet Y.", "bu masada"), ayraç ve davet satırı sabit
  const FOOT_LINE = H - PAD - 90;
  const AV = 96;
  const avY = FOOT_LINE - 40 - AV;
  const cx = PAD + AV / 2, cy = avY + AV / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, AV / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (imgs.photo) {
    ctx.drawImage(imgs.photo, PAD, avY, AV, AV);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(PAD, avY, AV, AV);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 36px ${SANS}`;
    const iw = ctx.measureText(d.sharerInitials).width;
    ctx.fillText(d.sharerInitials, cx - iw / 2, cy + 13);
  }
  ctx.restore();
  ctx.strokeStyle = col.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, AV / 2 - 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 40px ${SANS}`;
  ctx.fillText(d.sharerName, PAD + AV + 28, cy - 4);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `400 30px ${SANS}`;
  ctx.fillText(texts.atTable, PAD + AV + 28, cy + 36);
  const BOTTOM = avY - 40;

  // Ortadaki içerik bloğu (başlık, yüzde, Genel Uyum, ayırıcı, karakter cümlesi, kişi · şehir, tarih, alıntı): önce yerleşim
  // hesaplanır, sonra üst satır ile paylaşan kullanıcı satırı arasında dikeyde ortalanarak çizilir.
  const ops: ((oy: number) => void)[] = [];

  // Başlık: tek satır; 888 px'e sığmazsa yazı küçülür
  let ts = 46;
  ctx.font = `600 ${ts}px ${SANS}`;
  while (ts > 20 && ctx.measureText(texts.title).width > MAXW) { ts -= 1; ctx.font = `600 ${ts}px ${SANS}`; }
  const titleFont = ctx.font;
  let y = Math.round(ts * 0.78);
  const ty = y;
  ops.push((oy) => { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = titleFont; ctx.fillText(texts.title, PAD, oy + ty); });

  // Genel Uyum yüzdesi (150 px'ten %25 küçük) ve "Genel Uyum" (52 px'ten %25 küçük)
  y += 130;
  const sy = y;
  ops.push((oy) => { ctx.fillStyle = '#ffffff'; ctx.font = `800 112.5px ${SANS}`; ctx.fillText(`%${Math.max(0, Math.min(100, d.uyumSkoru))}`, PAD - 4, oy + sy); });
  y += 68;
  const gy = y;
  ops.push((oy) => { ctx.fillStyle = '#4ade80'; ctx.font = `700 39px ${SANS}`; ctx.fillText(texts.overall, PAD, oy + gy); });

  // Ayırıcı ve masa DNA'sı (kısa özet)
  y += 60;
  const dy = y;
  ops.push((oy) => { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(PAD, oy + dy, MAXW, 2); });
  y += 75;
  if (d.dnaShort) {
    ctx.font = `400 43.5px ${SERIF}`;
    for (const line of wrap(ctx, d.dnaShort, MAXW, 3)) {
      const ly2 = y;
      ops.push((oy) => { ctx.fillStyle = '#ffffff'; ctx.font = `400 43.5px ${SERIF}`; ctx.fillText(line, PAD, oy + ly2); });
      y += 57;
    }
  }

  // Kişi sayısı · şehir (mekân adı yok) ve tarih / saat
  y += 60;
  const py = y;
  ops.push((oy) => { ctx.fillStyle = '#ffffff'; ctx.font = `700 50px ${SANS}`; ctx.fillText(texts.people, PAD, oy + py); });
  y += 64;
  const dty = y;
  ops.push((oy) => { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `500 42px ${SANS}`; ctx.fillText(texts.date, PAD, oy + dty); });

  // Alıntı (teaser)
  y += 110;
  ctx.font = `italic 400 37.5px ${SERIF}`;
  const tLines = wrap(ctx, `“${texts.teaser}”`, MAXW - 30, 4);
  const tby = y;
  ops.push((oy) => {
    ctx.fillStyle = col.accent;
    ctx.fillRect(PAD, oy + tby - 34.5, 8, tLines.length * 49.5);
    ctx.fillStyle = '#ffffff';
    ctx.font = `italic 400 37.5px ${SERIF}`;
    tLines.forEach((line, i) => ctx.fillText(line, PAD + 34, oy + tby + i * 49.5));
  });
  const blockH = tby + (tLines.length - 1) * 49.5 + 12;
  const oy = Math.round(TOP + (BOTTOM - TOP - blockH) / 2);
  for (const op of ops) op(oy);

  // Alt satır: ayraç ve davet satırı (tek satır; 888 px'e sığmazsa yazı küçülür, satır bölünmez)
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(PAD, FOOT_LINE, MAXW, 2);
  ctx.fillStyle = '#ffffff';
  let fs = 40;
  ctx.font = `600 ${fs}px ${SANS}`;
  while (fs > 16 && ctx.measureText(texts.footer).width > MAXW) { fs -= 1; ctx.font = `600 ${fs}px ${SANS}`; }
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
    const render = (imgs: CardImages) => {
      if (cancelled) return;
      const canvas = canvasRef.current ?? document.createElement('canvas');
      canvasRef.current = canvas;
      drawCard(canvas, data, {
        title: t('share.title'), type: t(`share.type${data.type}`), overall: t('masa.aiOverall'),
        teaser: teaserText, footer: t('share.footer', { code: data.inviteCode ?? '' }), date: cardDate(data.scheduledAt, locale),
        people: t('share.people', { count: data.peopleCount, city: data.cityName ?? '' }), atTable: t('share.atTable'),
      }, imgs);
      setImg(canvas.toDataURL('image/png'));
    };
    // Görsel yükleme: yüklenemeyen görselde yedek kullanılır (arka plan → gradyan, fotoğraf → baş harfler)
    const load = (src: string | null) => new Promise<HTMLImageElement | null>((resolve) => {
      if (!src) { resolve(null); return; }
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
    // Yazı tipleri ve görseller yüklenince çizilir
    Promise.all([
      (document.fonts?.ready ?? Promise.resolve()).catch(() => undefined),
      load(`/share-bg/${BG_FILE[data.type]}.webp`),
      load('/logo-white.webp'),
      load(data.sharerPhotoUrl),
    ]).then(([, bg, logo, photo]) => render({ bg, logo, photo }));
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

  const shareText = data ? t('share.shareText', { teaser: teaserText, link: data.inviteLink ?? 'https://ahenk.co' }) : '';

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
    if (data.inviteLink) navigator.clipboard?.writeText(data.inviteLink).catch(() => {});
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
