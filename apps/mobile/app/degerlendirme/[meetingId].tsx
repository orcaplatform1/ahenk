// apps/web/app/degerlendirme/[meetingId]/page.tsx karşılığı
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SG, Path, Stop } from 'react-native-svg';
import { api } from '@/lib/api';
import { BtnGhost, BtnPrimary, ModalBox, Serif, T, PageGlow } from '@/components/ui';
import { c, glassCard, inputGlass, sans, tw } from '@/theme/theme';

interface Participant { userId: string; initials: string; gender: string | null; isRequester: boolean }
interface MeetingInfo { locationName: string | null; scheduledAt: string; reviewOpensAt: string; reviewClosesAt: string; reviewed: boolean; myNoShowIds?: string[] }
const genderColor = (g: string | null) => (g === 'FEMALE' ? '#f48fb1' : g === 'MALE' ? '#4fc3f7' : '#888');
const MIN = 20, MAX = 300;
const glass = { backgroundColor: glassCard.bg, borderWidth: 1, borderColor: glassCard.border, borderRadius: glassCard.radius, padding: 20 } as const;

function Star({ filled }: { filled: boolean }) {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24">
      <Defs><SG id="st" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#c0392b" /><Stop offset="1" stopColor="#ff6b6b" /></SG></Defs>
      <Path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.45 6.2 20.5l1.1-6.47L2.6 9.45l6.5-.95L12 2.6z" fill={filled ? 'url(#st)' : 'rgba(255,255,255,0.04)'} stroke={filled ? 'none' : 'rgba(255,255,255,0.18)'} strokeWidth={1.2} strokeLinejoin="round" />
    </Svg>
  );
}

export default function Degerlendirme() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [info, setInfo] = useState<MeetingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [noShow, setNoShow] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([api.get<Participant[]>(`/meetings/${meetingId}/participants-preview`), api.get<MeetingInfo>(`/meetings/${meetingId}/info`).catch(() => null)])
      .then(([ps, inf]) => { setParticipants(ps.filter(p => !p.isRequester)); setInfo(inf); const l = new Set(inf?.myNoShowIds ?? []); setLocked(l); setNoShow(new Set(l)); })
      .catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [meetingId]);

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => setter(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const blocks = [...blocked];
  const len = comment.trim().length;
  function submit() {
    if (rating === 0) { setError('Lütfen yıldız seçin.'); return; }
    if (len < MIN) { setError(`Beklenti yorumu en az ${MIN} karakter olmalı.`); return; }
    setError('');
    if (blocks.length > 0) { setConfirm(true); return; }
    send();
  }
  async function send() {
    setConfirm(false); setSubmitting(true); setError('');
    try { await api.post(`/meetings/${meetingId}/review`, { rating, blockedUserIds: blocks, noShowUserIds: [...noShow], comment: comment.trim() }); setSuccess(true); setTimeout(() => router.replace('/(tabs)'), 2000); }
    catch (e) { setError((e as Error).message); } finally { setSubmitting(false); }
  }
  const now = Date.now();
  const state = !info ? 'open' : info.reviewed ? 'reviewed' : now < new Date(info.reviewOpensAt).getTime() ? 'notYet' : now > new Date(info.reviewClosesAt).getTime() ? 'closed' : 'open';
  const fmtDT = (d: string) => new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', weekday: 'long', hour: '2-digit', minute: '2-digit' });
  const fmtD = (d: string) => new Date(d).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', weekday: 'long' });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tw.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Modal visible={success} animationType="fade">
        <View style={{ flex: 1, backgroundColor: tw.bg, alignItems: 'center', justifyContent: 'center' }}>
          <LinearGradient colors={['#c0392b', '#ff6b6b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
            <Svg width={40} height={40} viewBox="0 0 40 40" fill="none"><Path d="M8 20 L17 29 L32 13" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>
          </LinearGradient>
          <Serif style={{ fontSize: 36 }}>Teşekkürler!</Serif>
        </View>
      </Modal>
      {/* web: top -8%, ortada, 70vw, rgba(192,57,43,.09) → şeffaf %60 */}
      <PageGlow top={-0.08} left={0.5} w={0.7} h={0.7} color="rgb(192,57,43)" opacity={0.09} stop={0.6} />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ maxWidth: 512, width: '100%', alignSelf: 'center', paddingHorizontal: 20, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 48 }}>
        <View style={{ marginBottom: 32 }}>
          <Serif style={{ fontSize: 30, lineHeight: 36, marginBottom: 8 }}>{info ? `${new Date(info.scheduledAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long' })} Tarihli Masada Ahenk Nasıldı?` : 'Masada Ahenk Nasıldı?'}</Serif>
          {info && <T style={{ color: c.t555, fontSize: 14 }}>{info.locationName ? `${info.locationName} · ` : ''}{fmtD(info.scheduledAt)}</T>}
        </View>
        {loading ? (
          <View style={{ gap: 16 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 80, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)' }} />)}</View>
        ) : state !== 'open' ? (
          <View style={[glass, { padding: 24, alignItems: 'center', gap: 16 }]}>
            <T style={{ color: c.tCcc, fontSize: 14, textAlign: 'center' }}>
              {state === 'reviewed' ? 'Bu masayı zaten değerlendirdin. Teşekkürler!' : state === 'notYet' && info ? `Değerlendirme ${fmtDT(info.reviewOpensAt)} itibarıyla açılacak.` : 'Bu masanın değerlendirme süresi doldu.'}
            </T>
            <BtnGhost label="Panele Dön" onPress={() => router.replace('/(tabs)')} />
          </View>
        ) : (
          <View style={{ gap: 24 }}>
            <View style={glass}>
              <T w={500} style={{ fontSize: 14, color: c.t888, marginBottom: 16 }}>Genel deneyim</T>
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                {[1, 2, 3, 4, 5].map(s => <Pressable key={s} accessibilityLabel={`${s} yıldız`} onPress={() => { setRating(s); setError(''); }} style={{ padding: 4 }}><Star filled={rating >= s} /></Pressable>)}
              </View>
            </View>
            {participants.length > 0 && (
              <View style={glass}>
                <T w={500} style={{ fontSize: 14, color: c.t888, marginBottom: 4 }}>Masada rahatsız olduğun birileri varsa engelleyebilirsin, bir daha asla karşılaşmazsın.</T>
                <T style={{ fontSize: 12, color: tw.accent, marginBottom: 20 }}>Bu engelleme işlemi geri alınamaz.</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
                  {participants.map(p => {
                    const b = blocked.has(p.userId), col = genderColor(p.gender);
                    return (
                      <Pressable key={p.userId} onPress={() => toggle(setBlocked, p.userId)} accessibilityState={{ selected: b }} accessibilityLabel={`${p.initials} ${b ? 'engellemeyi kaldır' : 'engelle'}`} style={{ alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 2.5, borderColor: b ? '#777' : col, backgroundColor: `${col}1f`, alignItems: 'center', justifyContent: 'center', opacity: b ? 0.28 : 1, shadowColor: col, shadowOpacity: b ? 0 : 0.33, shadowRadius: 5 }}>
                          <T w={700} style={{ fontSize: 13, color: c.tF0, letterSpacing: 0.26 }}>{p.initials}</T>
                        </View>
                        <T style={{ fontSize: 10, height: 12, color: b ? tw.accent : 'transparent' }}>Engellendi</T>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            {participants.length > 0 && (
              <View style={glass}>
                <T w={500} style={{ fontSize: 14, color: c.t888, marginBottom: 4 }}>Masaya katılmayan biri oldu mu?</T>
                <T style={{ fontSize: 12, color: c.t555, marginBottom: 16 }}>Masaya gelmeyen kişileri işaretle. Bildirimin yönetim ekibine iletilir ve geri alınamaz.</T>
                <View style={{ gap: 8 }}>
                  {participants.map(p => {
                    const on = noShow.has(p.userId), lk = locked.has(p.userId);
                    return (
                      <Pressable key={p.userId} disabled={lk} onPress={() => toggle(setNoShow, p.userId)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, backgroundColor: on ? 'rgba(192,57,43,0.08)' : 'rgba(255,255,255,0.07)', borderColor: on ? 'rgba(192,57,43,0.3)' : 'rgba(255,255,255,0.12)' }}>
                        <View style={{ width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: on ? c.red : 'rgba(255,255,255,0.4)', backgroundColor: on ? c.red : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{on && <T w={700} style={{ fontSize: 10, color: '#fff' }}>✓</T>}</View>
                        <T w={500} style={{ fontSize: 14, color: c.tCcc }}>{p.initials}</T>
                        {!!p.gender && <T style={{ fontSize: 12, color: c.t555 }}>{p.gender === 'MALE' ? 'E' : p.gender === 'FEMALE' ? 'K' : ''}</T>}
                        {lk && <T style={{ marginLeft: 'auto', fontSize: 12, color: c.red }}>Bildirildi</T>}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            <View style={glass}>
              <T w={500} style={{ fontSize: 14, color: c.t888, marginBottom: 12 }}>Masa beklentilerini karşıladı mı?</T>
              <TextInput value={comment} onChangeText={t => { setComment(t.slice(0, MAX)); setError(''); }} placeholder="Masa, mekan ve sohbet beklentilerini ne kadar karşıladı? Düşüncelerini yaz…" placeholderTextColor={inputGlass.placeholder}
                multiline numberOfLines={4} maxLength={MAX} keyboardAppearance="dark"
                style={{ minHeight: 100, backgroundColor: inputGlass.bg, borderWidth: 1, borderColor: inputGlass.border, borderRadius: inputGlass.radius, color: tw.text, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, fontFamily: sans(400), textAlignVertical: 'top' }} />
              <T style={{ textAlign: 'right', fontSize: 12, marginTop: 4, color: len > 0 && len < MIN ? tw.accent : c.t444 }}>{len < MIN ? `En az ${MIN} karakter · ` : ''}{comment.length}/{MAX}</T>
            </View>
            {!!error && <T style={{ color: tw.accent, fontSize: 14 }}>{error}</T>}
            <View>
              <T style={{ fontSize: 12, color: c.t555, textAlign: 'center', marginBottom: 12 }}>Değerlendirme bir kez gönderilir, sonradan düzenlenemez.</T>
              <BtnPrimary label={submitting ? 'Gönderiliyor…' : 'Değerlendirmeyi Gönder'} full disabled={submitting || rating === 0 || len < MIN} style={(submitting || rating === 0 || len < MIN) ? { opacity: 0.5 } : undefined} onPress={submit} />
            </View>
          </View>
        )}
      </ScrollView>
      <ModalBox visible={confirm} onClose={() => setConfirm(false)} title="Engellemeyi onayla">
        <T style={{ fontSize: 14, color: c.tCcc, lineHeight: 22.75, marginBottom: 8 }}><T w={700} style={{ color: tw.accent }}>{participants.filter(p => blocks.includes(p.userId)).map(p => p.initials).join(', ')}</T> engellenecek.</T>
        <T style={{ fontSize: 14, color: c.t888, lineHeight: 22.75, marginBottom: 24 }}>Bu işlem geri alınamaz. Engellediğin kişilerle bir daha aynı masada eşleşmezsin.</T>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <BtnGhost label="Vazgeç" style={{ flex: 1 }} onPress={() => setConfirm(false)} />
          <BtnPrimary label="Onayla ve Gönder" style={{ flex: 1 }} onPress={send} />
        </View>
      </ModalBox>
    </KeyboardAvoidingView>
  );
}
