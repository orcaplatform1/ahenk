// Kişilik Ağacı (mobil): formüller lib/kisilikAgaci.ts (web ile aynı dosya); çizim Skia.
// Ağaç ekran açılınca bir kez hesaplanır ve sabit bir resim (SkPicture) olarak çizilir; yaprak / dal animasyonu, büyüme ve düşen
// yaprak yoktur. Seçili boyut değişince resim bir kez yeniden kaydedilir. Tek animasyon: bütün ağaç kökü etrafında tek parça hafifçe
// salınır (Reanimated frame callback, UI thread, en fazla 30 kare/sn); ekran odakta değilken ve uygulama arka plandayken durur.
import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useAnimActive } from '@/lib/motion';
import { useDerivedValue, useFrameCallback, useSharedValue, type FrameInfo } from 'react-native-reanimated';
import { BlurStyle, Canvas, Group, PaintStyle, Picture, Skia, StrokeCap, TileMode, type SkCanvas, type SkPaint, type SkPicture } from '@shopify/react-native-skia';
import { buildTree, frameOf, layoutTree, newAnimState, RENK, INTRO_MS, type AgacDegerleri, type Cizgi, type Elips, type Kare } from '@/lib/kisilikAgaci';
import { useTranslation } from 'react-i18next';

// Salınım: en fazla 30 kare/sn (33,3 ms'den sık güncellenmez)
const FRAME_MS = 1000 / 30;

// Tam büyümüş ağacın sabit karesi: saat büyüme süresinin ötesinde, ilk karede düşen yaprak yok
function staticFrame(tree: ReturnType<typeof buildTree>, layout: ReturnType<typeof layoutTree>, selected: number): Kare {
  const s = newAnimState();
  s.clock = INTRO_MS / 1000 + 1;
  return frameOf(tree, layout, s, selected);
}

function drawPicture(f: Kare, width: number, height: number): SkPicture {
  const rec = Skia.PictureRecorder();
  const cv: SkCanvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
  const paint: SkPaint = Skia.Paint();
  paint.setAntiAlias(true);
  const glowPaint: SkPaint = Skia.Paint();
  glowPaint.setAntiAlias(true);
  const glowColor = Skia.Color(RENK.glow);
  // Canvas shadowBlur karşılığı: bulanıklık b px → sigma b / 2
  const glowOf = (blur: number) => Skia.MaskFilter.MakeBlur(BlurStyle.Normal, blur / 2, true);

  const line = (c: Cizgi) => {
    if (c.glow > 0) {
      glowPaint.setStyle(PaintStyle.Stroke); glowPaint.setStrokeCap(StrokeCap.Round); glowPaint.setStrokeWidth(c.w);
      glowPaint.setColor(glowColor); glowPaint.setAlphaf(c.alpha); glowPaint.setMaskFilter(glowOf(c.glow));
      cv.drawLine(c.x1, c.y1, c.x2, c.y2, glowPaint);
    }
    paint.setStyle(PaintStyle.Stroke); paint.setStrokeCap(StrokeCap.Round); paint.setStrokeWidth(c.w);
    paint.setColor(Skia.Color(c.color)); paint.setAlphaf(c.alpha);
    cv.drawLine(c.x1, c.y1, c.x2, c.y2, paint);
  };
  const ell = (e: Elips) => {
    if (e.ry <= 0) return;
    cv.save();
    cv.translate(e.x, e.y);
    cv.rotate((e.rot * 180) / Math.PI, 0, 0);
    const r = Skia.XYWHRect(-e.rx, -e.ry, e.rx * 2, e.ry * 2);
    if (e.glow > 0) {
      glowPaint.setStyle(PaintStyle.Fill); glowPaint.setColor(glowColor); glowPaint.setAlphaf(e.alpha); glowPaint.setMaskFilter(glowOf(e.glow));
      cv.drawOval(r, glowPaint);
    }
    paint.setStyle(PaintStyle.Fill); paint.setColor(Skia.Color(e.color)); paint.setAlphaf(e.alpha);
    cv.drawOval(r, paint);
    cv.restore();
  };

  // Zemin parıltısı: kökte yatay elips, radyal gradyan (merkezde #22a896 alpha, kenarda 0)
  const g = f.ground;
  cv.save();
  cv.translate(g.x, g.y);
  cv.scale(1, g.ry / g.rx);
  const gp = Skia.Paint();
  gp.setShader(Skia.Shader.MakeRadialGradient({ x: 0, y: 0 }, g.rx, [Skia.Color(RENK.ground), Skia.Color('rgba(34,168,150,0)')], [0, 1], TileMode.Clamp));
  gp.setAlphaf(g.alpha);
  cv.drawCircle(0, 0, g.rx, gp);
  cv.restore();

  for (let i = 0; i < f.mirror.length; i++) line(f.mirror[i]);
  if (f.axis) {
    const ap = Skia.Paint();
    ap.setAntiAlias(true); ap.setStyle(PaintStyle.Stroke); ap.setStrokeWidth(1);
    ap.setColor(glowColor); ap.setAlphaf(f.axis.alpha); ap.setPathEffect(Skia.PathEffect.MakeDash([3, 4], 0));
    cv.drawLine(f.axis.x, f.axis.y1, f.axis.x, f.axis.y2, ap);
  }
  for (let i = 0; i < f.segs.length; i++) line(f.segs[i]);
  for (let i = 0; i < f.leaves.length; i++) ell(f.leaves[i]);
  if (f.ring) {
    const rp = Skia.Paint();
    rp.setAntiAlias(true); rp.setStyle(PaintStyle.Stroke); rp.setStrokeWidth(1.6);
    rp.setColor(glowColor); rp.setAlphaf(f.ring.alpha);
    // Canvas lineDashOffset ile aynı yön: Skia faz değeri ters işaretli
    rp.setPathEffect(Skia.PathEffect.MakeDash([5, 5], -f.ring.dashOffset));
    const rr = Skia.XYWHRect(f.ring.x - f.ring.rx, f.ring.y - f.ring.ry, f.ring.rx * 2, f.ring.ry * 2);
    const rg = rp.copy();
    rg.setMaskFilter(glowOf(f.ring.glow));
    cv.drawOval(rr, rg);
    cv.drawOval(rr, rp);
  }
  return rec.finishRecordingAsPicture();
}

export function KisilikAgaci({ values, seed, selected, width, height }: { values: AgacDegerleri; seed: string; selected: number; width: number; height: number }) {
  const { t } = useTranslation();
  const { O, C, E, A, D } = values;
  // Ağaç yapısı ve yerleşimi yalnız değerler / tohum / boyut değişince yeniden hesaplanır
  const tree = useMemo(() => buildTree({ O, C, E, A, D }, seed), [O, C, E, A, D, seed]);
  const layout = useMemo(() => layoutTree(tree, width, height), [tree, width, height]);
  const picture = useMemo(() => drawPicture(staticFrame(tree, layout, selected), width, height), [tree, layout, selected, width, height]);

  // Tek parça salınım: kök (ox, oy) etrafında açı = sin(t × 0,37) × salınım genliği × 0,4 (ağacın genel salınımıyla aynı formül)
  const clock = useSharedValue(0);
  const acc = useSharedValue(0);
  const angle = useSharedValue(0);
  const amp = tree.swayAmp * 0.4;
  const frame = useFrameCallback((info: FrameInfo) => {
    'worklet';
    const dt = info.timeSincePreviousFrame ?? 0;
    clock.value += Math.min(dt, 100) / 1000;
    acc.value += dt;
    if (acc.value < FRAME_MS) return;
    acc.value = 0;
    angle.value = Math.sin(clock.value * 0.37) * amp;
  }, false);
  const ox = layout.ox, oy = layout.oy;
  const transform = useDerivedValue(() => [{ translateX: ox }, { translateY: oy }, { rotate: angle.value }, { translateX: -ox }, { translateY: -oy }]);

  // Ekran odaktayken ve uygulama ön plandayken çalışır; aksi hâlde frame callback tamamen durur
  const active = useAnimActive();
  useEffect(() => { frame.setActive(active); return () => frame.setActive(false); }, [active, frame]);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={t('prof.tree')} style={{ width, height, alignSelf: 'center' }}>
      <Canvas style={{ width, height }}>
        <Group transform={transform}>
          <Picture picture={picture} />
        </Group>
      </Canvas>
    </View>
  );
}
