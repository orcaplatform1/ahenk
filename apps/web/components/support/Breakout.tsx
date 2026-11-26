'use client';

// Canlı Destek "Beklerken oyna": tek seviye Breakout (5 sıra tuğla, 3 can). Ses / efekt yok; yalnız top, raket, tuğla (Ahenk renkleri).
// Sabit adımlı mantık (60 adım/sn) + requestAnimationFrame çizimi; sekme arka plandayken tarayıcı çizimi durdurur.
// Skor yalnız ekranda: hiçbir veri sunucuya, yerel depolamaya ya da loga yazılmaz. Mobil karşılığı apps/mobile/components/Breakout.tsx.
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { StdButton } from '@ahenk/ui';

const W = 320; const H = 400;
const ROWS = 5; const COLS = 7; const GAP = 6; const TOP = 40; const BH = 14;
const BW = (W - GAP * (COLS + 1)) / COLS;
const PW = 64; const PH = 10; const PY = H - 28; const R = 6;
const SPEED = 240; // px/sn
const STEP = 1 / 60;
const ROW_COLORS = ['#c0392b', '#d6453a', '#ff6b5e', '#ff8a7e', '#e8a27a'];

type G = { px: number; bx: number; by: number; vx: number; vy: number; bricks: boolean[]; score: number; lives: number; over: boolean };
const fresh = (): G => ({ px: W / 2, bx: W / 2, by: PY - 20, vx: SPEED * 0.6, vy: -SPEED * 0.8, bricks: Array(ROWS * COLS).fill(true), score: 0, lives: 3, over: false });

// onClose: "Oyunu kapat" (Skor / Can satırının ortasında, oyun alanının üstünde; kaydırmadan görünür)
export function Breakout({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  const canvas = useRef<HTMLCanvasElement>(null);
  const g = useRef<G>(fresh());
  const [hud, setHud] = useState({ score: 0, lives: 3, over: false });
  const [run, setRun] = useState(0);

  useEffect(() => {
    const cv = canvas.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.current = fresh(); setHud({ score: 0, lives: 3, over: false });
    let raf = 0; let last = performance.now(); let acc = 0;

    const step = () => {
      const s = g.current; if (s.over) return;
      s.bx += s.vx * STEP; s.by += s.vy * STEP;
      if (s.bx < R) { s.bx = R; s.vx = Math.abs(s.vx); }
      if (s.bx > W - R) { s.bx = W - R; s.vx = -Math.abs(s.vx); }
      if (s.by < R) { s.by = R; s.vy = Math.abs(s.vy); }
      // Raket: çarpma noktasına göre açı
      if (s.vy > 0 && s.by + R >= PY && s.by + R <= PY + PH + 8 && Math.abs(s.bx - s.px) <= PW / 2 + R) {
        const k = (s.bx - s.px) / (PW / 2);
        s.vx = SPEED * Math.max(-0.9, Math.min(0.9, k)); s.vy = -Math.sqrt(SPEED * SPEED - s.vx * s.vx); s.by = PY - R;
      }
      for (let i = 0; i < s.bricks.length; i++) {
        if (!s.bricks[i]) continue;
        const x = GAP + (i % COLS) * (BW + GAP); const y = TOP + Math.floor(i / COLS) * (BH + GAP);
        if (s.bx + R > x && s.bx - R < x + BW && s.by + R > y && s.by - R < y + BH) {
          s.bricks[i] = false; s.score += 10;
          const fromSide = s.bx < x || s.bx > x + BW;
          if (fromSide) s.vx = -s.vx; else s.vy = -s.vy;
          const done = s.bricks.every((b) => !b);
          if (done) s.over = true;
          setHud({ score: s.score, lives: s.lives, over: s.over });
          break;
        }
      }
      if (s.by > H + R) {
        s.lives -= 1;
        if (s.lives <= 0) s.over = true;
        else { s.bx = s.px; s.by = PY - 20; s.vx = SPEED * 0.6; s.vy = -SPEED * 0.8; }
        setHud({ score: s.score, lives: Math.max(0, s.lives), over: s.over });
      }
    };
    const draw = () => {
      const s = g.current;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0f0f0f'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < s.bricks.length; i++) {
        if (!s.bricks[i]) continue;
        ctx.fillStyle = ROW_COLORS[Math.floor(i / COLS)];
        ctx.fillRect(GAP + (i % COLS) * (BW + GAP), TOP + Math.floor(i / COLS) * (BH + GAP), BW, BH);
      }
      ctx.fillStyle = '#f4f1ec'; ctx.fillRect(s.px - PW / 2, PY, PW, PH);
      if (!s.over) { ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(s.bx, s.by, R, 0, Math.PI * 2); ctx.fill(); }
    };
    const loop = (now: number) => {
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      while (acc >= STEP) { step(); acc -= STEP; }
      draw();
      if (!g.current.over) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Raket: fare ya da parmakla sürükleme
    const move = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      g.current.px = Math.max(PW / 2, Math.min(W - PW / 2, ((e.clientX - r.left) / r.width) * W));
      if (g.current.over) draw();
    };
    const down = (e: PointerEvent) => { cv.setPointerCapture(e.pointerId); move(e); };
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerdown', down);
    return () => { cancelAnimationFrame(raf); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerdown', down); };
  }, [run]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: 320, fontSize: 12, color: '#a39c93' }}>
        <span style={{ flex: 1 }}>{t('sup.score', { n: hud.score })}</span>
        {/* Küçük ghost buton (sohbet başlığındaki SONLANDIR ile aynı stil) */}
        <button type="button" className="btn-ghost" onClick={onClose} style={{ padding: '4px 10px', fontSize: 9, lineHeight: 1.5, gap: 6, whiteSpace: 'nowrap' }}>{t('sup.closeGame')}</button>
        <span style={{ flex: 1, textAlign: 'right' }}>{t('sup.lives', { n: hud.lives })}</span>
      </div>
      <canvas ref={canvas} style={{ width: '100%', maxWidth: 320, aspectRatio: `${W} / ${H}`, borderRadius: 12, touchAction: 'none', border: '1px solid rgba(255,255,255,0.08)' }} />
      {hud.over && <StdButton variant="primary" onClick={() => setRun((n) => n + 1)}>{t('sup.playAgain')}</StdButton>}
    </div>
  );
}
