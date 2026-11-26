// Canlı Destek "Beklerken oyna" (mobil): web components/support/Breakout.tsx ile aynı kurallar. Tek seviye, 5 sıra tuğla, 3 can;
// ses / efekt yok, yalnız top, raket ve tuğla (Ahenk renkleri). Mantık UI thread'de (Reanimated frame callback) sabit adımlı,
// en fazla 60 kare/sn; çizim Skia. Ekran odakta değilken / uygulama arka plandayken durur. Raket parmakla sürüklenir.
// Skor yalnız ekranda: hiçbir veri sunucuya, yerel depolamaya ya da loga yazılmaz.
import { useEffect, useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { runOnJS, useDerivedValue, useFrameCallback, useSharedValue, type FrameInfo, type SharedValue } from 'react-native-reanimated';
import { Canvas, Circle, Group, Rect } from '@shopify/react-native-skia';
import { useAnimActive } from '@/lib/motion';
import { StdButton, T } from './ui';
import { c, ll } from '@/theme/theme';

const W = 320; const H = 400;
const ROWS = 5; const COLS = 7; const GAP = 6; const TOP = 40; const BH = 14;
const BW = (W - GAP * (COLS + 1)) / COLS;
const PW = 64; const PH = 10; const PY = H - 28; const R = 6;
const SPEED = 240;
const STEP_MS = 1000 / 60;
const ROW_COLORS = [c.red, ll.red, ll.red2, ll.red3, ll.copper];
const ALL = Array.from({ length: ROWS * COLS }, () => 1);

function Brick({ i, bricks }: { i: number; bricks: SharedValue<number[]> }) {
  const opacity = useDerivedValue(() => bricks.value[i]);
  return <Rect x={GAP + (i % COLS) * (BW + GAP)} y={TOP + Math.floor(i / COLS) * (BH + GAP)} width={BW} height={BH} color={ROW_COLORS[Math.floor(i / COLS)]} opacity={opacity} />;
}

export function Breakout() {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const [hud, setHud] = useState({ score: 0, lives: 3, over: false });
  const [run, setRun] = useState(0);
  const scale = width ? Math.min(width, 360) / W : 1;

  const px = useSharedValue(W / 2);
  const bx = useSharedValue(W / 2); const by = useSharedValue(PY - 20);
  const vx = useSharedValue(SPEED * 0.6); const vy = useSharedValue(-SPEED * 0.8);
  const bricks = useSharedValue<number[]>(ALL);
  const score = useSharedValue(0); const lives = useSharedValue(3); const over = useSharedValue(false);
  const acc = useSharedValue(0);

  const report = (s: number, l: number, o: boolean) => setHud({ score: s, lives: l, over: o });

  const frame = useFrameCallback((info: FrameInfo) => {
    'worklet';
    if (over.value) return;
    acc.value += Math.min(info.timeSincePreviousFrame ?? 0, 100);
    if (acc.value < STEP_MS) return;
    while (acc.value >= STEP_MS) {
      acc.value -= STEP_MS;
      const dt = STEP_MS / 1000;
      let x = bx.value + vx.value * dt; let y = by.value + vy.value * dt;
      if (x < R) { x = R; vx.value = Math.abs(vx.value); }
      if (x > W - R) { x = W - R; vx.value = -Math.abs(vx.value); }
      if (y < R) { y = R; vy.value = Math.abs(vy.value); }
      if (vy.value > 0 && y + R >= PY && y + R <= PY + PH + 8 && Math.abs(x - px.value) <= PW / 2 + R) {
        const k = Math.max(-0.9, Math.min(0.9, (x - px.value) / (PW / 2)));
        vx.value = SPEED * k; vy.value = -Math.sqrt(SPEED * SPEED - vx.value * vx.value); y = PY - R;
      }
      const b = bricks.value;
      for (let i = 0; i < b.length; i++) {
        if (!b[i]) continue;
        const bx0 = GAP + (i % COLS) * (BW + GAP); const by0 = TOP + Math.floor(i / COLS) * (BH + GAP);
        if (x + R > bx0 && x - R < bx0 + BW && y + R > by0 && y - R < by0 + BH) {
          const next = b.slice(); next[i] = 0; bricks.value = next;
          score.value += 10;
          if (x < bx0 || x > bx0 + BW) vx.value = -vx.value; else vy.value = -vy.value;
          if (next.every((v) => v === 0)) over.value = true;
          runOnJS(report)(score.value, lives.value, over.value);
          break;
        }
      }
      if (y > H + R) {
        lives.value -= 1;
        if (lives.value <= 0) over.value = true;
        else { x = px.value; y = PY - 20; vx.value = SPEED * 0.6; vy.value = -SPEED * 0.8; }
        runOnJS(report)(score.value, Math.max(0, lives.value), over.value);
      }
      bx.value = x; by.value = y;
      if (over.value) break;
    }
  }, false);

  // Yeni oyun ("Tekrar oyna")
  useEffect(() => {
    px.value = W / 2; bx.value = W / 2; by.value = PY - 20; vx.value = SPEED * 0.6; vy.value = -SPEED * 0.8;
    bricks.value = ALL; score.value = 0; lives.value = 3; over.value = false; acc.value = 0;
    setHud({ score: 0, lives: 3, over: false });
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = useAnimActive();
  useEffect(() => { frame.setActive(active && !hud.over && width > 0); return () => frame.setActive(false); }, [active, hud.over, width, frame]);

  const paddleX = useDerivedValue(() => px.value - PW / 2);
  const ballOpacity = useDerivedValue(() => (over.value ? 0 : 1));
  const move = (e: GestureResponderEvent) => { px.value = Math.max(PW / 2, Math.min(W - PW / 2, e.nativeEvent.locationX / scale)); };

  return (
    <View style={{ alignItems: 'center', gap: 8 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: W * scale }}>
        <T style={{ fontSize: 12, color: ll.label }}>{t('sup.score', { n: hud.score })}</T>
        <T style={{ fontSize: 12, color: ll.label }}>{t('sup.lives', { n: hud.lives })}</T>
      </View>
      {width > 0 && (
        <View onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={move} onResponderMove={move}
          style={{ width: W * scale, height: H * scale, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
          <Canvas style={{ width: W * scale, height: H * scale }} pointerEvents="none">
            <Group transform={[{ scale }]}>
              <Rect x={0} y={0} width={W} height={H} color="#0f0f0f" />
              {ALL.map((_, i) => <Brick key={i} i={i} bricks={bricks} />)}
              <Rect x={paddleX} y={PY} width={PW} height={PH} color={ll.text} />
              <Circle cx={bx} cy={by} r={R} color="#ff6b6b" opacity={ballOpacity} />
            </Group>
          </Canvas>
        </View>
      )}
      {hud.over && <StdButton variant="primary" label={t('sup.playAgain')} onPress={() => setRun((n) => n + 1)} />}
    </View>
  );
}
