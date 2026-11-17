// packages/ui ConfirmedRadarView karşılığı
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useReduceMotion } from '@/lib/motion';
import { formatMasaDate, isTableLocked, pad, tableTitleOf, type MasaTuru, type Participant } from '@/lib/masa';
import { AhenkSonar } from './Sonar';
import { DetayAvatar } from './DetayAvatar';
import { InlineLH, Serif, T } from './ui';
import { c, ll } from '@/theme/theme';

import { upper } from '@/lib/i18n';
const RADAR = 340; const C = RADAR / 2; const ORBIT_R = 142; const AV_D = 52;
function orbitPts(n: number, r = ORBIT_R) {
  const step = (2 * Math.PI) / n;
  return Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + i * step; return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) }; });
}
const revealAt = (s: string) => { const tr = new Date(new Date(s).getTime() + 3 * 3600 * 1000); return Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate(), 10 - 3, 0, 0, 0); };

// Eşleşme Paneli sayacındaki .ll-blink karşılığı: opaklık 1 → 0,45 → 1, 1,4 sn; Hareketi Azalt açıkken durağan
function Blink({ children }: { children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    const e = Easing.bezier(0.42, 0, 0.58, 1);
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 0.45, duration: 700, easing: e, useNativeDriver: true }), Animated.timing(v, { toValue: 1, duration: 700, easing: e, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  return <Animated.View style={{ opacity: v }}>{children}</Animated.View>;
}

function RevealCountdown({ scheduledAt }: { scheduledAt: string }) {
  const target = revealAt(scheduledAt);
  const [ms, setMs] = useState(() => Math.max(0, target - Date.now()));
  useEffect(() => { const id = setInterval(() => setMs(Math.max(0, target - Date.now())), 1000); return () => clearInterval(id); }, [target]);
  const t = Math.floor(ms / 1000);
  const units = [{ v: pad(Math.floor(t / 86400)), l: 'GÜN' }, { v: pad(Math.floor((t % 86400) / 3600)), l: 'SA' }, { v: pad(Math.floor((t % 3600) / 60)), l: 'DK' }, { v: pad(t % 60), l: 'SN' }];
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 6, marginBottom: 10 }}>
      {units.map(u => (
        <View key={u.l} style={{ alignItems: 'center', minWidth: 30 }}>
          {u.l === 'SN' ? <Blink><Serif style={{ fontSize: 40, lineHeight: 40, color: ll.red3 }}>{u.v}</Serif></Blink> : <Serif style={{ fontSize: 40, lineHeight: 40, color: ll.text }}>{u.v}</Serif>}
          <T style={{ fontSize: 10, color: ll.label, marginTop: 6 }}>{u.l}</T>
        </View>
      ))}
    </View>
  );
}

function ConfirmedRadarViewInner({ participants, maxParticipants, type, scheduledAt, infoText, width }: {
  participants: Participant[]; maxParticipants?: number; type?: MasaTuru; scheduledAt: string; infoText: string; width: number;
}) {
  const isOneOnOne = type === 'ONE_ON_ONE';
  const maxP = maxParticipants ?? (isOneOnOne ? 2 : 6);
  const scale = Math.min(1, width / RADAR);
  const seated = participants.filter(p => !p.cancelled);
  const m = seated.filter(p => p.gender === 'MALE'), f = seated.filter(p => p.gender === 'FEMALE'), o = seated.filter(p => p.gender !== 'MALE' && p.gender !== 'FEMALE');
  const ordered: Participant[] = [];
  for (let i = 0; i < Math.max(m.length, f.length); i++) { if (i < m.length) ordered.push(m[i]); if (i < f.length) ordered.push(f[i]); }
  ordered.push(...o);
  const locked = isTableLocked(scheduledAt);
  const full = ordered.length >= maxP;
  const settled = full || locked;
  const positions = orbitPts(maxP, settled ? ORBIT_R * 0.62 : ORBIT_R);
  const empty = settled ? [] : orbitPts(maxP).slice(ordered.length);
  const statusText = locked ? 'Masa Kuruldu' : 'Masa Oluşturuluyor';
  return (
    <View>
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <Serif style={{ fontSize: 22, letterSpacing: 2.2, marginBottom: 8 }}>{tableTitleOf(type)}</Serif>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.green }} />
          <T w={600} style={{ fontSize: 11, letterSpacing: 1.32, color: c.green }}>{upper(statusText)}</T>
        </View>
      </View>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: RADAR * scale, height: RADAR * scale }}>
          <View style={{ width: RADAR, height: RADAR, transform: [{ scale }], transformOrigin: 'top left' }}>
            <AhenkSonar width={RADAR} sweep={!settled} />
            {empty.map((p, i) => (
              <View key={`e${i}`} style={{ position: 'absolute', left: p.x - AV_D / 2, top: p.y - AV_D / 2, width: AV_D, height: AV_D, borderRadius: AV_D / 2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.03)' }} />
            ))}
            {ordered.map((p, i) => positions[i] && (
              <View key={p.id ?? `${p.initials}-${i}`} style={{ position: 'absolute', left: positions[i].x - AV_D / 2, top: positions[i].y - AV_D / 2 }}>
                <DetayAvatar participant={{ ...p, photoUrl: null }} size={AV_D} delay={i * 0.12} />
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={{ alignItems: 'center', marginTop: 18 }}>
        <T style={{ fontSize: 14, color: c.t666 }}>Katılımcı: <T w={700} style={{ color: c.green }}>{ordered.length}</T><T style={{ color: c.t444 }}> / </T><T w={700} style={{ color: c.green }}>{maxP}</T></T>
      </View>
      <View style={{ alignItems: 'center', marginTop: 20, paddingHorizontal: 4 }}>
        <Serif style={{ marginBottom: 6, fontSize: 18, color: c.green, textAlign: 'center' }}>{locked ? 'Mekan bilgileri masa detayında gözükecektir.' : full ? 'Masan tamamlandı.' : 'Masan Oluşturuluyor!'}</Serif>
        {locked && <RevealCountdown scheduledAt={scheduledAt} />}
        <T style={{ marginBottom: 8, fontSize: 12, color: c.t888, letterSpacing: 0.12, textAlign: 'center' }}>Masa buluşma tarihi: {formatMasaDate(scheduledAt)}</T>
        <T style={{ fontSize: 12, color: c.t555, lineHeight: 18.6, textAlign: 'center' }}>{infoText}</T>
      </View>
    </View>
  );
}

// Web karşılığı yalnız satır içi stil: satır yüksekliği her boyutta 1.5×
export function ConfirmedRadarView(props: React.ComponentProps<typeof ConfirmedRadarViewInner>) { return <InlineLH><ConfirmedRadarViewInner {...props} /></InlineLH>; }

