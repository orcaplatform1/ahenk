'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

// Profil fotoğrafı kırpma ekranı (WhatsApp / Instagram gibi): tam ekran, yuvarlak kırpma çerçevesi; fotoğraf sürüklenir,
// dokunmatik ekranda iki parmakla (Instagram gibi), masaüstünde fare tekerleğiyle yakınlaştırılır. "İptal" / "Bitti". Bitti → çerçevedeki kare alan tuvalde kırpılır, JPEG File döner
// (yükleme akışı aynen: çağıran gönderir).
const MAX_ZOOM = 4;

export function PhotoCropper({ file, onCancel, onDone }: { file: File | null; onCancel: () => void; onDone: (cropped: File) => void }) {
  const t = useTranslations();
  const [src, setSrc] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [D, setD] = useState(320);
  const [busy, setBusy] = useState(false);
  // Etkin dokunuşlar: tek parmak sürükler, iki parmak yakınlaştırır / uzaklaştırır (dokunuş sayısı değişince başlangıç yeniden alınır)
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; px: number; py: number; dist: number; zoom: number } | null>(null);
  const live = useRef({ zoom, pos });
  live.current = { zoom, pos };

  useEffect(() => {
    setImg(null); setZoom(1); setPos({ x: 0, y: 0 });
    if (!file) { setSrc(null); return; }
    const u = URL.createObjectURL(file);
    setSrc(u);
    const im = new Image();
    im.onload = () => setImg(im);
    im.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    if (!file) return;
    const fit = () => setD(Math.min(window.innerWidth - 32, window.innerHeight * 0.6, 480));
    fit();
    window.addEventListener('resize', fit);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('keydown', onKey); };
  }, [file, onCancel]);

  if (!file || !src) return null;
  const base = img ? D / Math.min(img.naturalWidth, img.naturalHeight) : 1; // zoom 1: kısa kenar daireyi doldurur
  const k = base * zoom;
  const clamp = (z: number, x: number, y: number) => {
    if (!img) return { x: 0, y: 0 };
    const mx = Math.max(0, (img.naturalWidth * base * z - D) / 2);
    const my = Math.max(0, (img.naturalHeight * base * z - D) / 2);
    return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  };
  const setZoomClamped = (z: number) => { const nz = Math.max(1, Math.min(MAX_ZOOM, z)); setZoom(nz); setPos((p) => clamp(nz, p.x, p.y)); };

  // Hareket başlangıcı (dokunuş sayısı her değiştiğinde)
  const begin = () => {
    const pts = [...pointers.current.values()];
    if (!pts.length) { gesture.current = null; return; }
    const { zoom: z, pos: p } = live.current;
    gesture.current = { x: pts[0].x, y: pts[0].y, px: p.x, py: p.y, dist: pts.length >= 2 ? Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)) : 1, zoom: z };
  };

  const done = () => {
    if (!img || busy) return;
    setBusy(true);
    const side = Math.min(D / k, img.naturalWidth, img.naturalHeight);
    const cx = img.naturalWidth / 2 - pos.x / k;
    const cy = img.naturalHeight / 2 - pos.y / k;
    const sx = Math.max(0, Math.min(img.naturalWidth - side, cx - side / 2));
    const sy = Math.max(0, Math.min(img.naturalHeight - side, cy - side / 2));
    const out = Math.round(side);
    const canvas = document.createElement('canvas');
    canvas.width = out; canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setBusy(false); return; }
    ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
    canvas.toBlob((b) => {
      setBusy(false);
      if (b) onDone(new File([b], 'profile.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={t('photo.title')}
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: '#000', touchAction: 'none', userSelect: 'none' }}>
      <div
        onPointerDown={(e) => { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); begin(); }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const g = gesture.current; if (!g) return;
          const pts = [...pointers.current.values()];
          if (pts.length >= 2) {
            const z = Math.max(1, Math.min(MAX_ZOOM, g.zoom * (Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.dist)));
            setZoom(z); setPos(clamp(z, g.px, g.py));
          } else {
            setPos(clamp(live.current.zoom, g.px + pts[0].x - g.x, g.py + pts[0].y - g.y));
          }
        }}
        onPointerUp={(e) => { pointers.current.delete(e.pointerId); begin(); }}
        onPointerCancel={(e) => { pointers.current.delete(e.pointerId); begin(); }}
        onWheel={(e) => setZoomClamped(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
        style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: 'grab' }}>
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" draggable={false}
            style={{ position: 'absolute', left: '50%', top: '50%', width: img.naturalWidth * k, height: img.naturalHeight * k, maxWidth: 'none',
              transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`, pointerEvents: 'none' }} />
        )}
        {/* Yuvarlak kırpma çerçevesi: dairenin dışı karartılır */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', width: D, height: D, transform: 'translate(-50%, -50%)', borderRadius: '50%',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)', border: '1.5px solid #fff', pointerEvents: 'none' }} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 'max(8px, env(safe-area-inset-top))', display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
        <button type="button" onClick={onCancel} disabled={busy}
          style={{ minWidth: 44, minHeight: 44, padding: '0 12px', background: 'transparent', border: 'none', color: '#f4f1ec', fontSize: 17, cursor: 'pointer' }}>
          {t('photo.cropCancel')}
        </button>
        <button type="button" onClick={done} disabled={busy || !img}
          style={{ minWidth: 44, minHeight: 44, padding: '0 12px', background: 'transparent', border: 'none', color: '#f4f1ec', fontSize: 17, fontWeight: 700, cursor: 'pointer', opacity: busy || !img ? 0.5 : 1 }}>
          {t('photo.cropDone')}
        </button>
      </div>
    </div>
  );
}
