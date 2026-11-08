// packages/ui ConfirmedRadarView + RezervasyonIptal karşılıkları
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { api } from '@/lib/api';
import { cancelDeadline, formatMasaDate, isTableLocked, pad, tableTitleOf, type MasaTuru, type Participant } from '@/lib/masa';
import { AhenkSonar } from './Sonar';
import { DetayAvatar } from './DetayAvatar';
import { InlineLH, Btn, Serif, T } from './ui';
import { c, sans, tw } from '@/theme/theme';

const RADAR = 340; const C = RADAR / 2; const ORBIT_R = 142; const AV_D = 52;
function orbitPts(n: number, r = ORBIT_R) {
  const step = (2 * Math.PI) / n;
  return Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + i * step; return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) }; });
}
const revealAt = (s: string) => { const tr = new Date(new Date(s).getTime() + 3 * 3600 * 1000); return Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate(), 10 - 3, 0, 0, 0); };

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
          <T w={700} style={{ fontSize: 18, lineHeight: 18, fontVariant: ['tabular-nums'] }}>{u.v}</T>
          <T w={600} style={{ fontSize: 8, letterSpacing: 1.1, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{u.l}</T>
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
          <T w={600} style={{ fontSize: 11, letterSpacing: 1.32, color: c.green }}>{statusText.toLocaleUpperCase('tr-TR')}</T>
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
                <DetayAvatar participant={p} size={AV_D} delay={i * 0.12} />
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={{ alignItems: 'center', marginTop: 18 }}>
        <T style={{ fontSize: 14, color: c.t666 }}>Katılımcı: <T w={700} style={{ color: c.green }}>{ordered.length}</T><T style={{ color: c.t444 }}> / </T><T w={700} style={{ color: c.green }}>{maxP}</T></T>
      </View>
      <View style={{ alignItems: 'center', marginTop: 20, paddingHorizontal: 4 }}>
        <Serif style={{ marginBottom: 6, fontSize: 18, color: c.green, textAlign: 'center' }}>{locked ? 'Masanız kuruldu. Mekan bilgileri masa detayında gözükecektir.' : full ? 'Masanız tamamlandı.' : 'Masanız Oluşturuluyor!'}</Serif>
        {locked && <RevealCountdown scheduledAt={scheduledAt} />}
        <T style={{ marginBottom: 8, fontSize: 12, color: c.t888, letterSpacing: 0.12, textAlign: 'center' }}>Masa buluşma tarihi: {formatMasaDate(scheduledAt)}</T>
        <T style={{ fontSize: 12, color: c.t555, lineHeight: 18.6, textAlign: 'center' }}>{infoText}</T>
      </View>
    </View>
  );
}

function RezervasyonIptalInner({ meetingId, scheduledAt, cancelRightUsed, onCancelled }: { meetingId: string; scheduledAt: string; cancelRightUsed?: boolean; onCancelled?: () => void }) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  if (new Date() >= cancelDeadline(scheduledAt)) return null;
  async function handle() {
    if (!note.trim()) return;
    setLoading(true); setError('');
    try { await api.post(`/meetings/${meetingId}/cancel-registration`, { note: note.trim() }); setCancelled(true); setShow(false); onCancelled?.(); }
    catch (e) { setError((e as Error).message || 'İptal edilemedi, lütfen tekrar deneyin.'); }
    finally { setLoading(false); }
  }
  if (cancelled) return (
    <View style={{ padding: 12, paddingHorizontal: 14, borderRadius: 10, marginTop: 16, alignItems: 'center', backgroundColor: 'rgba(192,57,43,0.08)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.2)' }}>
      <T style={{ fontSize: 13, color: c.red }}>Rezervasyonunuz iptal edildi.</T>
    </View>
  );
  if (cancelRightUsed) return <T style={{ marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.62)', textAlign: 'center' }}>Bu paket için iptal hakkınızı kullandınız.</T>;
  const can = note.trim().length > 0;
  return (
    <>
      <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
        <Pressable onPress={() => { setShow(false); setError(''); }} style={{ flex: 1, backgroundColor: 'rgba(20,4,4,0.88)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Pressable onPress={() => undefined} style={{ width: '100%', maxWidth: 380, backgroundColor: 'rgba(30,8,8,0.97)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.35)', borderRadius: 16, paddingTop: 28, paddingHorizontal: 22, paddingBottom: 22 }}>
            <T w={500} style={{ marginBottom: 18, fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
              Rezervasyon iptali diğer kullanıcıları da doğrudan etkilediğinden, kurulma aşamasındaki bir masada tekrar iptal hakkın bulunmayacaktır ve sonraki kurulan masaya da katılmama durumunda 1. uyarı verilir, toplamda 3 uyarı alırsan hesabın 30 gün askıya alınır.
            </T>
            <T style={{ marginBottom: 10, fontSize: 13, color: 'rgba(245,245,245,0.6)' }}>İptal nedenini belirtin:</T>
            <TextInput value={note} onChangeText={setNote} maxLength={300} multiline numberOfLines={4} keyboardAppearance="dark"
              style={{ minHeight: 88, padding: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', color: tw.text, fontSize: 13, fontFamily: sans(400), textAlignVertical: 'top' }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn variant="resConfirm" onPress={handle} disabled={loading || !can} label={loading ? '…' : 'İptali Onayla'} />
              <Btn variant="resBack" onPress={() => { setShow(false); setError(''); }} label="Vazgeç" />
            </View>
            {!!error && <T style={{ marginTop: 12, fontSize: 13, color: tw.accent, textAlign: 'center' }}>{error}</T>}
          </Pressable>
        </Pressable>
      </Modal>
      <Btn variant="resCancel" onPress={() => setShow(true)} label="Rezervasyon İptal" />
    </>
  );
}

// Web karşılığı yalnız satır içi stil: satır yüksekliği her boyutta 1.5×
export function ConfirmedRadarView(props: React.ComponentProps<typeof ConfirmedRadarViewInner>) { return <InlineLH><ConfirmedRadarViewInner {...props} /></InlineLH>; }

// Web karşılığı yalnız satır içi stil: satır yüksekliği her boyutta 1.5×
export function RezervasyonIptal(props: React.ComponentProps<typeof RezervasyonIptalInner>) { return <InlineLH><RezervasyonIptalInner {...props} /></InlineLH>; }
