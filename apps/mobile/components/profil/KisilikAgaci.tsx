// Kişilik Ağacı (mobil): formüller lib/kisilikAgaci.ts (web ile aynı dosya); çizim Skia, animasyon Reanimated frame callback ile UI thread'de.
// Ekran odakta değilken frame callback durur. Ağaca dokununca baştan büyür; değerler / tohum değişince yeni ağaç baştan büyür.
import React, { useCallback, useEffect, useMemo } from 'react';
import { Pressable } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useFrameCallback, useSharedValue, type FrameInfo } from 'react-native-reanimated';
import { BlurStyle, Canvas, PaintStyle, Picture, Skia, StrokeCap, TileMode, type SkCanvas, type SkPaint, type SkPicture } from '@shopify/react-native-skia';
import { buildTree, frameOf, layoutTree, newAnimState, restart, tick, RENK, type AgacDegerleri, type Cizgi, type Elips } from '@/lib/kisilikAgaci';

function emptyPicture(W: number, H: number): SkPicture {
  const rec = Skia.PictureRecorder();
  rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
  return rec.finishRecordingAsPicture();
}

export function KisilikAgaci({ values, seed, selected, width, height }: { values: AgacDegerleri; seed: string; selected: number; width: number; height: number }) {
  const { O, C, E, A, D } = values;
  // Ağaç yapısı yalnız değerler veya tohum değişince yeniden üretilir
  const tree = useMemo(() => buildTree({ O, C, E, A, D }, seed), [O, C, E, A, D, seed]);
  const layout = useMemo(() => layoutTree(tree, width, height), [tree, width, height]);
  const state = useSharedValue(newAnimState());
  const sel = useSharedValue(selected);
  const restartReq = useSharedValue(1);
  const initialPicture = useMemo(() => emptyPicture(width, height), [width, height]);
  const picture = useSharedValue<SkPicture>(initialPicture);

  useEffect(() => { sel.value = selected; }, [selected, sel]);
  useEffect(() => { restartReq.value = restartReq.value + 1; }, [tree, restartReq]);

  // Callback yalnız ağaç / yerleşim / boyut değişince yeniden kaydedilir (ağaç verisi UI thread'e bir kez kopyalanır)
  const onFrame = useCallback((info: FrameInfo) => {
    'worklet';
    const s = state.value;
    tick(s, (info.timeSincePreviousFrame ?? 0) / 1000);
    if (restartReq.value !== 0) { restartReq.value = 0; restart(s); }
    const f = frameOf(tree, layout, s, sel.value);
    state.value = s;

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
    for (let i = 0; i < f.falling.length; i++) ell(f.falling[i]);
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
    if (f.rootDot) {
      const dp = Skia.Paint();
      dp.setAntiAlias(true); dp.setColor(Skia.Color(RENK.coral)); dp.setAlphaf(f.rootDot.alpha);
      const dg = dp.copy();
      dg.setMaskFilter(glowOf(18));
      cv.drawCircle(f.rootDot.x, f.rootDot.y, f.rootDot.r, dg);
      cv.drawCircle(f.rootDot.x, f.rootDot.y, f.rootDot.r, dp);
    }
    picture.value = rec.finishRecordingAsPicture();
  }, [tree, layout, width, height, state, sel, restartReq, picture]);
  const frame = useFrameCallback(onFrame, false);

  // Ekran odaktayken çalışır, değilken durur
  const focused = useIsFocused();
  useEffect(() => { frame.setActive(focused); return () => frame.setActive(false); }, [focused, frame]);

  return (
    <Pressable onPress={() => { restartReq.value = restartReq.value + 1; }} accessibilityRole="button" accessibilityLabel="Kişilik Ağacım" accessibilityHint="Ağacı baştan büyütür" style={{ width, height, alignSelf: 'center' }}>
      <Canvas style={{ width, height }}>
        <Picture picture={picture} />
      </Canvas>
    </Pressable>
  );
}
