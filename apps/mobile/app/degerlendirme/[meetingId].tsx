// apps/web/app/degerlendirme/[meetingId]/page.tsx karşılığı
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Star } from '@/components/Star';
import { api } from '@/lib/api';
import { BtnGhost, BtnPrimary, Card, ModalBox, Mono, Serif, T, Title, PageGlow, Glow, ScreenGlow } from '@/components/ui';
import { c, inputGlass, sans, tw, ll } from '@/theme/theme';
import { useTranslation } from 'react-i18next';
import { formatNamed } from '@ahenk/shared';
import { currentLang } from '@/lib/i18n';

interface Participant { userId: string; initials: string; gender: string | null; isRequester: boolean }
interface MeetingInfo { locationName: string | null; scheduledAt: string; reviewOpensAt: string; reviewClosesAt: string; reviewed: boolean; myNoShowIds?: string[] }
const genderColor = (g: string | null) => (g === 'FEMALE' ? '#f48fb1' : g === 'MALE' ? '#4fc3f7' : '#888');
const MIN = 20, MAX = 300;
// Kartlar Eşleşme Paneli Canlı Akış kartıyla aynı: Card (.ll-card), başlık Title (serif), açıklama Note (mono, label), metin ll.text
const note = { fontSize: 11, color: ll.label } as const;

export default function Degerlendirme() {
  const { t } = useTranslation();
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
  const scrollRef = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    Promise.all([api.get<Participant[]>(`/meetings/${meetingId}/participants-preview`), api.get<MeetingInfo>(`/meetings/${meetingId}/info`).catch(() => null)])
      .then(([ps, inf]) => { setParticipants(ps.filter(p => !p.isRequester)); setInfo(inf); const l = new Set(inf?.myNoShowIds ?? []); setLocked(l); setNoShow(new Set(l)); })
      .catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [meetingId]);

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => setter(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const blocks = [...blocked];
  const len = comment.trim().length;
  function submit() {
    if (rating === 0) { setError(t('review.pickStar')); return; }
    if (len < MIN) { setError(t('review.minComment', { min: MIN })); return; }
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
  const fmtDT = (d: string) => formatNamed(d, currentLang(), { day: 'numeric', month: 'long', weekday: 'long', hour: '2-digit', minute: '2-digit' });
  const fmtD = (d: string) => formatNamed(d, currentLang(), { day: 'numeric', month: 'long', weekday: 'long' });

  // Klavye açılınca içerik yukarı kayar (Android kenardan kenara düzende pencere küçülmez, iki platformda padding)
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tw.bg }} behavior="padding">
      <ScreenGlow />
      <Modal visible={success} animationType="fade">
        <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}><Glow />
          <LinearGradient colors={['#c0392b', '#ff6b6b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
            <Svg width={40} height={40} viewBox="0 0 40 40" fill="none"><Path d="M8 20 L17 29 L32 13" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>
          </LinearGradient>
          <Serif style={{ fontSize: 36 }}>{t('review.thanks')}</Serif>
        </View>
      </Modal>
      {/* web: top -8%, ortada, 70vw, rgba(192,57,43,.09) → şeffaf %60 */}
      <PageGlow top={-0.08} left={0.5} w={0.7} h={0.7} color="rgb(192,57,43)" opacity={0.09} stop={0.6} />
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ maxWidth: 512, width: '100%', alignSelf: 'center', paddingHorizontal: 20, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 48 }}>
        <View style={{ marginBottom: 32 }}>
          <Serif style={{ fontSize: 30, lineHeight: 36, marginBottom: 8 }}>{info ? t('review.titleDated', { date: formatNamed(info.scheduledAt, currentLang(), { day: 'numeric', month: 'long' }) }) : t('review.title')}</Serif>
          {info && <T style={{ color: c.t555, fontSize: 14 }}>{info.locationName ? `${info.locationName} · ` : ''}{fmtD(info.scheduledAt)}</T>}
        </View>
        {loading ? (
          <View style={{ gap: 16 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 80, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)' }} />)}</View>
        ) : state !== 'open' ? (
          <Card style={{ alignItems: 'center', gap: 16 }}>
            <T style={{ color: ll.text, fontSize: 14, textAlign: 'center' }}>
              {state === 'reviewed' ? t('review.already') : state === 'notYet' && info ? t('review.opensAt', { date: fmtDT(info.reviewOpensAt) }) : t('review.closed')}
            </T>
            <BtnGhost label={t('review.backPanel')} onPress={() => router.replace('/(tabs)')} />
          </Card>
        ) : (
          <View style={{ gap: 24 }}>
            <Card>
              <Title style={{ marginBottom: 16 }}>{t('review.overall')}</Title>
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                {[1, 2, 3, 4, 5].map(s => <Pressable key={s} accessibilityLabel={t('review.stars', { n: s })} onPress={() => { setRating(s); setError(''); }} style={{ padding: 4 }}><Star filled={rating >= s} /></Pressable>)}
              </View>
            </Card>
            {participants.length > 0 && (
              <Card>
                <Title style={{ marginBottom: 8 }}>{t('review.blockInfo')}</Title>
                <Mono style={[note, { color: tw.accent, marginBottom: 20 }]}>{t('review.blockIrreversible')}</Mono>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
                  {participants.map(p => {
                    const b = blocked.has(p.userId), col = genderColor(p.gender);
                    return (
                      <Pressable key={p.userId} onPress={() => toggle(setBlocked, p.userId)} accessibilityState={{ selected: b }} accessibilityLabel={`${p.initials} ${b ? t('review.unblock') : t('review.block')}`} style={{ alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 2.5, borderColor: b ? '#777' : col, backgroundColor: `${col}1f`, alignItems: 'center', justifyContent: 'center', opacity: b ? 0.28 : 1, shadowColor: col, shadowOpacity: b ? 0 : 0.33, shadowRadius: 5 }}>
                          <T w={700} style={{ fontSize: 13, color: ll.text, letterSpacing: 0.26 }}>{p.initials}</T>
                        </View>
                        {b && <T style={{ fontSize: 10, color: tw.accent }}>{t('review.blocked')}</T>}
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            )}
            {participants.length > 0 && (
              <Card>
                <Title style={{ marginBottom: 8 }}>{t('review.noShowQ')}</Title>
                <Mono style={[note, { marginBottom: 16 }]}>{t('review.noShowInfo')}</Mono>
                <View style={{ gap: 8 }}>
                  {participants.map(p => {
                    const on = noShow.has(p.userId), lk = locked.has(p.userId);
                    return (
                      <Pressable key={p.userId} disabled={lk} onPress={() => toggle(setNoShow, p.userId)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, backgroundColor: on ? 'rgba(192,57,43,0.08)' : 'rgba(255,255,255,0.07)', borderColor: on ? 'rgba(192,57,43,0.3)' : 'rgba(255,255,255,0.12)' }}>
                        <View style={{ width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: on ? c.red : 'rgba(255,255,255,0.4)', backgroundColor: on ? c.red : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{on && <T w={700} style={{ fontSize: 10, color: '#fff' }}>✓</T>}</View>
                        <T w={500} style={{ fontSize: 14, color: ll.text }}>{p.initials}</T>
                        {lk && <T style={{ marginLeft: 'auto', fontSize: 12, color: c.red }}>{t('review.reported')}</T>}
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            )}
            <Card>
              <Title style={{ marginBottom: 12 }}>{t('review.expectQ')}</Title>
              <TextInput value={comment} onChangeText={v => { setComment(v.slice(0, MAX)); setError(''); }} placeholder={t('review.expectPh')} placeholderTextColor={inputGlass.placeholder}
                multiline numberOfLines={4} maxLength={MAX} keyboardAppearance="dark"
                onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
                style={{ minHeight: 100, backgroundColor: inputGlass.bg, borderWidth: 1, borderColor: inputGlass.border, borderRadius: inputGlass.radius, color: tw.text, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, fontFamily: sans(400), textAlignVertical: 'top' }} />
              <T style={{ textAlign: 'right', fontSize: 12, marginTop: 4, color: len > 0 && len < MIN ? tw.accent : ll.time }}>{len < MIN ? t('review.minChars', { min: MIN }) : ''}{comment.length}/{MAX}</T>
            </Card>
            {!!error && <T style={{ color: tw.accent, fontSize: 14 }}>{error}</T>}
            <View>
              <T style={{ fontSize: 12, color: c.t555, textAlign: 'center', marginBottom: 12 }}>{t('review.once')}</T>
              <BtnPrimary label={submitting ? t('review.sending') : t('review.send')} full disabled={submitting || rating === 0 || len < MIN} style={(submitting || rating === 0 || len < MIN) ? { opacity: 0.5 } : undefined} onPress={submit} />
            </View>
          </View>
        )}
      </ScrollView>
      <ModalBox visible={confirm} onClose={() => setConfirm(false)} title={t('review.confirmTitle')}>
        <T style={{ fontSize: 14, color: c.tCcc, lineHeight: 22.75, marginBottom: 8 }}><T w={700} style={{ color: tw.accent }}>{participants.filter(p => blocks.includes(p.userId)).map(p => p.initials).join(', ')}</T> {t('review.willBlockSuffix')}</T>
        <T style={{ fontSize: 14, color: c.t888, lineHeight: 22.75, marginBottom: 24 }}>{t('review.confirmBody')}</T>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <BtnGhost label={t('review.cancel')} style={{ flex: 1 }} onPress={() => setConfirm(false)} />
          <BtnPrimary label={t('review.confirm')} style={{ flex: 1 }} onPress={send} />
        </View>
      </ModalBox>
    </KeyboardAvoidingView>
  );
}
