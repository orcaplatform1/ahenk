// packages/ui/src/components/tables/MasaDetayKarti.tsx karşılığı: mekân, fotoğraf, tarih satırı + HARİTADA GÖR,
// katılımcılar (fotoğraf, ad, meslek), yapay zeka raporu, Acil Yardım, sohbet, gelmeyen işaretleme, Değerlendir.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/venueApi';
import { requestSosAlwaysPermission, startSosLive } from '@/lib/sosLive';
import { formatMeetingTime, gColor, type MasaTuru } from '@/lib/masa';
import { currentLang } from '@/lib/i18n';
import { openMaps } from '@/lib/links';
import { useAppRefresh } from '@/lib/useAppRefresh';
import { DetayAvatar } from './DetayAvatar';
import { PhotoViewer } from './ProfilePhoto';
import { SosNotice } from './SosNotice';
import { InlineLH, Btn, StdButton, Card, Serif, T } from './ui';
import { showAlert } from './AppAlert';
import { LocationDisclosure } from './LocationDisclosure';
import { ShareCardModal } from './ShareCard';
import { PERM_REASON, showSettingsAlert } from '@/lib/permissions';
import { c, ll, masaKart, sans, tw } from '@/theme/theme';
import { useTranslation } from 'react-i18next';
import { formatCardDate, formatDayMonth, occupationLabel, reviewOpensAt } from '@ahenk/shared';

export interface DetayParticipant { initials: string; displayName?: string | null; gender: 'MALE' | 'FEMALE' | string | null; pair?: 'MINE' | 'OTHER'; isSelf?: boolean; photoUrl?: string | null; cancelled?: boolean; occupation?: string | null }
export interface VenuePhoto { url: string; caption?: string }
export interface MasaDetayData {
  id: string; type?: MasaTuru; maxParticipants?: number; scheduledAt: string; sosEndsAt: string; venueName: string;
  venueAddress?: string | null; venueDistrict?: string | null; venueMapsUrl?: string | null; venuePhotos?: VenuePhoto[]; participants: DetayParticipant[];
  aiReport?: { content: string; uyumSkoru: number; generatedAt: string; questions?: string[] | null; dna?: string | null; dnaShort?: string | null } | null;
}
interface ChatMsg { id: string; content: string; createdAt: string; isOwn: boolean; senderName: string; senderGender?: string | null; seatNo?: number | null; senderPhotoUrl?: string | null; reportedByMe: boolean; pending?: boolean }

const GREEN = c.green;
const msgTime = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });

// Katılımcı satırları (satırda en fazla 2 kişi; web participantRows ile aynı): Grup ve Baş Başa'da her satır 1 erkek + 1 kadın;
// Kankamla'da üst satır kullanıcının kanka çifti, alt satır karşı çift
function participantRows(ps: DetayParticipant[], type?: MasaTuru): DetayParticipant[][] {
  const chunk = (list: DetayParticipant[]) => { const r: DetayParticipant[][] = []; for (let i = 0; i < list.length; i += 2) r.push(list.slice(i, i + 2)); return r; };
  if (type === 'KANKA') {
    const mine = ps.filter(p => p.pair === 'MINE').sort((a, b) => Number(!!b.isSelf) - Number(!!a.isSelf));
    return [...chunk(mine), ...chunk(ps.filter(p => p.pair !== 'MINE'))];
  }
  const m = ps.filter(p => p.gender === 'MALE'), f = ps.filter(p => p.gender === 'FEMALE'), o = ps.filter(p => p.gender !== 'MALE' && p.gender !== 'FEMALE');
  const rows: DetayParticipant[][] = [];
  for (let i = 0; i < Math.max(m.length, f.length); i++) rows.push([m[i], f[i]].filter((p): p is DetayParticipant => !!p));
  return [...rows, ...chunk(o)];
}

// "Değerlendir": İçerde paket kartı rozetindeki altın geçişli hap (web GOLD_PILL); HIG: en az 44 pt dokunma alanı
export function GoldPill({ label, onPress, small }: { label: string; onPress: () => void; small?: boolean }) {
  const g = masaKart.goldPill;
  const z = small ? masaKart.goldPillSmall : g;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
      <LinearGradient colors={g.colors} locations={g.stops} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ minHeight: z.minH, paddingHorizontal: z.padH, borderRadius: 9999, alignItems: 'center', justifyContent: 'center' }}>
        <T w={800} style={{ fontSize: z.fontSize, letterSpacing: z.fontSize * 0.08, color: g.text }}>{label.toLocaleUpperCase(currentLang() === 'en' ? 'en' : 'tr-TR')}</T>
      </LinearGradient>
    </Pressable>
  );
}


// Masa sohbeti (web ChatSection ile aynı): başlık "Masa Sohbeti" + katılımcı sayısı; her mesajda fotoğraf (yoksa cinsiyet renkli baş harf)
// ve ad; saat baloncuğun içinde sağ altta; emoji seçici + gönder ikonu; başkasının mesajına basılı tutunca "Şikâyet Et"; altta Masa Kuralları
const EMOJIS = ['😀', '😂', '😊', '😍', '🥰', '😎', '🤔', '😅', '😉', '🙏', '👍', '👏', '🙌', '💪', '🎉', '❤️', '🔥', '✨', '🍷', '🍻', '☕', '🍕', '🌙', '😮', '😢', '👋', '🤝', '😇', '🤗', '😋'];
const REPORT_REASONS = ['INSULT_THREAT', 'HARASSMENT_SEXUAL', 'VENUE_CHANGE', 'CONTACT_SHARE', 'DRUGS', 'FRAUD_MONEY', 'ADVERTISING', 'DISCRIMINATION', 'FAKE_PROFILE', 'OTHER'] as const;

function nameInitials(name: string): string {
  const parts = name.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, '').trim().split(/\s+/);
  const f = parts[0]?.[0] ?? '?';
  const l = (parts[1] ?? '').replace('.', '')[0] ?? '';
  return `${f}.${l ? `${l}.` : ''}`.toLocaleUpperCase('tr-TR');
}

function ChatAvatar({ msg }: { msg: ChatMsg }) {
  const color = gColor(msg.senderGender);
  return msg.senderPhotoUrl
    ? <Image source={{ uri: mediaUrl(msg.senderPhotoUrl) }} style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: color }} />
    : (
      <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: color, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' }}>
        <T w={700} style={{ fontSize: 9.5, color: '#f4f1ec' }}>{nameInitials(msg.senderName)}</T>
      </View>
    );
}

function ReportSheet({ visible, onClose, onSubmit }: { visible: boolean; onClose: () => void; onSubmit: (reason: string, note: string) => Promise<string | null> }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (visible) { setReason(null); setNote(''); setErr(''); } }, [visible]);
  const can = !!reason && (reason !== 'OTHER' || note.trim().length > 0) && !busy;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Pressable onPress={() => undefined} style={{ width: '100%', maxWidth: 400, maxHeight: '90%', backgroundColor: tw.bg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 20 }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <T w={700} style={{ fontSize: 16, color: '#f4f1ec', marginBottom: 14 }}>{t('masa.reportTitle')}</T>
            <View style={{ gap: 6 }}>
              {REPORT_REASONS.map(r => {
                const on = reason === r;
                return (
                  <Pressable key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                    style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1,
                      borderColor: on ? 'rgba(192,57,43,0.5)' : 'rgba(255,255,255,0.08)', backgroundColor: on ? 'rgba(192,57,43,0.12)' : 'rgba(255,255,255,0.04)' }}>
                    <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: on ? c.red : 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                      {on && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.red }} />}
                    </View>
                    <T style={{ flex: 1, fontSize: 13, color: '#f4f1ec' }}>{t(`masa.reason_${r}`)}</T>
                  </Pressable>
                );
              })}
            </View>
            {reason === 'OTHER' && (
              <TextInput value={note} onChangeText={(v) => setNote(v.slice(0, 1000))} placeholder={t('masa.reportNote')} placeholderTextColor="rgba(255,255,255,0.4)" multiline keyboardAppearance="dark"
                style={{ marginTop: 10, minHeight: 72, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 10, color: tw.text, fontSize: 13, fontFamily: sans(400), textAlignVertical: 'top' }} />
            )}
            {!!err && <T accessibilityRole="alert" style={{ marginTop: 10, fontSize: 12, color: tw.accent }}>{err}</T>}
            <View style={{ alignItems: 'center', gap: 8, marginTop: 16 }}>
              <StdButton variant="primary" label={t('masa.reportAction')} disabled={!can} style={{ width: '100%', maxWidth: 280 }}
                onPress={async () => { if (!reason) return; setBusy(true); setErr(''); const e = await onSubmit(reason, note); setBusy(false); if (e) setErr(e); }} />
              <StdButton variant="ghost" label={t('masa.reportCancel')} style={{ width: '100%', maxWidth: 280 }} onPress={onClose} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ChatSection({ meetingId, count }: { meetingId: string; count?: string }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [openAt, setOpenAt] = useState<string | null>(null);
  const [closeAt, setCloseAt] = useState<string | null>(null);
  const [sendError, setSendError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
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
    setSending(true); setSendError(''); setEmojiOpen(false);
    // Gönderiliyor: sunucu yanıtına (denetimde bekletme dahil) kadar baloncuk "gönderiliyor" durumunda
    const tempId = `pending-${Date.now()}`;
    const mine = [...messages].reverse().find(m => m.isOwn);
    setMessages(p => [...p, { id: tempId, content: trimmed, createdAt: new Date().toISOString(), isOwn: true, senderName: mine?.senderName ?? '', senderGender: mine?.senderGender, senderPhotoUrl: mine?.senderPhotoUrl, seatNo: mine?.seatNo ?? null, reportedByMe: false, pending: true }]);
    setInput('');
    try { const msg = await api.post<ChatMsg>(`/chat/${meetingId}/messages`, { content: trimmed }); setMessages(p => p.map(m => (m.id === tempId ? msg : m))); }
    catch (e) { setMessages(p => p.filter(m => m.id !== tempId)); setSendError((e as Error).message || t('masa.sendFailedMsg')); }
    finally { setSending(false); }
  }
  async function submitReport(id: string, reason: string, note: string): Promise<string | null> {
    try {
      await api.post(`/chat/messages/${id}/report`, { reason, ...(reason === 'OTHER' ? { note } : {}) });
      setMessages(p => p.map(m => (m.id === id ? { ...m, reportedByMe: true } : m)));
      setReportFor(null);
      setNotice(t('masa.reportDone')); setTimeout(() => setNotice(''), 3000);
      return null;
    } catch (e) { return (e as Error).message || t('masa.sendFailedMsg'); }
  }
  // Basılı tutunca mesaj menüsü: "Şikâyet Et"
  function openMenu(m: ChatMsg) {
    if (m.isOwn || isClosed || m.pending) return;
    showAlert(t('masa.msgMenu'), undefined, m.reportedByMe
      ? [{ text: t('masa.reported'), style: 'cancel' }]
      : [{ text: t('masa.reportAction'), style: 'destructive', onPress: () => setReportFor(m.id) }, { text: t('masa.reportCancel'), style: 'cancel' }]);
  }

  return (
    <View>
      <ReportSheet visible={!!reportFor} onClose={() => setReportFor(null)} onSubmit={(r, n) => submitReport(reportFor!, r, n)} />
      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 20 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: isClosed ? c.t555 : GREEN }} />
          <T w={700} style={{ fontSize: 13, color: isClosed ? '#777' : '#f4f1ec' }}>{t('masa.chatTitle')}</T>
        </View>
        {!!count && <T w={600} style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{count}</T>}
      </View>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
        <ScrollView ref={scroll} nestedScrollEnabled style={{ maxHeight: 320 }} contentContainerStyle={{ padding: 12, paddingBottom: 8, gap: 8 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          {messages.length === 0 && (
            <T style={{ fontSize: 12, textAlign: 'center' }}>
              {!isOpen && openAt ? t('masa.chatOpensAt', { time: formatMeetingTime(openAt) }) : isClosed ? t('masa.chatEnded') : t('masa.noMessages')}
            </T>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const first = !prev || prev.isOwn !== m.isOwn || prev.seatNo !== m.seatNo;
            return (
              <View key={m.id} style={{ flexDirection: m.isOwn ? 'row-reverse' : 'row', gap: 6, alignItems: 'flex-start' }}>
                <View style={{ width: 28 }}>{first && <ChatAvatar msg={m} />}</View>
                <View style={{ maxWidth: '72%', alignItems: m.isOwn ? 'flex-end' : 'flex-start' }}>
                  {/* Gönderen fotoğrafı ve görünen adı ("Ahmet Y.") serinin ilk mesajında */}
                  {first && !!m.senderName && <T w={600} style={{ fontSize: 11, color: gColor(m.senderGender), marginBottom: 3 }}>{m.senderName}</T>}
                  <Pressable onLongPress={() => openMenu(m)} delayLongPress={350} accessibilityHint={!m.isOwn ? t('masa.reportAction') : undefined}
                    style={{ paddingTop: 7, paddingBottom: 5, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: gColor(m.senderGender), opacity: m.pending ? 0.7 : 1,
                      borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: m.isOwn ? 12 : 2, borderBottomRightRadius: m.isOwn ? 2 : 12 }}>
                    <T style={{ fontSize: 13, color: c.tF0, lineHeight: 18.85 }}>{m.content}</T>
                    {/* Saat baloncuğun içinde sağ altta (WhatsApp gibi), metinden farklı renkte */}
                    <T style={{ alignSelf: 'flex-end', marginTop: 2, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{m.pending ? t('masa.msgSending') : msgTime(m.createdAt)}</T>
                  </Pressable>
                  {!m.isOwn && m.reportedByMe && <T style={{ fontSize: 10, color: c.t555, marginTop: 2 }}>{t('masa.reported')}</T>}
                </View>
              </View>
            );
          })}
        </ScrollView>
        {isOpen && !isClosed && (
          <>
            {emojiOpen && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                {EMOJIS.map(e => (
                  <Pressable key={e} onPress={() => setInput(v => (v + e).slice(0, 1000))} accessibilityRole="button" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <T style={{ fontSize: 22 }}>{e}</T>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
              <Pressable onPress={() => setEmojiOpen(v => !v)} accessibilityRole="button" accessibilityLabel={t('masa.emoji')} accessibilityState={{ expanded: emojiOpen }}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <T style={{ fontSize: 22 }}>🙂</T>
              </Pressable>
              <TextInput value={input} onChangeText={(v) => setInput(v.slice(0, 1000))} onSubmitEditing={send} returnKeyType="send" keyboardAppearance="dark"
                onFocus={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 300)}
                style={{ flex: 1, minWidth: 0, minHeight: 40, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, fontSize: 14, color: tw.text, fontFamily: sans(400) }} />
              <Pressable onPress={send} disabled={!input.trim() || sending} accessibilityRole="button" accessibilityLabel={t('masa.send')}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.red, alignItems: 'center', justifyContent: 'center', opacity: input.trim() && !sending ? 1 : 0.5 }}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M22 2 11 13" /><Path d="M22 2 15 22l-4-9-9-4 20-7z" />
                  </Svg>
                </View>
              </Pressable>
            </View>
          </>
        )}
        {!!sendError && isOpen && !isClosed && <T accessibilityRole="alert" style={{ paddingHorizontal: 10, paddingBottom: 8, fontSize: 12, lineHeight: 18, color: tw.accent }}>{sendError}</T>}
        {!!notice && <T style={{ paddingHorizontal: 10, paddingBottom: 8, fontSize: 12, color: ll.label }}>{notice}</T>}
      </View>
      {/* Sabit Masa Kuralları kartı */}
      <View style={{ marginTop: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(245,158,11,0.06)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' }}>
        <T style={{ fontSize: 11.5, lineHeight: 17.8, color: 'rgba(255,255,255,0.75)' }}>
          <T w={700} style={{ fontSize: 11.5, color: '#f4f1ec' }}>{t('masa.chatRulesTitle')}</T> {t('masa.chatRulesText')}
        </T>
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
          {/* Tek dokunuşla 112 */}
          <Pressable onPress={() => { Linking.openURL('tel:112').catch(() => undefined); }} accessibilityRole="link" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
            <T style={{ fontSize: 11.5, color: 'rgba(255,107,107,0.8)', textDecorationLine: 'underline' }}>{t('masa.sosCall112')}</T>
          </Pressable>
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
        <Btn variant="lightboxClose" onPress={onClose} hitSlop={4} accessibilityLabel={t('masa.close')} label="×" />
      </Pressable>
    </Modal>
  );
}

// Yapay Zeka Masa Raporu: kayıtlı uyumSkoru yeşil halkada ("Genel Uyum"); rapor yoksa mevcut bilgi metni (tm.meetupNote)
const upperTr = (s: string) => s.toLocaleUpperCase(currentLang() === 'en' ? 'en' : 'tr-TR');
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

// Yapay Zekâ Masa Raporu: 3 soru, masa DNA'sı, AI yorumu; kart açıkken "Masa Dinamiğini Paylaş" (paylaşım kartı)
function AiReport({ report, meetingId }: { report?: MasaDetayData['aiReport']; meetingId?: string }) {
  const { t } = useTranslation();
  const [shareOpen, setShareOpen] = useState(false);
  const sub = { fontSize: 10, letterSpacing: 1.2, color: c.aiTitle, marginBottom: 6 } as const;
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
          {!!report.questions?.length && (
            <View style={{ marginBottom: 12 }}>
              <T w={700} style={sub}>{upperTr(t('masa.aiQuestions'))}</T>
              {report.questions.map((q, i) => (
                <T key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 20, marginBottom: 4 }}>{i + 1}. {q}</T>
              ))}
            </View>
          )}
          {!!report.dna && (
            <View style={{ marginBottom: 12 }}>
              <T w={700} style={sub}>{upperTr(t('masa.aiDna'))}</T>
              <T style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 21.45 }}>{report.dna}</T>
            </View>
          )}
          {!!report.dna && <T w={700} style={sub}>{upperTr(t('masa.aiComment'))}</T>}
          <T style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 21.45 }}>{report.content}</T>
          {!!meetingId && <StdButton variant="primary" label={t('masa.shareOpen')} full style={{ marginTop: 14 }} onPress={() => setShareOpen(true)} />}
          {shareOpen && !!meetingId && <ShareCardModal meetingId={meetingId} onClose={() => setShareOpen(false)} />}
        </>
      ) : (
        <T style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', lineHeight: 21.45 }}>{t('tm.meetupNote')}</T>
      )}
    </View>
  );
}

function MasaDetayKartiInner({ masa, archive = false }: { masa: MasaDetayData; archive?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const live = !archive;
  const [lightbox, setLightbox] = useState<number | null>(null);
  // Katılımcı profil fotoğrafı tam ekran (kendi fotoğrafında da düzenleme yok; fotoğraf yalnız Profilim'den değişir)
  const [viewer, setViewer] = useState<string | null>(null);
  const openPhoto = (p: { photoUrl?: string | null }) => { if (p.photoUrl) setViewer(p.photoUrl); };

  const photos = masa.venuePhotos ?? [];
  const rows = participantRows(masa.participants.filter(p => !p.cancelled), masa.type);
  const hasMap = !!(masa.venueMapsUrl || masa.venueAddress);

  // "Değerlendir": değerlendirme buluşma günü 23:59'dan sonra (ertesi gün 00:00) açılır; önce basılırsa uyarı
  const [reviewWarn, setReviewWarn] = useState('');
  const reviewAt = reviewOpensAt(masa.scheduledAt);
  function handleReview() {
    if (Date.now() < reviewAt.getTime()) {
      setReviewWarn(t('masa.reviewNotYet', { date: formatDayMonth(reviewAt, currentLang()) }));
      setTimeout(() => setReviewWarn(''), 4000);
      return;
    }
    router.push(`/degerlendirme/${masa.id}`);
  }
  // "Nasıl çalışır?" penceresi ve talep sonrası 30 sn uyarı
  const [sosHowOpen, setSosHowOpen] = useState(false);
  const [sentNotice, setSentNotice] = useState(false);

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
        setSosDone(true); setShowSos(false); setSentNotice(true);
        // Talep gönderildi: gönderim Kullanırken yöntemiyle başlar, ardından "Her zaman" izni istenir (red talebi engellemez)
        if (r?.reportId) startSosLive(r.reportId).catch(() => {}).finally(() => { askAlwaysPermission().catch(() => {}); });
      } catch (e) {
        const m = (e as Error).message;
        setSosError(m === '__rate_limit__' ? t('masa.tooMany') : m || t('masa.serverError'));
      }
    } catch { setLocError('off'); }
    finally { setSosLoading(false); }
  }

  // Kapak, tarih satırı ve katılımcılar (web MasaDetayKarti ile aynı yerleşim)
  // Mekânın yalnız ilk fotoğrafı gösterilir (tek fotoğraf; eski kayıtlardaki diğerleri gösterilmez)
  const cover = photos[0] ?? null;
  const P = masaKart.person;

  return (
    <View>
      {lightbox !== null && cover && <Lightbox photos={[cover]} start={lightbox} onClose={() => setLightbox(null)} />}
      <PhotoViewer url={viewer} visible={!!viewer} onClose={() => setViewer(null)} />
      <SosNotice visible={sentNotice} title={t('sos.sentTitle')} lines={[t('sos.sentLine1'), t('sos.sentLine2')]} bold={t('sos.sentBold')}
        durationMs={30_000} countdown onClose={() => setSentNotice(false)} />
      <Modal visible={sosHowOpen} transparent animationType="fade" onRequestClose={() => setSosHowOpen(false)} statusBarTranslucent>
        <Pressable onPress={() => setSosHowOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(10,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Pressable onPress={() => undefined} accessibilityRole="alert" style={{ width: '100%', maxWidth: 380, backgroundColor: '#0f0808', borderWidth: 1.5, borderColor: 'rgba(192,57,43,0.7)', borderRadius: 16, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 20 }}>
            <Pressable onPress={() => setSosHowOpen(false)} accessibilityRole="button" accessibilityLabel={t('masa.close')}
              style={{ position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
              <T w={700} style={{ fontSize: 20, color: tw.text }}>×</T>
            </Pressable>
            <T w={800} style={{ fontSize: 16, color: tw.accent, marginBottom: 12, marginRight: 36 }}>{t('masa.sosHow')}</T>
            <T style={{ fontSize: 13, lineHeight: 20.8, color: 'rgba(255,255,255,0.8)' }}>{t('masa.sosHowText')}</T>
          </Pressable>
        </Pressable>
      </Modal>
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

          {/* Alt: mekân adı + ilçe */}
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
          </View>
        </View>

        <View style={{ padding: 18 }}>
          {/* Tarih satırı ("18 Kasım, Çarşamba 20:00"), sağında Haritada Gör */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: masaKart.strip.padV, paddingHorizontal: masaKart.strip.padH,
            borderRadius: masaKart.strip.radius, backgroundColor: masaKart.strip.bg, borderWidth: 1, borderColor: masaKart.strip.border, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={masaKart.strip.icon} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Rect x={3} y={5} width={18} height={16} rx={2} /><Path d="M16 3v4M8 3v4M3 10h18" />
              </Svg>
              <T w={700} style={{ fontSize: 15, flexShrink: 1 }}>{formatCardDate(masa.scheduledAt, currentLang())}</T>
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

          {/* Masa Katılımcıları: satırda en fazla 2 kişi; fotoğraf, altında görünen ad ("Ahmet Y."), altında kendi mesleği.
              Geçmiş masada (archive) kullanıcının kendisi aynen; diğer katılımcılarda fotoğraf, ad ve meslek yok, "Masanız Kuruldu"
              ekranındaki gibi DetayAvatar (cinsiyet renkli bordür, beyaz kalın baş harfler "M.D.") — web MasaDetayKarti ile aynı */}
          <T w={700} style={{ fontSize: 15, marginBottom: 12 }}>{t('masa.tableParticipants')}</T>
          <View style={{ gap: P.rowGap, marginBottom: 20 }}>
            {rows.map((row, r) => (
              <View key={r} style={{ flexDirection: 'row', gap: P.colGap }}>
                {row.map((p, i) => {
                  if (archive && !p.isSelf) {
                    return (
                      <View key={`${p.initials}-${i}`} style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
                        <DetayAvatar participant={{ initials: p.initials, gender: p.gender }} delay={0.52 + (r * 2 + i) * 0.1} size={P.avatar} />
                      </View>
                    );
                  }
                  const av = <DetayAvatar participant={p} delay={0.52 + (r * 2 + i) * 0.1} size={P.avatar} />;
                  return (
                    <View key={`${p.initials}-${i}`} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 6 }}>
                      {p.photoUrl
                        ? <Pressable onPress={() => openPhoto(p)} accessibilityRole="imagebutton" accessibilityLabel={t('masa.enlargePhoto')} hitSlop={4}>{av}</Pressable>
                        : av}
                      <T w={600} numberOfLines={1} style={{ fontSize: P.name, color: P.nameColor, textAlign: 'center' }}>{p.displayName ?? p.initials}</T>
                      <T style={{ minHeight: 18, fontSize: P.job, lineHeight: 18, color: P.jobColor, textAlign: 'center' }}>{p.occupation ? occupationLabel(p.occupation, t) : ''}</T>
                    </View>
                  );
                })}
                {row.length === 1 && <View style={{ flex: 1 }} />}
              </View>
            ))}
          </View>

          <AiReport report={masa.aiReport} meetingId={archive ? undefined : masa.id} />
        </View>
      </Card>

      {/* ── Alt kart: acil yardım (eski rezervasyon kartı ve Yola Çıktım yerinde), sohbet, gelmeyen işaretleme, Değerlendir.
          Geçmiş masada (archive) bu kart yok ── */}
      {live && (
      <Card style={{ marginTop: masaKart.cardGap }}>
        {sosVisible && (
          <View style={{ marginBottom: 4 }}>
            {sosDone ? (
              <View style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(192,57,43,0.12)', borderWidth: 1.5, borderColor: 'rgba(192,57,43,0.5)', alignItems: 'center' }}>
                <T w={700} style={{ fontSize: 13, color: tw.accent }}>{t('masa.sosReceived')}</T>
                <T style={{ marginTop: 4, fontSize: 12, color: 'rgba(255,107,107,0.7)' }}>{t('masa.stayCalm')}</T>
              </View>
            ) : (
              <>
                <Btn variant="sos" onPress={() => setShowSos(true)} label={t('masa.sosButton')} />
                <T style={{ marginTop: 10, fontSize: 11.5, lineHeight: 17.8, color: 'rgba(255,107,107,0.75)' }}>
                  {t('masa.sosHelp')}{' · '}
                  <T w={700} onPress={() => setSosHowOpen(true)} accessibilityRole="link" style={{ fontSize: 11.5, color: tw.accent, textDecorationLine: 'underline' }}>{t('masa.sosHow')}</T>
                </T>
              </>
            )}
          </View>
        )}

        <ChatSection meetingId={masa.id} count={`${masa.participants.filter(p => !p.cancelled).length}/${masa.maxParticipants ?? masa.participants.filter(p => !p.cancelled).length}`} />
        <NoShowSection meetingId={masa.id} />

        {/* Değerlendir: değerlendirme ertesi gün 08:00'de açılır; önce basılırsa uyarı */}
        <View style={{ marginTop: 20, alignItems: 'center', gap: 8 }}>
          <GoldPill label={t('tm.review')} onPress={handleReview} />
          {!!reviewWarn && <T accessibilityRole="alert" style={{ fontSize: 12, color: c.warnOrange, textAlign: 'center' }}>{reviewWarn}</T>}
        </View>
      </Card>
      )}
    </View>
  );
}


// Web karşılığı yalnız satır içi stil: satır yüksekliği her boyutta 1.5×
export function MasaDetayKarti(props: React.ComponentProps<typeof MasaDetayKartiInner>) { return <InlineLH><MasaDetayKartiInner {...props} /></InlineLH>; }
