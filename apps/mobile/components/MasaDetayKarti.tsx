// packages/ui/src/components/tables/MasaDetayKarti.tsx karşılığı: mekân, fotoğraflar, HARİTADA GÖR, buluşma,
// katılımcılar, yapay zeka raporu, bilgi kutusu, Yola Çıktım, sohbet, gelmeyen işaretleme, Acil Yardım.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { api, prefetch } from '@/lib/api';
import { mediaUrl } from '@/lib/venueApi';
import { requestSosAlwaysPermission, startSosLive } from '@/lib/sosLive';
import { formatMeetingTime, gColor, type MasaTuru } from '@/lib/masa';
import { openMaps } from '@/lib/links';
import { useAppRefresh } from '@/lib/useAppRefresh';
import { DetayAvatar } from './DetayAvatar';
import { PhotoViewer, pickAndUploadProfilePhoto } from './ProfilePhoto';
import { KankaPairs, type KankaPerson } from './KankaPairs';
import { InlineLH, Btn, BtnPrimary, Card, Serif, T } from './ui';
import { LocationDisclosure } from './LocationDisclosure';
import { PERM_REASON, showSettingsAlert } from '@/lib/permissions';
import { c, masaKart, sans, tw } from '@/theme/theme';
import { useTranslation } from 'react-i18next';
import { occupationLabel } from '@ahenk/shared';

export interface DetayParticipant { initials: string; displayName?: string | null; gender: 'MALE' | 'FEMALE' | string | null; pair?: 'MINE' | 'OTHER'; isSelf?: boolean; photoUrl?: string | null; cancelled?: boolean }
export interface VenuePhoto { url: string; caption?: string }
export interface MasaDetayData {
  id: string; type?: MasaTuru; maxParticipants?: number; scheduledAt: string; sosEndsAt: string; venueName: string;
  venueAddress?: string | null; venueDistrict?: string | null; venueMapsUrl?: string | null; venuePhotos?: VenuePhoto[]; participants: DetayParticipant[]; occupations?: string[];
  aiReport?: { content: string; uyumSkoru: number; generatedAt: string } | null;
}
interface ChatMsg { id: string; content: string; createdAt: string; isOwn: boolean; senderName: string; senderGender?: string | null; seatNo?: number | null; reportedByMe: boolean }

const GREEN = c.green;
const msgTime = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });

function buildOrdered(ps: DetayParticipant[]) {
  const m = ps.filter(p => p.gender === 'MALE'), f = ps.filter(p => p.gender === 'FEMALE'), o = ps.filter(p => p.gender !== 'MALE' && p.gender !== 'FEMALE');
  const out: DetayParticipant[] = [];
  for (let i = 0; i < Math.max(m.length, f.length); i++) { if (i < m.length) out.push(m[i]); if (i < f.length) out.push(f[i]); }
  return [...out, ...o];
}


function SectionDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }} />
      <T w={700} style={{ fontSize: 10, letterSpacing: 1.4, color }}>{label}</T>
    </View>
  );
}

function ChatSection({ meetingId, type }: { meetingId: string; type?: MasaTuru }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [openAt, setOpenAt] = useState<string | null>(null);
  const [closeAt, setCloseAt] = useState<string | null>(null);
  const [sendError, setSendError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await api.get<{ isOpen: boolean; isClosed: boolean; openAt: string; closeAt?: string; messages: ChatMsg[] }>(`/chat/${meetingId}/messages`);
      setIsOpen(data.isOpen); setOpenAt(data.openAt); setCloseAt(data.closeAt ?? null);
      setIsClosed(data.isClosed || (!!data.closeAt && Date.now() >= new Date(data.closeAt).getTime()));
      setMessages(prev => { const by = new Map(prev.map(m => [m.id, m])); for (const m of data.messages ?? []) by.set(m.id, m); return [...by.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)); });
    } catch { /* ekrandaki veri korunur */ }
  }, [meetingId]);
  useEffect(() => { fetchMessages(); const id = setInterval(fetchMessages, 8000); return () => clearInterval(id); }, [fetchMessages]);
  useAppRefresh(fetchMessages);
  useEffect(() => {
    if (!closeAt || isClosed) return;
    const ms = new Date(closeAt).getTime() - Date.now();
    if (ms <= 0) { setIsClosed(true); return; }
    const t = setTimeout(() => setIsClosed(true), Math.min(ms, 2_147_000_000));
    return () => clearTimeout(t);
  }, [closeAt, isClosed]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || sending || isClosed || !isOpen) return;
    setSending(true); setSendError('');
    try { const msg = await api.post<ChatMsg>(`/chat/${meetingId}/messages`, { content: trimmed }); setMessages(p => [...p, msg]); setInput(''); }
    catch (e) { setSendError((e as Error).message || t('masa.sendFailedMsg')); }
    finally { setSending(false); }
  }
  async function report(id: string) {
    await api.post(`/chat/messages/${id}/report`).catch(() => {});
    setMessages(p => p.map(m => (m.id === id ? { ...m, reportedByMe: true } : m)));
  }
  const title = isClosed ? t('masa.chatClosed') : type === 'ONE_ON_ONE' ? t('tm.chatOne') : type === 'KANKA' ? t('tm.chatKanka') : t('masa.groupChat');

  return (
    <View>
      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 20 }} />
      <SectionDot color={isClosed ? c.t555 : GREEN} label={title} />
      <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
        <ScrollView ref={scroll} nestedScrollEnabled style={{ maxHeight: 260 }} contentContainerStyle={{ padding: 12, paddingBottom: 8, gap: 8 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          {messages.length === 0 && (
            <T style={{ fontSize: 12, textAlign: 'center' }}>
              {!isOpen && openAt ? t('masa.chatOpensAt', { time: formatMeetingTime(openAt) }) : isClosed ? t('masa.chatEnded') : t('masa.noMessages')}
            </T>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const first = !prev || prev.isOwn !== m.isOwn || prev.seatNo !== m.seatNo;
            return (
              <View key={m.id} style={{ flexDirection: 'row', justifyContent: m.isOwn ? 'flex-end' : 'flex-start', gap: 6, alignItems: 'flex-start' }}>
                <View style={{ maxWidth: '72%', alignItems: m.isOwn ? 'flex-end' : 'flex-start' }}>
                  {/* Gönderen görünen adı ("Ahmet Y.") serinin ilk mesajında */}
                  {!m.isOwn && first && <T w={600} style={{ fontSize: 11, color: gColor(m.senderGender), marginBottom: 3 }}>{m.senderName}</T>}
                  <View style={{ paddingVertical: 8, paddingHorizontal: 11, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: gColor(m.senderGender),
                    borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: m.isOwn ? 12 : 2, borderBottomRightRadius: m.isOwn ? 2 : 12 }}>
                    <T style={{ fontSize: 13, color: c.tF0, lineHeight: 18.85 }}>{m.content}</T>
                  </View>
                  <T style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{msgTime(m.createdAt)}</T>
                  {!m.isOwn && !isClosed && (
                    <Btn variant="reportLink" selected={m.reportedByMe} onPress={() => !m.reportedByMe && report(m.id)} label={m.reportedByMe ? t('masa.reported') : t('masa.reportMsg')} />
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
        {isOpen && !isClosed && (
          <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
            <TextInput value={input} onChangeText={(t) => setInput(t.slice(0, 1000))} onSubmitEditing={send} returnKeyType="send" keyboardAppearance="dark"
              style={{ flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, fontSize: 13, color: tw.text, fontFamily: sans(400) }} />
            <BtnPrimary label={t('masa.send')} onPress={send} disabled={!input.trim() || sending} style={{ paddingHorizontal: 10, gap: 5 }} textStyle={{ fontSize: 10 }} />
          </View>
        )}
        {!!sendError && isOpen && !isClosed && <T style={{ paddingHorizontal: 10, paddingBottom: 8, fontSize: 12, color: tw.accent }}>{sendError}</T>}
      </View>
    </View>
  );
}

interface NoShowMarking { open: boolean; participants: { userId: string; initials: string; gender: string | null }[]; markedIds: string[] }

function NoShowSection({ meetingId }: { meetingId: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<NoShowMarking | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => { api.get<NoShowMarking>(`/meetings/${meetingId}/no-show`).then(setData).catch(() => {}); }, [meetingId]);
  useEffect(() => { load(); }, [load]);
  useAppRefresh(load);
  if (!data?.open || data.participants.length === 0) return null;
  const marked = new Set(data.markedIds);
  async function send() {
    if (selected.size === 0 || sending) return;
    setSending(true); setError('');
    try { await api.post(`/meetings/${meetingId}/no-show`, { userIds: [...selected] }); setSelected(new Set()); load(); }
    catch (e) { setError((e as Error).message || t('masa.sendFailedRetry')); }
    finally { setSending(false); }
  }
  return (
    <View style={{ marginTop: 24, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
      <T w={600} style={{ fontSize: 13, marginBottom: 4 }}>{t('masa.noShowQ')}</T>
      <T style={{ fontSize: 11.5, color: c.t888, lineHeight: 17.25, marginBottom: 12 }}>{t('masa.noShowInfo')}</T>
      <View style={{ gap: 8 }}>
        {data.participants.map(p => {
          const locked = marked.has(p.userId);
          const checked = locked || selected.has(p.userId);
          return (
            <Pressable key={p.userId} disabled={locked} onPress={() => setSelected(prev => { const n = new Set(prev); n.has(p.userId) ? n.delete(p.userId) : n.add(p.userId); return n; })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, minHeight: 44,
                backgroundColor: checked ? 'rgba(192,57,43,0.08)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: checked ? 'rgba(192,57,43,0.3)' : 'rgba(255,255,255,0.1)' }}>
              <View style={{ width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: checked ? c.red : 'rgba(255,255,255,0.4)', backgroundColor: checked ? c.red : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {checked && <T w={700} style={{ fontSize: 10, color: '#fff' }}>✓</T>}
              </View>
              <View style={{ paddingHorizontal: 5, borderRadius: 99, borderWidth: 1, borderColor: gColor(p.gender) }}>
                <T w={600} style={{ fontSize: 10.5, lineHeight: 15.225, color: '#f4f1ec' }}>{p.initials.replace(/\.(?=[⁰¹²³⁴⁵⁶⁷⁸⁹]*$)/, '')}</T>
              </View>
              {locked && <T style={{ marginLeft: 'auto', fontSize: 11, color: c.red }}>{t('masa.notified')}</T>}
            </Pressable>
          );
        })}
      </View>
      {!!error && <T style={{ marginTop: 10, fontSize: 12, color: tw.accent }}>{error}</T>}
      {selected.size > 0 && (
        <Btn variant="noShowSend" onPress={send} disabled={sending} label={sending ? t('masa.sending') : t('masa.markNoShow')} />
      )}
    </View>
  );
}

const SOS_THREATS = [
  { value: 'LIFE_DANGER', label: 'masa.threatLife' },
  { value: 'PHYSICAL_VIOLENCE', label: 'masa.threatViolence' },
  { value: 'ABDUCTION', label: 'masa.threatAbduction' },
  { value: 'HARASSMENT', label: 'masa.threatHarassment' },
] as const;

function SosModal({ selected, onToggle, onConfirm, onClose, loading, locError, error }: {
  selected: string[]; onToggle: (t: string) => void; onConfirm: () => void; onClose: () => void; loading: boolean; locError: 'off' | 'denied' | null; error: string;
}) {
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState(false);
  const can = selected.length > 0 && accepted && !loading;
  const warn = (text: string) => (
    <View style={{ padding: 10, paddingHorizontal: 12, backgroundColor: 'rgba(255,165,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,165,0,0.3)', borderRadius: 8, marginBottom: 12 }}>
      <T style={{ fontSize: 11.5, color: c.warnOrange, lineHeight: 17.25 }}>{text}</T>
    </View>
  );
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(10,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Pressable onPress={() => undefined} style={{ width: '100%', maxWidth: 380, backgroundColor: '#0f0808', borderWidth: 1.5, borderColor: 'rgba(192,57,43,0.7)', borderRadius: 16, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 20 }}>
          <T w={800} style={{ fontSize: 16, color: tw.accent, letterSpacing: 0.32, marginBottom: 6 }}>{t('masa.sosFormTitle')}</T>
          <View style={{ height: 1, backgroundColor: 'rgba(192,57,43,0.3)', marginTop: 10, marginBottom: 16 }} />
          <T style={{ fontSize: 12, color: 'rgba(255,107,107,0.7)', lineHeight: 18, marginBottom: 12 }}>{t('masa.sosPick')}</T>
          <View style={{ gap: 8, marginBottom: 12 }}>
            {SOS_THREATS.map(th => {
              const on = selected.includes(th.value);
              return (
                <Btn key={th.value} variant="sosThreat" selected={on} onPress={() => onToggle(th.value)} accessibilityLabel={t(th.label)}>
                  <View style={{ width: 16, height: 16, borderRadius: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: on ? tw.accent : 'rgba(255,255,255,0.2)', backgroundColor: on ? 'rgba(192,57,43,0.3)' : 'transparent' }}>
                    <T style={{ fontSize: 10 }}>{on ? '✓' : ''}</T>
                  </View>
                  <T w={on ? 600 : 400} style={{ fontSize: 13, color: on ? tw.accent : c.tCcc }}>{t(th.label)}</T>
                </Btn>
              );
            })}
          </View>
          <T style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', lineHeight: 16.5, marginBottom: 16 }}>{t('masa.sosMaybe')}</T>
          <T style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', lineHeight: 16.5, marginBottom: 16 }}>{t('masa.sosShared')}</T>
          {locError === 'denied' && warn(t('masa.sosDeniedApp'))}
          {locError === 'off' && warn(t('masa.sosOff'))}
          {!!error && (
            <View style={{ padding: 10, paddingHorizontal: 12, backgroundColor: 'rgba(192,57,43,0.12)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.5)', borderRadius: 8, marginBottom: 12 }}>
              <T style={{ fontSize: 11.5, color: tw.accent, lineHeight: 17.25 }}>{t('masa.sosFailed', { error })}</T>
            </View>
          )}
          <Pressable onPress={() => setAccepted(a => !a)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
            <View style={{ marginTop: 2, width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: accepted ? c.red : 'rgba(255,255,255,0.4)', backgroundColor: accepted ? c.red : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {accepted && <T w={700} style={{ fontSize: 10, color: '#fff' }}>✓</T>}
            </View>
            <T style={{ flex: 1, fontSize: 11.5, color: 'rgba(255,255,255,0.75)', lineHeight: 17.25 }}>{t('masa.sosConsent')}</T>
          </Pressable>
          <Btn variant="sosSubmit" onPress={onConfirm} disabled={!can} label={loading ? t('masa.locating') : error ? t('masa.tryAgain') : t('masa.report')} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Lightbox({ photos, start, onClose }: { photos: VenuePhoto[]; start: number; onClose: () => void }) {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(start);
  const [w, setW] = useState(0);
  const touchX = useRef<number | null>(null);
  const swiped = useRef(false);
  const next = () => setIdx(i => Math.min(i + 1, photos.length - 1));
  const prev = () => setIdx(i => Math.max(i - 1, 0));
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        {/* Fotoğrafın sağ yarısına dokununca sonraki, sol yarısına dokununca önceki; sağa/sola kaydırma ile de geçiş (alttaki noktalar yok) */}
        <Pressable
          onLayout={e => setW(e.nativeEvent.layout.width)}
          onTouchStart={e => { touchX.current = e.nativeEvent.pageX; swiped.current = false; }}
          onTouchEnd={e => {
            if (touchX.current === null) return;
            const dx = e.nativeEvent.pageX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) < 40) return;
            swiped.current = true;
            if (dx < 0) next(); else prev();
          }}
          onPress={e => {
            if (swiped.current) { swiped.current = false; return; }
            if (e.nativeEvent.locationX >= w / 2) next(); else prev();
          }}
          style={{ width: '90%', height: '75%' }}
        >
          <Image source={{ uri: mediaUrl(photos[idx].url) }} style={{ width: '100%', height: '100%', borderRadius: 12 }} resizeMode="contain" />
        </Pressable>
        {!!photos[idx].caption && <T style={{ color: c.tAaa, fontSize: 13, marginTop: 12 }}>{photos[idx].caption}</T>}
        <Btn variant="lightboxClose" onPress={onClose} hitSlop={4} accessibilityLabel={t('masa.close')} label="×" />
      </Pressable>
    </Modal>
  );
}

// Yapay Zeka Masa Raporu: kayıtlı uyumSkoru yeşil halkada ("Genel Uyum"); rapor yoksa mevcut bilgi metni (tm.meetupNote)
function ScoreRing({ score }: { score: number }) {
  const { d: D, stroke: SW } = masaKart.ring;
  const R = (D - SW) / 2, C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, score));
  return (
    <View style={{ width: D, height: D }}>
      <Svg width={D} height={D} viewBox={`0 0 ${D} ${D}`} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={D / 2} cy={D / 2} r={R} fill="none" stroke={masaKart.ring.track} strokeWidth={SW} />
        <Circle cx={D / 2} cy={D / 2} r={R} fill="none" stroke={masaKart.ring.color} strokeWidth={SW} strokeLinecap="round" strokeDasharray={`${C}`} strokeDashoffset={C * (1 - pct / 100)} />
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <T w={700} style={{ fontSize: 15 }}>%{pct}</T>
      </View>
    </View>
  );
}

function AiReport({ report }: { report?: MasaDetayData['aiReport'] }) {
  const { t } = useTranslation();
  return (
    <View style={{ backgroundColor: c.aiBg, borderWidth: 1, borderColor: c.aiBorder, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: c.aiIconBg, borderWidth: 1, borderColor: c.aiIconBorder, alignItems: 'center', justifyContent: 'center' }}><T style={{ fontSize: 16, lineHeight: 16 }}>✦</T></View>
        <T w={700} style={{ fontSize: 10, letterSpacing: 1.6, color: c.aiTitle }}>{t('masa.aiTitle')}</T>
      </View>
      <View style={{ height: 1, backgroundColor: c.aiDivider, marginBottom: 12 }} />
      {report ? (
        <>
          {typeof report.uyumSkoru === 'number' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <ScoreRing score={report.uyumSkoru} />
              <T w={700} style={{ fontSize: 13 }}>{t('masa.aiOverall')}</T>
            </View>
          )}
          <T style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 21.45 }}>{report.content}</T>
        </>
      ) : (
        <T style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', lineHeight: 21.45 }}>{t('tm.meetupNote')}</T>
      )}
    </View>
  );
}

// scrollRef: kartın içinde bulunduğu ekran ScrollView'u ("Masa Sohbeti" alttaki sohbet kartına kaydırır)
function MasaDetayKartiInner({ masa, archive = false, scrollRef }: { masa: MasaDetayData; archive?: boolean; scrollRef?: React.RefObject<ScrollViewInstance | null> }) {
  const { t } = useTranslation();
  const live = !archive;
  const [lightbox, setLightbox] = useState<number | null>(null);
  // Katılımcı profil fotoğrafı tam ekran; kendi fotoğrafında düzenleme butonu
  const [viewer, setViewer] = useState<{ url: string; self: boolean } | null>(null);
  const openPhoto = (p: { photoUrl?: string | null; isSelf?: boolean }) => { if (p.photoUrl) setViewer({ url: p.photoUrl, self: !!p.isSelf }); };
  const [onMyWayDone, setOnMyWayDone] = useState(false);
  const [onMyWayLoading, setOnMyWayLoading] = useState(false);
  const [onMyWayWarn, setOnMyWayWarn] = useState('');
  const opensAt = new Date(masa.scheduledAt).getTime() - 60 * 60 * 1000;
  const [onMyWayOpen, setOnMyWayOpen] = useState(() => Date.now() >= opensAt);
  useEffect(() => { if (onMyWayOpen) return; const id = setInterval(() => { if (Date.now() >= opensAt) setOnMyWayOpen(true); }, 15000); return () => clearInterval(id); }, [onMyWayOpen, opensAt]);

  const photos = masa.venuePhotos ?? [];
  const ordered = buildOrdered(masa.participants);
  const hasMap = !!(masa.venueMapsUrl || masa.venueAddress);

  async function onMyWay() {
    if (!live || onMyWayDone || onMyWayLoading) return;
    if (!onMyWayOpen) { setOnMyWayWarn(t('masa.onMyWayLater')); setTimeout(() => setOnMyWayWarn(''), 4000); return; }
    setOnMyWayLoading(true);
    try { await api.post(`/meetings/${masa.id}/on-my-way`); setOnMyWayDone(true); }
    catch (e) { const m = (e as Error).message; if (m) { setOnMyWayWarn(m); setTimeout(() => setOnMyWayWarn(''), 4000); } }
    finally { setOnMyWayLoading(false); }
  }

  const now = new Date();
  const sosVisible = live && now >= new Date(masa.scheduledAt) && now < new Date(masa.sosEndsAt);
  const [showSos, setShowSos] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosDone, setSosDone] = useState(false);
  const [threats, setThreats] = useState<string[]>([]);
  const [locError, setLocError] = useState<'off' | 'denied' | null>(null);
  const [sosError, setSosError] = useState('');

  useEffect(() => {
    if (!sosVisible) return;
    api.get<{ reportId: string | null }>(`/sos/meetings/${masa.id}/my-report`).then(d => { if (d?.reportId) { setSosDone(true); startSosLive(d.reportId).catch(() => {}); } }).catch(() => {});
  }, [sosVisible, masa.id]);

  // Konum izni (ön plan / arka plan) istenmeden önce tam ekran açıklama: true = "Devam Et", false = "Şimdi Değil"
  const [disclosure, setDisclosure] = useState(false);
  const disclosureAnswer = useRef<((ok: boolean) => void) | null>(null);
  const disclosed = useRef(false);
  const askDisclosure = () => new Promise<boolean>((resolve) => { disclosureAnswer.current = resolve; setDisclosure(true); });
  const answerDisclosure = (ok: boolean) => { setDisclosure(false); disclosureAnswer.current?.(ok); disclosureAnswer.current = null; };

  // "Her zaman" izni: verilmemişse ve bu talep akışında açıklama henüz gösterilmediyse önce açıklama ekranı
  async function askAlwaysPermission() {
    const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
    if (bg?.status === 'granted') return;
    if (bg && !bg.canAskAgain) { showSettingsAlert(PERM_REASON.locationAlways); return; }
    if (!disclosed.current) {
      disclosed.current = true;
      if (!(await askDisclosure())) return;
    }
    await requestSosAlwaysPermission();
  }

  async function handleSos() {
    if (threats.length === 0 || sosLoading) return;
    setSosLoading(true); setLocError(null); setSosError('');
    disclosed.current = false;
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) { setLocError('off'); return; }
      let perm = await Location.getForegroundPermissionsAsync();
      // Kalıcı reddedilmişse sistem penceresi açılamaz: neden gerektiği + "Ayarlara Git" (açıklama ekranı akışı değişmedi)
      if (perm.status !== 'granted' && !perm.canAskAgain) { showSettingsAlert(PERM_REASON.location); setLocError('denied'); return; }
      if (perm.status !== 'granted') {
        // Açıklama ekranı izin isteğinden önce; "Şimdi Değil" izin istemeden forma döner
        disclosed.current = true;
        if (!(await askDisclosure())) return;
        perm = await Location.requestForegroundPermissionsAsync();
      }
      if (perm.status !== 'granted') { setLocError('denied'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      try {
        const r = await api.post<{ reportId: string }>(`/sos/${masa.id}/report`, { threats, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setSosDone(true); setShowSos(false);
        // Talep gönderildi: gönderim Kullanırken yöntemiyle başlar, ardından "Her zaman" izni istenir (red talebi engellemez)
        if (r?.reportId) startSosLive(r.reportId).catch(() => {}).finally(() => { askAlwaysPermission().catch(() => {}); });
      } catch (e) {
        const m = (e as Error).message;
        setSosError(m === '__rate_limit__' ? t('masa.tooMany') : m || t('masa.serverError'));
      }
    } catch { setLocError('off'); }
    finally { setSosLoading(false); }
  }

  // Kapak, bilgi şeridi ve katılımcılar (web MasaDetayKarti ile aynı yerleşim)
  const chatRef = useRef<React.ComponentRef<typeof View>>(null);
  // Mekânın yalnız ilk fotoğrafı gösterilir (tek fotoğraf; eski kayıtlardaki diğerleri gösterilmez)
  const cover = photos[0] ?? null;
  const present = masa.participants.filter(p => !p.cancelled);
  const femaleCount = present.filter(p => p.gender === 'FEMALE').length;
  const maleCount = present.filter(p => p.gender === 'MALE').length;
  const typeLabel = masa.type === 'ONE_ON_ONE' ? t('masa.typeOne') : masa.type === 'KANKA' ? t('masa.typeKanka') : t('masa.typeGroup');
  // "Masa Sohbeti": alttaki sohbet kartına kaydırır
  function scrollToChat() {
    const sv = scrollRef?.current;
    const inner = sv?.getInnerViewRef?.();
    if (!sv || !inner || !chatRef.current) return;
    chatRef.current.measureLayout(inner, (_x: number, y: number) => sv.scrollTo({ y: Math.max(0, y - 16), animated: true }), () => undefined);
  }
  const pill = (bg: string, border: string) => ({
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: masaKart.pill.gap, paddingVertical: masaKart.pill.padV, paddingHorizontal: masaKart.pill.padH,
    borderRadius: masaKart.pill.radius, backgroundColor: bg, borderWidth: 1, borderColor: border,
  });

  return (
    <View>
      {lightbox !== null && cover && <Lightbox photos={[cover]} start={lightbox} onClose={() => setLightbox(null)} />}
      <PhotoViewer url={viewer?.url ?? null} visible={!!viewer} onClose={() => setViewer(null)}
        onEdit={viewer?.self ? () => { setViewer(null); pickAndUploadProfilePhoto(true).then((ok) => { if (ok) prefetch(['/auth/me']); }).catch(() => undefined); } : undefined} />
      {showSos && <SosModal selected={threats} onToggle={t => setThreats(p => (p.includes(t) ? p.filter(x => x !== t) : [...p, t]))} onConfirm={handleSos}
        onClose={() => { setShowSos(false); setLocError(null); setSosError(''); setThreats([]); }} loading={sosLoading} locError={locError} error={sosError} />}
      <LocationDisclosure visible={disclosure} onContinue={() => answerDisclosure(true)} onCancel={() => answerDisclosure(false)} />

      {/* ── Ana kart ── */}
      <Card style={{ padding: 0, overflow: 'hidden', backgroundColor: tw.bg }}>
        {/* Kapak: mekânın tek fotoğrafı tam genişlikte 16:9 (cover); fotoğraf yoksa fotoğraf alanı yok, masa türü ve mekân adı normal akışta */}
        <View style={cover ? { aspectRatio: masaKart.coverAspect } : { gap: 12, paddingTop: 12, paddingHorizontal: 14 }}>
          {cover && (
            <>
              <Pressable onPress={() => setLightbox(0)} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.04)' }} accessibilityRole="imagebutton">
                {/* Backend göreli adres döner (/api/v1/media/venues/...); mobilde tam adrese çevrilir */}
                <Image source={{ uri: mediaUrl(cover.url) }} resizeMode="cover" style={{ width: '100%', height: '100%' }} accessibilityLabel={cover.caption ?? t('masa.photoAlt', { n: 1 })} />
              </Pressable>
              <LinearGradient pointerEvents="none" colors={masaKart.coverFade} locations={masaKart.coverFadeStops} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
            </>
          )}

          {/* Sol üst masa türü */}
          <View style={[pill(masaKart.typePill.bg, masaKart.typePill.border), cover ? { position: 'absolute', top: 12, left: 12 } : { alignSelf: 'flex-start' }]}>
            <T w={700} style={{ fontSize: masaKart.pill.fontSize, color: masaKart.typePill.text, letterSpacing: 0.44 }}>{typeLabel}</T>
          </View>

          {/* Alt: mekân adı + ilçe, sağda Haritada Gör */}
          <View style={[cover ? { position: 'absolute', left: 14, right: 14, bottom: 12 } : null, { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Serif style={{ fontSize: 24, lineHeight: 28.8, color: tw.text, letterSpacing: 0.24 }}>{masa.venueName}</Serif>
              {!!masa.venueDistrict && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={tw.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" /><Circle cx={12} cy={10} r={2.5} />
                  </Svg>
                  <T style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{masa.venueDistrict}</T>
                </View>
              )}
            </View>
            {hasMap && (
              <Pressable onPress={() => openMaps(masa.venueMapsUrl, masa.venueAddress, masa.venueName)} accessibilityRole="link" hitSlop={4}
                style={{ minHeight: Math.max(masaKart.mapBtn.minH, 44), justifyContent: 'center' }}>
                <View style={{ minHeight: masaKart.mapBtn.minH, justifyContent: 'center', paddingHorizontal: masaKart.mapBtn.padH, borderRadius: masaKart.mapBtn.radius, backgroundColor: masaKart.mapBtn.bg }}>
                  <T w={700} style={{ fontSize: masaKart.mapBtn.fontSize, color: masaKart.mapBtn.text, letterSpacing: 0.66 }}>{t('masa.seeOnMap')}</T>
                </View>
              </Pressable>
            )}
          </View>
        </View>

        <View style={{ padding: 18 }}>
          {/* Bilgi şeridi: gün/saat · kişi sayısı + kadın/erkek */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: masaKart.strip.padV, paddingHorizontal: masaKart.strip.padH,
            borderRadius: masaKart.strip.radius, backgroundColor: masaKart.strip.bg, borderWidth: 1, borderColor: masaKart.strip.border, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={masaKart.strip.icon} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Rect x={3} y={5} width={18} height={16} rx={2} /><Path d="M16 3v4M8 3v4M3 10h18" />
              </Svg>
              <T w={700} style={{ fontSize: 15 }}>{formatMeetingTime(masa.scheduledAt).replace(' · ', ', ')}</T>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={masaKart.strip.icon} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={9} cy={8} r={3.5} /><Path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><Path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2c2.1.7 3.5 2.8 3.5 5.8" />
              </Svg>
              <View style={{ alignItems: 'flex-end' }}>
                <T w={700} style={{ fontSize: 14, lineHeight: 16.8 }}>{t('masa.peopleCount', { n: present.length })}</T>
                <T style={{ fontSize: 11, lineHeight: 14.3, color: 'rgba(255,255,255,0.6)' }}>{t('masa.genderCount', { f: femaleCount, m: maleCount })}</T>
              </View>
            </View>
          </View>

          {/* Masa Katılımcıları + Masa Sohbeti */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
            <T w={700} style={{ fontSize: 15, flexShrink: 1 }}>{t('masa.tableParticipants')}</T>
            {live && (
              <Pressable onPress={scrollToChat} accessibilityRole="button" hitSlop={6}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: masaKart.chatBtn.minH, paddingHorizontal: masaKart.chatBtn.padH, borderRadius: masaKart.chatBtn.radius,
                  backgroundColor: masaKart.chatBtn.bg, borderWidth: 1, borderColor: masaKart.chatBtn.border }}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={masaKart.chatBtn.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
                </Svg>
                <T w={600} style={{ fontSize: masaKart.chatBtn.fontSize, color: masaKart.chatBtn.text }}>{t('masa.chatJump')}</T>
              </Pressable>
            )}
          </View>
          <View style={{ marginBottom: 20 }}>
            {masa.type === 'KANKA' ? (
              <KankaPairs mine={masa.participants.filter(p => p.pair === 'MINE') as KankaPerson[]} other={masa.participants.filter(p => p.pair === 'OTHER') as KankaPerson[]} onPhoto={openPhoto} />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: masaKart.avatarGap - 8 }}>
                {ordered.map((p, i) => {
                  const av = (
                    <View style={{ padding: 2, borderRadius: 999, borderWidth: 2, borderColor: p.isSelf ? masaKart.selfRing : 'transparent', backgroundColor: p.isSelf ? masaKart.selfRingGap : 'transparent' }}>
                      <DetayAvatar participant={p} delay={0.52 + i * 0.1} size={masaKart.avatar} />
                    </View>
                  );
                  const slot = p.photoUrl
                    ? <Pressable onPress={() => openPhoto(p)} accessibilityRole="imagebutton" accessibilityLabel={t('masa.enlargePhoto')} hitSlop={4}>{av}</Pressable>
                    : av;
                  // Görünen ad ("Ahmet Y.") avatarın yanında; fotoğrafsızda avatarın içindeki baş harf aynen kalır
                  return (
                    <View key={`${p.initials}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: p.displayName ? 4 : 0 }}>
                      {slot}
                      {!!p.displayName && <T w={600} numberOfLines={1} style={{ fontSize: 12, color: '#f4f1ec' }}>{p.displayName}</T>}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Meslekler: her satırda bir meslek, yalnız yazı; sıra sunucuda her istekte karışık, kime ait olduğu gösterilmez */}
          {!!masa.occupations?.length && (
            <View style={{ marginBottom: 20 }}>
              <T w={700} style={{ marginBottom: 8, fontSize: 13 }}>{t('masa.occupations')}</T>
              {masa.occupations.map((o, i) => <T key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 20 }}>{occupationLabel(o, t)}</T>)}
            </View>
          )}

          <AiReport report={masa.aiReport} />
        </View>
      </Card>

      {/* ── Alt kart: rezervasyon bilgisi, Yola Çıktım, sohbet (ardından gelmeyen işaretleme ve acil yardım) ── */}
      <Card style={{ marginTop: masaKart.cardGap }}>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16 }}>
          <T style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 19.2 }}>{t('masa.reservationDone')}</T>
        </View>

        <View style={{ marginBottom: 10 }}>
          {onMyWayDone ? (
            <Btn variant="doneGreen" disabled style={{ opacity: 1 }} label={t('masa.onMyWayDone')} />
          ) : (
            <BtnPrimary label={onMyWayLoading ? t('masa.onMyWayLoading') : t('masa.onMyWay')} full disabled={archive || onMyWayLoading} onPress={onMyWay} />
          )}
          {!!onMyWayWarn && (
            <View accessibilityRole="alert" style={{ marginTop: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 }}>
              <T style={{ fontSize: 12, color: c.warnOrange, lineHeight: 19.2 }}>{onMyWayWarn}</T>
            </View>
          )}
        </View>

        {/* Sohbet ("Masa Sohbeti" butonu buraya kaydırır) */}
        {live && <View ref={chatRef} collapsable={false}><ChatSection meetingId={masa.id} type={masa.type} /></View>}
        {live && <NoShowSection meetingId={masa.id} />}

        {sosVisible && (
          <View style={{ marginTop: 24 }}>
            {sosDone ? (
              <View style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(192,57,43,0.12)', borderWidth: 1.5, borderColor: 'rgba(192,57,43,0.5)', alignItems: 'center' }}>
                <T w={700} style={{ fontSize: 13, color: tw.accent }}>{t('masa.sosReceived')}</T>
                <T style={{ marginTop: 4, fontSize: 12, color: 'rgba(255,107,107,0.7)' }}>{t('masa.stayCalm')}</T>
              </View>
            ) : (
              <>
                <Btn variant="sos" onPress={() => setShowSos(true)} label={t('masa.sosButton')} />
                <View style={{ marginTop: 10, padding: 10, paddingHorizontal: 12, backgroundColor: 'rgba(192,57,43,0.07)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.22)', borderRadius: 8 }}>
                  <T style={{ fontSize: 10.5, lineHeight: 16.275, color: 'rgba(255,107,107,0.65)' }}>
                    {t('masa.sosInfo')} <T w={700} style={{ fontSize: 10.5, color: 'rgba(255,107,107,0.85)' }}>{t('masa.safetyImportant')}</T>
                  </T>
                </View>
              </>
            )}
          </View>
        )}
      </Card>
    </View>
  );
}


// Web karşılığı yalnız satır içi stil: satır yüksekliği her boyutta 1.5×
export function MasaDetayKarti(props: React.ComponentProps<typeof MasaDetayKartiInner>) { return <InlineLH><MasaDetayKartiInner {...props} /></InlineLH>; }
