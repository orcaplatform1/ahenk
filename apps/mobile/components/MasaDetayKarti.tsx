// packages/ui/src/components/tables/MasaDetayKarti.tsx karşılığı: mekân, fotoğraflar, HARİTADA GÖR, buluşma,
// katılımcılar, yapay zeka raporu, bilgi kutusu, Yola Çıktım, sohbet, gelmeyen işaretleme, Acil Yardım.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { api } from '@/lib/api';
import { startSosLive } from '@/lib/sosLive';
import { formatMeetingTime, gColor, type MasaTuru } from '@/lib/masa';
import { openMaps } from '@/lib/links';
import { useAppRefresh } from '@/lib/useAppRefresh';
import { DetayAvatar } from './DetayAvatar';
import { KankaPairs, type KankaPerson } from './KankaPairs';
import { InlineLH, Btn, BtnPrimary, Serif, T } from './ui';
import { c, sans, tw } from '@/theme/theme';

export interface DetayParticipant { initials: string; gender: 'MALE' | 'FEMALE' | string | null; pair?: 'MINE' | 'OTHER'; isSelf?: boolean }
export interface VenuePhoto { url: string; caption?: string }
export interface MasaDetayData {
  id: string; type?: MasaTuru; maxParticipants?: number; scheduledAt: string; sosEndsAt: string; venueName: string;
  venueAddress?: string | null; venueMapsUrl?: string | null; venuePhotos?: VenuePhoto[]; participants: DetayParticipant[];
  aiReport?: { content: string; uyumSkoru: number; generatedAt: string } | null;
}
interface ChatMsg { id: string; content: string; createdAt: string; isOwn: boolean; senderInitials: string; senderGender?: string | null; seatNo?: number | null; reportedByMe: boolean }

const GREEN = c.green;
const msgTime = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });

function buildOrdered(ps: DetayParticipant[]) {
  const m = ps.filter(p => p.gender === 'MALE'), f = ps.filter(p => p.gender === 'FEMALE'), o = ps.filter(p => p.gender !== 'MALE' && p.gender !== 'FEMALE');
  const out: DetayParticipant[] = [];
  for (let i = 0; i < Math.max(m.length, f.length); i++) { if (i < m.length) out.push(m[i]); if (i < f.length) out.push(f[i]); }
  return [...out, ...o];
}

function ChatBadge({ initials, gender }: { initials: string; gender?: string | null }) {
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      backgroundColor: gender === 'FEMALE' ? 'rgba(244,143,177,0.12)' : 'rgba(79,195,247,0.12)', borderWidth: 1.5, borderColor: gColor(gender) }}>
      <T w={700} numberOfLines={1} style={{ fontSize: initials.length > 4 ? 7.5 : 8.5, color: c.tF0, letterSpacing: 0.17 }}>{initials.toUpperCase()}</T>
    </View>
  );
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
    catch (e) { setSendError((e as Error).message || 'Mesaj gönderilemedi'); }
    finally { setSending(false); }
  }
  async function report(id: string) {
    await api.post(`/chat/messages/${id}/report`).catch(() => {});
    setMessages(p => p.map(m => (m.id === id ? { ...m, reportedByMe: true } : m)));
  }
  const title = isClosed ? 'SOHBET KAPANDI' : type === 'ONE_ON_ONE' ? 'BAŞ BAŞA SOHBETİ' : type === 'KANKA' ? 'KANKAMLA SOHBETİ' : 'GRUP SOHBETİ';

  return (
    <View>
      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 20 }} />
      <SectionDot color={isClosed ? c.t555 : GREEN} label={title} />
      <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
        <ScrollView ref={scroll} nestedScrollEnabled style={{ maxHeight: 260 }} contentContainerStyle={{ padding: 12, paddingBottom: 8, gap: 8 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          {messages.length === 0 && (
            <T style={{ fontSize: 12, textAlign: 'center' }}>
              {!isOpen && openAt ? `Sohbet ${formatMeetingTime(openAt)} itibarıyla açılacak.` : isClosed ? 'Sohbet sona erdi.' : 'Henüz mesaj yok. İlk mesajı sen gönder.'}
            </T>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const first = !prev || prev.isOwn !== m.isOwn || prev.seatNo !== m.seatNo;
            return (
              <View key={m.id} style={{ flexDirection: 'row', justifyContent: m.isOwn ? 'flex-end' : 'flex-start', gap: 6, alignItems: 'flex-start' }}>
                {!m.isOwn && (first ? <ChatBadge initials={m.senderInitials} gender={m.senderGender} /> : <View style={{ width: 28 }} />)}
                <View style={{ maxWidth: '72%', alignItems: m.isOwn ? 'flex-end' : 'flex-start' }}>
                  <View style={{ paddingVertical: 8, paddingHorizontal: 11, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: gColor(m.senderGender),
                    borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: m.isOwn ? 12 : 2, borderBottomRightRadius: m.isOwn ? 2 : 12 }}>
                    <T style={{ fontSize: 13, color: c.tF0, lineHeight: 18.85 }}>{m.content}</T>
                  </View>
                  <T style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{msgTime(m.createdAt)}</T>
                  {!m.isOwn && !isClosed && (
                    <Btn variant="reportLink" selected={m.reportedByMe} onPress={() => !m.reportedByMe && report(m.id)} label={m.reportedByMe ? '✓ Şikayet edildi' : 'Şikayet et'} />
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
            <BtnPrimary label="Gönder" onPress={send} disabled={!input.trim() || sending} style={{ paddingHorizontal: 10, gap: 5 }} textStyle={{ fontSize: 10 }} />
          </View>
        )}
        {!!sendError && isOpen && !isClosed && <T style={{ paddingHorizontal: 10, paddingBottom: 8, fontSize: 12, color: tw.accent }}>{sendError}</T>}
      </View>
    </View>
  );
}

interface NoShowMarking { open: boolean; participants: { userId: string; initials: string; gender: string | null }[]; markedIds: string[] }

function NoShowSection({ meetingId }: { meetingId: string }) {
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
    catch (e) { setError((e as Error).message || 'Gönderilemedi, tekrar dene.'); }
    finally { setSending(false); }
  }
  return (
    <View style={{ marginTop: 24, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
      <T w={600} style={{ fontSize: 13, marginBottom: 4 }}>Masana gelmeyen oldu mu?</T>
      <T style={{ fontSize: 11.5, color: c.t888, lineHeight: 17.25, marginBottom: 12 }}>Gelmeyen kişileri işaretleyip gönder. Gönderilen bildirim geri alınamaz.</T>
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
              {locked && <T style={{ marginLeft: 'auto', fontSize: 11, color: c.red }}>Bildirildi</T>}
            </Pressable>
          );
        })}
      </View>
      {!!error && <T style={{ marginTop: 10, fontSize: 12, color: tw.accent }}>{error}</T>}
      {selected.size > 0 && (
        <Btn variant="noShowSend" onPress={send} disabled={sending} label={sending ? 'Gönderiliyor…' : 'Gelmedi olarak bildir'} />
      )}
    </View>
  );
}

const SOS_THREATS = [
  { value: 'LIFE_DANGER', label: 'Hayatım tehlikede' },
  { value: 'PHYSICAL_VIOLENCE', label: 'Fiziksel şiddet gördüm' },
  { value: 'ABDUCTION', label: 'Zorla alıkoyuluyorum' },
  { value: 'HARASSMENT', label: 'Taciz veya istismara uğradım' },
] as const;

function SosModal({ selected, onToggle, onConfirm, onClose, loading, locError, error }: {
  selected: string[]; onToggle: (t: string) => void; onConfirm: () => void; onClose: () => void; loading: boolean; locError: 'off' | 'denied' | null; error: string;
}) {
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
          <T w={800} style={{ fontSize: 16, color: tw.accent, letterSpacing: 0.32, marginBottom: 6 }}>ACİL YARDIM TALEP FORMU</T>
          <View style={{ height: 1, backgroundColor: 'rgba(192,57,43,0.3)', marginTop: 10, marginBottom: 16 }} />
          <T style={{ fontSize: 12, color: 'rgba(255,107,107,0.7)', lineHeight: 18, marginBottom: 12 }}>Yaşadığın durumu seç:</T>
          <View style={{ gap: 8, marginBottom: 12 }}>
            {SOS_THREATS.map(t => {
              const on = selected.includes(t.value);
              return (
                <Btn key={t.value} variant="sosThreat" selected={on} onPress={() => onToggle(t.value)} accessibilityLabel={t.label}>
                  <View style={{ width: 16, height: 16, borderRadius: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: on ? tw.accent : 'rgba(255,255,255,0.2)', backgroundColor: on ? 'rgba(192,57,43,0.3)' : 'transparent' }}>
                    <T style={{ fontSize: 10 }}>{on ? '✓' : ''}</T>
                  </View>
                  <T w={on ? 600 : 400} style={{ fontSize: 13, color: on ? tw.accent : c.tCcc }}>{t.label}</T>
                </Btn>
              );
            })}
          </View>
          <T style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', lineHeight: 16.5, marginBottom: 16 }}>Yukarıdaki eylemlerin ihtimali olsa dahi lütfen işaretleyin (birden fazla seçeneği işaretleyebilirsin)</T>
          <T style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', lineHeight: 16.5, marginBottom: 16 }}>İhbarda bulunduğunda konumun emniyet birimleriyle paylaşılır ve talebin çözülene kadar ekibimiz tarafından takip edilir.</T>
          {locError === 'denied' && warn('⚠ Konuma erişim engellendi. Ayarlar → Ahenk → Konum bölümünden konum iznini ver, ardından tekrar dene.')}
          {locError === 'off' && warn('⚠ Cihaz konumu kapalı. Konum servisini açtıktan sonra tekrar dene.')}
          {!!error && (
            <View style={{ padding: 10, paddingHorizontal: 12, backgroundColor: 'rgba(192,57,43,0.12)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.5)', borderRadius: 8, marginBottom: 12 }}>
              <T style={{ fontSize: 11.5, color: tw.accent, lineHeight: 17.25 }}>⚠ Talep gönderilemedi: {error}</T>
            </View>
          )}
          <Pressable onPress={() => setAccepted(a => !a)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
            <View style={{ marginTop: 2, width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: accepted ? c.red : 'rgba(255,255,255,0.4)', backgroundColor: accepted ? c.red : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {accepted && <T w={700} style={{ fontSize: 10, color: '#fff' }}>✓</T>}
            </View>
            <T style={{ flex: 1, fontSize: 11.5, color: 'rgba(255,255,255,0.75)', lineHeight: 17.25 }}>Acil yardım talebimin sahte olmadığını ve ihbardan kaynaklı doğacak tüm yasal sorumluluğu kabul ediyorum.</T>
          </Pressable>
          <Btn variant="sosSubmit" onPress={onConfirm} disabled={!can} label={loading ? 'Konum alınıyor…' : error ? 'Tekrar dene' : 'İhbarda Bulun'} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Lightbox({ photos, start, onClose }: { photos: VenuePhoto[]; start: number; onClose: () => void }) {
  const [idx, setIdx] = useState(start);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Image source={{ uri: photos[idx].url }} style={{ width: '90%', height: '75%', borderRadius: 12 }} resizeMode="contain" />
        {!!photos[idx].caption && <T style={{ color: c.tAaa, fontSize: 13, marginTop: 12 }}>{photos[idx].caption}</T>}
        {photos.length > 1 && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {photos.map((_, i) => <Pressable key={i} hitSlop={18} onPress={() => setIdx(i)} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === idx ? tw.text : 'rgba(255,255,255,0.25)' }} />)}
          </View>
        )}
        <Btn variant="lightboxClose" onPress={onClose} hitSlop={4} accessibilityLabel="Kapat" label="×" />
      </Pressable>
    </Modal>
  );
}

function AiReport({ report }: { report?: MasaDetayData['aiReport'] }) {
  return (
    <View style={{ backgroundColor: c.aiBg, borderWidth: 1, borderColor: c.aiBorder, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: c.aiIconBg, borderWidth: 1, borderColor: c.aiIconBorder, alignItems: 'center', justifyContent: 'center' }}><T style={{ fontSize: 16, lineHeight: 16 }}>✦</T></View>
        <T w={700} style={{ fontSize: 10, letterSpacing: 1.6, color: c.aiTitle }}>YAPAY ZEKA MASA RAPORU</T>
      </View>
      <View style={{ height: 1, backgroundColor: c.aiDivider, marginBottom: 12 }} />
      <View style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <T w={600} style={{ fontSize: 10, letterSpacing: 1.2, color: report ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.88)' }}>UYUM SKORU</T>
          <T w={700} style={{ fontSize: 14, color: c.tF0 }}>%{report ? report.uyumSkoru : '—'}</T>
        </View>
        <View style={{ height: 5, borderRadius: 99, backgroundColor: report ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          {report && <LinearGradient colors={['#4fc3f7', '#f48fb1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: '100%', width: `${report.uyumSkoru}%`, borderRadius: 99 }} />}
        </View>
      </View>
      {report && <T style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 21.45 }}>{report.content}</T>}
    </View>
  );
}

function MasaDetayKartiInner({ masa, archive = false }: { masa: MasaDetayData; archive?: boolean }) {
  const live = !archive;
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [onMyWayDone, setOnMyWayDone] = useState(false);
  const [onMyWayLoading, setOnMyWayLoading] = useState(false);
  const [onMyWayWarn, setOnMyWayWarn] = useState('');
  const opensAt = new Date(masa.scheduledAt).getTime() - 60 * 60 * 1000;
  const [onMyWayOpen, setOnMyWayOpen] = useState(() => Date.now() >= opensAt);
  useEffect(() => { if (onMyWayOpen) return; const id = setInterval(() => { if (Date.now() >= opensAt) setOnMyWayOpen(true); }, 15000); return () => clearInterval(id); }, [onMyWayOpen, opensAt]);

  const isOneOnOne = masa.type === 'ONE_ON_ONE';
  const photos = masa.venuePhotos ?? [];
  const ordered = buildOrdered(masa.participants);
  const hasMap = !!(masa.venueMapsUrl || masa.venueAddress);

  async function onMyWay() {
    if (!live || onMyWayDone || onMyWayLoading) return;
    if (!onMyWayOpen) { setOnMyWayWarn('Yola çıkış bildirimi, buluşma saatinden 1 saat önce kullanıma açılır.'); setTimeout(() => setOnMyWayWarn(''), 4000); return; }
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

  async function handleSos() {
    if (threats.length === 0 || sosLoading) return;
    setSosLoading(true); setLocError(null); setSosError('');
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) { setLocError('off'); return; }
      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { setLocError('denied'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      try {
        const r = await api.post<{ reportId: string }>(`/sos/${masa.id}/report`, { threats, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setSosDone(true); setShowSos(false);
        if (r?.reportId) startSosLive(r.reportId).catch(() => {});
      } catch (e) {
        const m = (e as Error).message;
        setSosError(m === '__rate_limit__' ? 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar dene.' : m || 'Sunucu hatası. Lütfen tekrar dene.');
      }
    } catch { setLocError('off'); }
    finally { setSosLoading(false); }
  }

  return (
    <View>
      {lightbox !== null && <Lightbox photos={photos} start={lightbox} onClose={() => setLightbox(null)} />}
      {showSos && <SosModal selected={threats} onToggle={t => setThreats(p => (p.includes(t) ? p.filter(x => x !== t) : [...p, t]))} onConfirm={handleSos}
        onClose={() => { setShowSos(false); setLocError(null); setSosError(''); setThreats([]); }} loading={sosLoading} locError={locError} error={sosError} />}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: GREEN }} />
        <T w={700} style={{ fontSize: 10, color: GREEN, letterSpacing: 1.8 }}>MASA DETAYI</T>
      </View>
      <Serif style={{ fontSize: 26, lineHeight: 31.2, color: tw.text, letterSpacing: 0.26, marginBottom: masa.venueAddress ? 4 : 16 }}>{masa.venueName}</Serif>
      {!!masa.venueAddress && <T style={{ marginBottom: 16, fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 18.2 }}>{masa.venueAddress}</T>}

      {photos.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
          {photos.slice(0, 3).map((p, i) => (
            <Pressable key={i} onPress={() => setLightbox(i)} style={{ flex: 1, aspectRatio: 4 / 3, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)', maxWidth: photos.length === 1 ? '100%' : undefined }}>
              <Image source={{ uri: p.url }} style={{ width: '100%', height: '100%' }} accessibilityLabel={p.caption ?? `Fotoğraf ${i + 1}`} />
            </Pressable>
          ))}
        </View>
      )}

      {hasMap && (
        <View style={{ marginBottom: 18 }}>
          <BtnPrimary label="HARİTADA GÖR" full onPress={() => openMaps(masa.venueMapsUrl, masa.venueAddress, masa.venueName)} />
        </View>
      )}

      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 16 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: GREEN }} />
          <T style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)' }}>Buluşma</T>
        </View>
        <T w={700} style={{ fontSize: 15, letterSpacing: 0.15 }}>{formatMeetingTime(masa.scheduledAt)}</T>
      </View>

      <View style={{ marginBottom: 20 }}>
        <T w={700} style={{ marginBottom: 12, fontSize: 9, letterSpacing: 1.26 }}>{isOneOnOne ? 'BAŞ BAŞA' : 'KATILIMCILAR'}</T>
        {masa.type === 'KANKA' ? (
          <KankaPairs mine={masa.participants.filter(p => p.pair === 'MINE') as KankaPerson[]} other={masa.participants.filter(p => p.pair === 'OTHER') as KankaPerson[]} />
        ) : (
          <View style={isOneOnOne ? { flexDirection: 'row', gap: 10, flexWrap: 'wrap' } : { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: 48 * 4 + 30 }}>
            {ordered.map((p, i) => <DetayAvatar key={`${p.initials}-${i}`} participant={p} delay={0.52 + i * 0.1} />)}
          </View>
        )}
      </View>

      <AiReport report={masa.aiReport} />

      <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16 }}>
        <T style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 19.2 }}>Rezervasyonunuz tamamlandı. Girişte görevliye isminizi söylediğinizde masanıza yönlendirileceksiniz. İyi eğlenceler.</T>
      </View>

      <View style={{ marginBottom: 10 }}>
        {onMyWayDone ? (
          <Btn variant="doneGreen" disabled style={{ opacity: 1 }} label="✓ Yola çıktığını bildirdin" />
        ) : (
          <BtnPrimary label={onMyWayLoading ? 'Bildiriliyor…' : 'Yola Çıktım'} full disabled={archive || onMyWayLoading} onPress={onMyWay} />
        )}
        {!!onMyWayWarn && (
          <View accessibilityRole="alert" style={{ marginTop: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 }}>
            <T style={{ fontSize: 12, color: c.warnOrange, lineHeight: 19.2 }}>{onMyWayWarn}</T>
          </View>
        )}
      </View>

      {live && <ChatSection meetingId={masa.id} type={masa.type} />}
      {live && <NoShowSection meetingId={masa.id} />}

      {sosVisible && (
        <View style={{ marginTop: 24 }}>
          {sosDone ? (
            <View style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(192,57,43,0.12)', borderWidth: 1.5, borderColor: 'rgba(192,57,43,0.5)', alignItems: 'center' }}>
              <T w={700} style={{ fontSize: 13, color: tw.accent }}>ACİL YARDIM TALEBİNİZ ALINDI</T>
              <T style={{ marginTop: 4, fontSize: 12, color: 'rgba(255,107,107,0.7)' }}>Sakin olun ve güvende kalmaya çalışın.</T>
            </View>
          ) : (
            <>
              <Btn variant="sos" onPress={() => setShowSos(true)} label="Acil Yardım" />
              <View style={{ marginTop: 10, padding: 10, paddingHorizontal: 12, backgroundColor: 'rgba(192,57,43,0.07)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.22)', borderRadius: 8 }}>
                <T style={{ fontSize: 10.5, lineHeight: 16.275, color: 'rgba(255,107,107,0.65)' }}>
                  Masada veya masadan sonrasında, masadaki birisi tarafından fiziksel şiddet, alıkoyulma, taciz veya istismar eylemiyle karşı karşıya kalırsan ya da kalma ihtimali yaşarsan hemen butona bas ve eylemin türünü seçerek onayla. İhbarda bulunduğunda konumun emniyet birimleriyle paylaşılır ve talebin çözülene kadar ekibimiz tarafından takip edilir. Masadaki kişilerin kimlik bilgileri de emniyet birimleriyle anında paylaşılır. <T w={700} style={{ fontSize: 10.5, color: 'rgba(255,107,107,0.85)' }}>Güvenliğin bizim için çok önemli.</T>
                </T>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}


// Web karşılığı yalnız satır içi stil: satır yüksekliği her boyutta 1.5×
export function MasaDetayKarti(props: React.ComponentProps<typeof MasaDetayKartiInner>) { return <InlineLH><MasaDetayKartiInner {...props} /></InlineLH>; }
