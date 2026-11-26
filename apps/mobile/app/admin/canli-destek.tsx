// apps/web/app/admin/canli-destek/page.tsx karşılığı. Temsilci (SUPPORT), ADMIN ve SUPERADMIN görür.
// Sohbetler: liste → sohbet ekranı; sohbet ekranında "Haiku" butonu alttan yarım ekran Haiku panelini açar (HIG sheet: dışına basınca,
// Android geri tuşuyla kapanır). Hazır Yanıtlar ve Raporlar: ADMIN + SUPERADMIN. Tüm Sohbetler, Temsilciler, Kısıtlamalar, Haiku Kayıtları: SUPERADMIN.
// Yeni sohbet atanınca ve uygulama dışındayken yeni mesaj gelince push (backend). Temsilci kullanıcı hakkında Haiku dışında veri görmez.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api';
import { API_PREFIX } from '@/lib/config';
import { getAccess } from '@/lib/session';
import { myRole } from '@/lib/adminRole';
import { pickFromLibrary, type PickedImage } from '@/lib/imagePick';
import { ChatComposer, StatusPill, SUPPORT_EMOJIS } from '@/components/SupportChatParts';
import { DetayAvatar } from '@/components/DetayAvatar';
import { AConfirm } from '@/components/admin/AConfirm';
import { ACard, AError, ALabel, AMono, APage, AT } from '@/components/admin/AdminUi';
import { adm, onb, sans } from '@/theme/theme';

// Mekân sahibi avatarı: Nasıl Çalışır 3 aylık kutu altını (onb.primeBorder #e0a526) çerçeve + aynı altının cinsiyet zemini gibi hafif tonu
const VENUE_RING = { color: onb.primeBorder, bg: 'rgba(224,165,38,0.12)' };

type Sender = 'USER' | 'AGENT' | 'SYSTEM';
// Kullanıcı avatarı (Masa Kuruldu DetayAvatar): onaylı fotoğraf ya da baş harfler, cinsiyet renkli çerçeve; mekânda cinsiyet / foto yok
interface Avatar { initials: string; gender: string | null; photoUrl: string | null }
interface Row { id: string; status: string; topic: string; requesterName: string; kind: 'user' | 'venue'; avatar: Avatar | null; queuedAt: string; agentNo: string | null; unread: number }
interface AgentState { me: { userId: string; role: string; agentNo: string; status: 'ONLINE' | 'BREAK' | 'OFFLINE' }; maxChats: number; queue: Row[]; mine: Row[]; others: Row[]; onlineAgents: { userId: string; agentNo: string }[] }
interface Msg { id: string; sender: Sender; agentNo: string | null; content: string; images: string[]; createdAt: string }
interface ChatDetail {
  id: string; status: string; topic: string; requesterName: string; kind: 'user' | 'venue'; avatar?: Avatar | null; queuedAt: string; agentNo: string | null; mine: boolean; takenOver?: boolean;
  closedAt: string | null; userReadAt: string | null; userTyping: boolean; userOnline: boolean; userDraft: string; messages: Msg[];
  notes: { id: string; agentNo: string; content: string; createdAt: string }[];
  transfers: { id: string; from: string | null; to: string | null; note: string; createdAt: string }[];
}
interface Canned { id: string; title: string; content: string }
// Haiku sorgu kaydı: istek türü, sonuç ve hata türü (başarısız istekler de yazılır)
interface AiLog { id: string; agentNo: string; chatId?: string; question: string; tools: string[]; requestType: string; success: boolean; errorType: string | null; createdAt: string }
const AI_TYPE: Record<string, string> = { QUESTION: 'Soru', DRAFT: 'AI taslak' };
const AI_ERROR: Record<string, string> = { NO_KEY: 'anahtar yok', TIMEOUT: 'zaman aşımı', MODEL_ERROR: 'model hatası', CONNECTION_ERROR: 'bağlantı hatası', INTERNAL_ERROR: 'sunucu hatası' };
const aiResult = (l: { success: boolean; errorType: string | null }) => (l.success ? 'Başarılı' : `Başarısız${l.errorType ? ` · ${AI_ERROR[l.errorType] ?? l.errorType}` : ''}`);

const TOPIC: Record<string, string> = { ACCOUNT: 'Hesap', PAYMENT: 'Ödeme', MEETING: 'Masa', OTHER: 'Diğer' };
const STATUS: [AgentState['me']['status'], string, string][] = [['ONLINE', 'Çevrimiçi', adm.green], ['BREAK', 'Mola', adm.amber], ['OFFLINE', 'Çevrimdışı', adm.muted]];
const SYS: Record<string, string> = {
  NOTICE: "Hizmet kalitesinin artırılması ve güvenliğin için görüşmelerimiz kayıt altına alınır. Kişisel verilerinle ilgili Aydınlatma Metni'ni inceleyebilirsin.",
  GREETING: 'Merhaba, ben Ahenk müşteri temsilcisiyim. Bugün size yardımcı olmaktan mutluluk duyacağım.',
  TRANSFERRED: 'Görüşmen başka bir temsilcimize aktarıldı, durumu baştan anlatmana gerek yok.',
  IDLE_WARNING: '1 dakika içinde yanıt vermezsen sohbet sonlanacak.',
};
const TAKEN_OVER = 'Bu sohbet SUPERADMIN tarafından devralındı.';
const hm = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
const dt = (iso: string) => new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
function waited(iso: string) { const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000)); return s < 60 ? `${s} sn` : s < 3600 ? `${Math.floor(s / 60)} dk` : `${Math.floor(s / 3600)} sa ${Math.floor((s % 3600) / 60)} dk`; }
const fmtMin = (n: number | null) => (n === null ? '—' : `${n.toFixed(1)} dk`);
const input = { backgroundColor: adm.bg, borderWidth: 1, borderColor: adm.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: adm.text, fontFamily: sans(400), minHeight: 44 } as const;

function SmallBtn({ label, color, filled, onPress, disabled }: { label: string; color: string; filled?: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: color, backgroundColor: filled ? color : 'transparent', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}>
      <AT w={600} style={{ fontSize: 12, color: filled ? adm.bg : color }}>{label}</AT>
    </Pressable>
  );
}

type Tab = 'chats' | 'all' | 'canned' | 'reports' | 'agents' | 'restrictions' | 'ai';

export default function AdminCanliDestek() {
  const role = myRole();
  const tabs: [Tab, string][] = [
    ['chats', 'Sohbetler'],
    ...(role === 'SUPERADMIN' ? ([['all', 'Tüm Sohbetler']] as [Tab, string][]) : []),
    ...(role === 'ADMIN' || role === 'SUPERADMIN' ? ([['canned', 'Hazır Yanıtlar'], ['reports', 'Raporlar']] as [Tab, string][]) : []),
    ...(role === 'SUPERADMIN' ? ([['agents', 'Temsilciler'], ['restrictions', 'Kısıtlamalar'], ['ai', 'Haiku Kayıtları']] as [Tab, string][]) : []),
  ];
  const [tab, setTab] = useState<Tab>('chats');
  const [chatId, setChatId] = useState<string | null>(null);
  const [allId, setAllId] = useState<string | null>(null);
  if (tab === 'chats' && chatId) return <ChatScreen id={chatId} onBack={() => setChatId(null)} />;
  if (tab === 'all' && allId) return <AllChatDetailView id={allId} onBack={() => setAllId(null)} />;
  return (
    <APage>
      <AT w={700} style={{ fontSize: 20, marginBottom: 12 }}>Canlı Destek</AT>
      {tabs.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
          {tabs.map(([k, l]) => <SmallBtn key={k} label={l} color={adm.cyan} filled={tab === k} onPress={() => setTab(k)} />)}
        </ScrollView>
      )}
      {tab === 'chats' && <ChatList onOpen={setChatId} />}
      {tab === 'all' && <AllChatsTab onOpen={setAllId} />}
      {tab === 'canned' && <CannedTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'agents' && <AgentsTab />}
      {tab === 'restrictions' && <RestrictionsTab />}
      {tab === 'ai' && <AiLogsTab />}
    </APage>
  );
}

function ChatList({ onOpen }: { onOpen: (id: string) => void }) {
  const [st, setSt] = useState<AgentState | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => { api.get<AgentState>('/admin/live-support/state').then((s) => { setSt(s); setErr(''); }).catch((e: Error) => setErr(e.message)); }, []);
  useFocusEffect(useCallback(() => { load(); const id = setInterval(load, 3000); return () => clearInterval(id); }, [load]));
  async function setStatus(status: AgentState['me']['status']) { try { await api.patch('/admin/live-support/status', { status }); load(); } catch (e) { setErr((e as Error).message); } }
  if (!st) return err ? <AError>{err}</AError> : <AT style={{ color: adm.muted }}>Yükleniyor…</AT>;
  const list = (title: string, rows: Row[], showAgent = false) => (
    <View style={{ marginBottom: 14 }}>
      <ALabel style={{ marginBottom: 6 }}>{title} ({rows.length})</ALabel>
      {rows.length === 0 && <AT style={{ fontSize: 12, color: adm.muted }}>—</AT>}
      {rows.map((r) => (
        <Pressable key={r.id} onPress={() => onOpen(r.id)} accessibilityRole="button"
          style={({ pressed }) => ({ minHeight: 44, marginBottom: 6, padding: 10, borderRadius: 10, backgroundColor: adm.card, borderWidth: 1, borderColor: adm.border, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <DetayAvatar ring={r.kind === 'venue' ? VENUE_RING : undefined} participant={r.avatar ?? {}} size={36} />
            <AT w={600} style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>{r.requesterName}</AT>
            {r.unread > 0 && <AT w={700} style={{ fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: adm.red, color: '#fff', overflow: 'hidden' }}>{r.unread}</AT>}
          </View>
          <AT style={{ fontSize: 11, color: adm.muted, marginTop: 4 }}>{TOPIC[r.topic]} · {r.kind === 'venue' ? 'Mekân' : 'Üye'} · {waited(r.queuedAt)}{showAgent && r.agentNo ? ` · Temsilci No ${r.agentNo}` : ''}</AT>
        </Pressable>
      ))}
    </View>
  );
  return (
    <View>
      <ACard style={{ marginBottom: 12, gap: 10 }}>
        <AT style={{ fontSize: 13 }}>Temsilci No: <AMono w={600}>{st.me.agentNo}</AMono> · Eşzamanlı sınır: {st.maxChats}</AT>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {STATUS.map(([k, l, c]) => <SmallBtn key={k} label={l} color={c} filled={st.me.status === k} onPress={() => setStatus(k)} />)}
        </View>
      </ACard>
      {!!err && <AError>{err}</AError>}
      {list('Sıradakiler', st.queue)}
      {list('Açık Sohbetlerim', st.mine)}
      {/* ADMIN salt okunur izler, SUPERADMIN devralabilir */}
      {(st.me.role === 'SUPERADMIN' || st.me.role === 'ADMIN') && list('Diğer Açık Sohbetler', st.others, true)}
    </View>
  );
}

function ChatScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [c, setC] = useState<ChatDetail | null>(null);
  const [st, setSt] = useState<AgentState | null>(null);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<PickedImage[]>([]);
  const [canned, setCanned] = useState<Canned[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [haiku, setHaiku] = useState(false);
  const [extra, setExtra] = useState(false);
  // Onay penceresi: 0 = Sonlandır, 1 / 7 / 30 = kötüye kullanım gün sayısı; null = kapalı
  const [confirm, setConfirm] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [viewer, setViewer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const typingAt = useRef(0);
  const [emoji, setEmoji] = useState(false);

  const loaded = useRef(false);
  const back = useRef(onBack);
  back.current = onBack;
  // SUPERADMIN devraldıysa: Temsilci (SUPPORT) yalnız { takenOver: true } alır, elindeki son hâl salt okunur kalır (403 gösterilmez);
  // sohbet ilk açılışta zaten devralınmışsa ekran kapanır (sohbet hiçbir listede olmadığından yeniden açılamaz)
  const load = useCallback(() => {
    api.get<ChatDetail | { id: string; takenOver: true }>(`/admin/live-support/chats/${id}`).then((d) => {
      if (!('messages' in d)) {
        if (!loaded.current) { back.current(); return; }
        setC((p) => (p ? { ...p, mine: false, takenOver: true, userTyping: false, userDraft: '' } : p));
      } else { loaded.current = true; setC(d); }
      setErr('');
    }).catch((e: Error) => setErr(e.message));
    api.get<AgentState>('/admin/live-support/state').then(setSt).catch(() => {});
  }, [id]);
  useFocusEffect(useCallback(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [load]));
  useEffect(() => { getAccess().then(setToken); api.get<Canned[]>('/admin/live-support/canned').then(setCanned).catch(() => {}); }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (viewer) setViewer(null); else if (haiku) setHaiku(false); else onBack(); return true; });
    return () => sub.remove();
  }, [viewer, haiku, onBack]);

  if (!c) return <APage>{err ? <AError>{err}</AError> : <AT style={{ color: adm.muted }}>Yükleniyor…</AT>}</APage>;
  const open = c.status === 'ACTIVE' || c.status === 'QUEUED';
  const canWrite = c.mine && c.status === 'ACTIVE';
  const superadmin = st?.me.role === 'SUPERADMIN';
  const slash = text.startsWith('/') ? canned.filter((x) => x.title.toLocaleLowerCase('tr').includes(text.slice(1).toLocaleLowerCase('tr'))) : [];
  const img = (f: string) => ({ uri: `${API_PREFIX}/admin/live-support/chats/${id}/images/${f}`, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  const act = async (fn: () => Promise<unknown>, after?: () => void) => { setErr(''); try { await fn(); after?.(); load(); } catch (e) { setErr((e as Error).message); } };

  function onType(v: string) {
    setText(v.slice(0, 2000));
    if (canWrite && Date.now() - typingAt.current > 1500) { typingAt.current = Date.now(); api.post(`/admin/live-support/chats/${id}/typing`, {}).catch(() => undefined); }
  }
  async function pick() {
    const left = 3 - files.length;
    if (left <= 0) { setErr('Bir mesajda en fazla 3 görsel gönderilebilir.'); return; }
    const r = await pickFromLibrary(left);
    if (!Array.isArray(r)) return;
    const ok = r.filter((f) => ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(f.type.toLowerCase()) && (!f.size || f.size <= 5 * 1024 * 1024));
    if (ok.length < r.length) setErr('Yalnız JPG, PNG ve WebP, en fazla 5 MB görseller gönderilebilir.');
    setFiles((p) => [...p, ...ok].slice(0, 3));
  }
  async function send() {
    if ((!text.trim() && !files.length) || busy) return;
    setBusy(true); setErr('');
    const fd = new FormData();
    if (text.trim()) fd.append('content', text.trim());
    files.forEach((f) => fd.append('images', { uri: f.uri, name: f.name, type: f.type } as unknown as Blob));
    try { await api.form(`/admin/live-support/chats/${id}/messages`, fd); setText(''); setFiles([]); load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  // Okundu: yalnız temsilci mesajlarından kullanıcının okuduğu sonuncusunun altında
  const readId = c.userReadAt ? [...c.messages].reverse().find((m) => m.sender === 'AGENT' && m.createdAt <= c.userReadAt!)?.id : undefined;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: adm.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + adm.headerH : 0}>
      <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: adm.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Geri" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><AT style={{ fontSize: 20 }}>‹</AT></Pressable>
        {c.avatar !== undefined && <DetayAvatar ring={c.kind === 'venue' ? VENUE_RING : undefined} participant={c.avatar ?? {}} size={40} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <AT w={700} style={{ fontSize: 14 }} numberOfLines={1}>{c.requesterName}</AT>
          <AT style={{ fontSize: 11, color: adm.muted }} numberOfLines={1}>{TOPIC[c.topic]} · {c.kind === 'venue' ? 'Mekân' : 'Üye'} · {waited(c.queuedAt)}{c.agentNo ? ` · No ${c.agentNo}` : ''}</AT>
          {open && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <StatusPill status={c.userTyping ? 'typing' : c.userOnline ? 'online' : 'offline'} label={c.userTyping ? 'yazıyor…' : c.userOnline ? 'Çevrimiçi' : 'Çevrimdışı'} />
              {((!c.mine && st?.me.role === 'ADMIN') || !!c.takenOver) && <AT style={{ fontSize: 11, color: adm.muted }}>salt okunur</AT>}
            </View>
          )}
        </View>
        {/* Devralınan sohbette Haiku asistanı, iç not ve işlemler kapalı */}
        {!c.takenOver && <SmallBtn label="Haiku" color={adm.cyan} onPress={() => setHaiku(true)} />}
        {!c.takenOver && <SmallBtn label="⋯" color={adm.muted} onPress={() => setExtra((v) => !v)} />}
      </View>
      {extra && !c.takenOver && (
        <ScrollView style={{ maxHeight: 300, borderBottomWidth: 1, borderBottomColor: adm.border }} contentContainerStyle={{ padding: 12, gap: 8 }} keyboardShouldPersistTaps="handled">
          {/* Web temsilci başlığıyla aynı sıra: Devral / Sonlandır / Kötüye kullanım alt alta */}
          <View style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
            {open && !c.mine && superadmin && <SmallBtn label="Devral" color={adm.blue} onPress={() => act(() => api.post(`/admin/live-support/chats/${id}/take`, {}))} />}
            {open && (c.mine || superadmin) && <SmallBtn label="Sonlandır" color={adm.muted} onPress={() => setConfirm(0)} />}
            {open && (c.mine || superadmin) && [1, 7, 30].map((d) => <SmallBtn key={d} label={`Kötüye kullanım · ${d} gün`} color={adm.red} onPress={() => setConfirm(d)} />)}
          </View>
          <ALabel>İÇ NOTLAR ({c.notes.length}) · DEVİRLER ({c.transfers.length})</ALabel>
          {c.transfers.map((x) => <AT key={x.id} style={{ fontSize: 12, color: adm.amber }}>Devir {x.from ?? '—'} → {x.to ?? '—'} · {dt(x.createdAt)}: {x.note}</AT>)}
          {c.notes.map((n) => <AT key={n.id} style={{ fontSize: 12 }}>No {n.agentNo} · {dt(n.createdAt)}: {n.content}</AT>)}
          {(c.mine || superadmin) && <View style={{ flexDirection: 'row', gap: 6 }}>
            <TextInput value={note} onChangeText={setNote} placeholder="İç not ekle" placeholderTextColor={adm.muted} style={[input, { flex: 1 }]} keyboardAppearance="dark" />
            <SmallBtn label="Ekle" color={adm.blue} onPress={() => note.trim() && act(() => api.post(`/admin/live-support/chats/${id}/notes`, { content: note.trim() }), () => setNote(''))} />
          </View>}
          {canWrite && !!st && (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {st.onlineAgents.length === 0 && <AT style={{ fontSize: 12, color: adm.muted }}>Devredilecek çevrimiçi temsilci yok.</AT>}
                {st.onlineAgents.map((a) => <SmallBtn key={a.userId} label={`No ${a.agentNo}`} color={adm.amber} filled={transferTo === a.userId} onPress={() => setTransferTo(a.userId)} />)}
              </View>
              <TextInput value={transferNote} onChangeText={setTransferNote} placeholder="Devir notu (zorunlu)" placeholderTextColor={adm.muted} style={input} keyboardAppearance="dark" />
              <SmallBtn label="Devret" color={adm.amber} disabled={!transferTo || !transferNote.trim()} onPress={() => act(() => api.post(`/admin/live-support/chats/${id}/transfer`, { toAgentId: transferTo, note: transferNote.trim() }), onBack)} />
            </View>
          )}
        </ScrollView>
      )}
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 8 }} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {!open && <AT style={{ fontSize: 12, color: adm.muted }}>Sohbet kapandı{c.closedAt ? ` (${dt(c.closedAt)})` : ''}.</AT>}
        {c.messages.map((m) => {
          if (m.sender === 'SYSTEM' && m.content !== 'GREETING') return <AT key={m.id} style={{ alignSelf: 'center', textAlign: 'center', fontSize: 11, color: adm.muted }}>{SYS[m.content] ?? m.content} · {hm(m.createdAt)}</AT>;
          const user = m.sender === 'USER';
          return (
            <View key={m.id}>
            <View style={{ alignSelf: user ? 'flex-start' : 'flex-end', maxWidth: '82%', padding: 8, borderRadius: 12, backgroundColor: user ? adm.card : 'rgba(59,130,246,0.14)', borderWidth: 1, borderColor: user ? adm.border : 'rgba(59,130,246,0.35)' }}>
              {m.images.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {m.images.map((f) => <Pressable key={f} onPress={() => setViewer(f)} accessibilityRole="imagebutton" accessibilityLabel="Görsel"><Image source={img(f)} style={{ width: 100, height: 100, borderRadius: 8 }} /></Pressable>)}
                </View>
              )}
              {(!!m.content || m.sender === 'SYSTEM') && <AT style={{ fontSize: 13, lineHeight: 19 }}>{m.sender === 'SYSTEM' ? SYS.GREETING : m.content}</AT>}
              <AT style={{ alignSelf: 'flex-end', fontSize: 10, color: adm.muted, marginTop: 2 }}>{!user && m.agentNo ? `No ${m.agentNo} · ` : ''}{hm(m.createdAt)}</AT>
            </View>
            {m.id === readId && <AT style={{ alignSelf: 'flex-end', fontSize: 10, color: adm.muted, marginTop: 2 }}>Okundu</AT>}
            </View>
          );
        })}
        {/* Yazı önizlemesi: kullanıcının gönderilmemiş metni (sunucuda yalnız bellekte) */}
        {c.userTyping && <AT style={{ fontSize: 12, color: adm.amber, fontStyle: 'italic' }}>yazıyor…{c.userDraft ? ` “${c.userDraft}”` : ''}</AT>}
        {c.takenOver && (
          <View accessibilityRole="text" style={{ alignSelf: 'center', marginTop: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' }}>
            <AT style={{ fontSize: 12, color: adm.amber, textAlign: 'center' }}>{TAKEN_OVER}</AT>
          </View>
        )}
      </ScrollView>
      {!!err && <View style={{ paddingHorizontal: 12 }}><AError>{err}</AError></View>}
      {canWrite && (
        <View style={{ borderTopWidth: 1, borderTopColor: adm.border, padding: 8, paddingBottom: 8 + insets.bottom, gap: 6 }}>
          {slash.length > 0 && (
            <ScrollView style={{ maxHeight: 180, borderWidth: 1, borderColor: adm.border, borderRadius: 8 }} keyboardShouldPersistTaps="handled">
              {slash.map((x) => (
                <Pressable key={x.id} onPress={() => setText(x.content)} style={{ minHeight: 44, padding: 10, borderBottomWidth: 1, borderBottomColor: adm.border }}>
                  <AT w={600} style={{ fontSize: 12 }}>{x.title}</AT>
                  <AT style={{ fontSize: 11, color: adm.muted }} numberOfLines={1}>{x.content}</AT>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {files.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {files.map((f, i) => <Pressable key={f.uri} onPress={() => setFiles((p) => p.filter((_, j) => j !== i))} accessibilityLabel="Görseli kaldır"><Image source={{ uri: f.uri }} style={{ width: 48, height: 48, borderRadius: 6 }} /></Pressable>)}
            </View>
          )}
          {emoji && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {SUPPORT_EMOJIS.map((e) => (
                <Pressable key={e} onPress={() => onType((text + e).slice(0, 2000))} accessibilityRole="button" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <AT style={{ fontSize: 22 }}>{e}</AT>
                </Pressable>
              ))}
            </View>
          )}
          {/* Mesaj kutusu: kullanıcı ekranıyla aynı düzen (dosya, emoji, yazı alanı, gönder ikonu) */}
          <ChatComposer value={text} onChangeText={onType} textColor={adm.text}
            onAttach={pick} onEmoji={() => setEmoji((v) => !v)} onSend={() => { setEmoji(false); send(); }} sendDisabled={busy || (!text.trim() && !files.length)}
            labels={{ attach: 'Görsel ekle', emoji: 'Emoji', send: 'Gönder' }} boxBg={adm.bg} boxBorder={adm.border} />
        </View>
      )}
      <AConfirm visible={confirm !== null}
        text={confirm ? `${confirm} gün kısıtlama vermek istediğinden emin misin?` : 'Görüşmeyi sonlandırmak istediğinden emin misin?'}
        onNo={() => setConfirm(null)}
        onYes={() => { const d = confirm; setConfirm(null); act(() => api.post(`/admin/live-support/chats/${id}/close`, d ? { abuseDays: d } : {}), onBack); }} />
      <HaikuSheet visible={haiku && !c.takenOver} chatId={id} onClose={() => setHaiku(false)} onInsert={(t) => { setText((v) => (v ? `${v}\n` : '') + t); setHaiku(false); }} />
      <Modal visible={!!viewer} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewer(null)}>
        <Pressable onPress={() => setViewer(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
          {!!viewer && <Image source={img(viewer)} resizeMode="contain" style={{ width: '94%', height: '85%' }} accessibilityLabel="Görsel" />}
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// Haiku paneli: alttan yarım ekran; yalnız okur, mesajı temsilci gönderir ("Sohbete ekle" metni mesaj kutusuna koyar)
function HaikuSheet({ visible, chatId, onClose, onInsert }: { visible: boolean; chatId: string; onClose: () => void; onInsert: (t: string) => void }) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [images, setImages] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [items, setItems] = useState<{ q: string; a: string }[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  // Kopyala: yalnız panoya yazar; kısa onay (buton metni + hafif dokunsal geri bildirim + ekran okuyucu duyurusu). Hiçbir yere kaydedilmez
  function copy(i: number, text: string) {
    Clipboard.setStringAsync(text).then(() => {
      setCopied(i);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      AccessibilityInfo.announceForAccessibility('Kopyalandı');
      setTimeout(() => setCopied((v) => (v === i ? null : v)), 1500);
    }).catch(() => {});
  }
  async function run(draft: boolean) {
    if (busy || (!draft && !q.trim())) return;
    setBusy(true); setErr('');
    try {
      const r = await api.post<{ answer: string }>(`/admin/live-support/chats/${chatId}/ai`, { question: draft ? undefined : q.trim(), draft, includeImages: images });
      setItems((p) => [{ q: draft ? 'Taslak cevap' : q.trim(), a: r.answer }, ...p]); setCopied(null);
      if (!draft) setQ('');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} accessibilityLabel="Kapat" />
        <View style={{ height: '50%', backgroundColor: adm.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, borderColor: adm.border, paddingBottom: insets.bottom }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8 }}>
            <ALabel style={{ color: adm.cyan }}>HAIKU ASİSTANI</ALabel>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Kapat" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><AT style={{ fontSize: 18, color: adm.muted }}>✕</AT></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }} keyboardShouldPersistTaps="handled">
            <AT style={{ fontSize: 11, color: adm.muted }}>Yalnız bu sohbetin hesabını okur; veri değiştirmez, kullanıcıya mesaj göndermez.</AT>
            <TextInput value={q} onChangeText={setQ} multiline placeholder="Haiku'ya sor" placeholderTextColor={adm.muted} keyboardAppearance="dark" style={[input, { minHeight: 64 }]} />
            <Pressable onPress={() => setImages((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: images }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: images ? adm.cyan : adm.muted, backgroundColor: images ? adm.cyan : 'transparent' }} />
              <AT style={{ fontSize: 12, color: adm.muted }}>Sohbetteki görselleri de oku</AT>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <SmallBtn label="Sor" color={adm.cyan} disabled={busy} onPress={() => run(false)} />
              <SmallBtn label="Taslak öner" color={adm.blue} disabled={busy} onPress={() => run(true)} />
            </View>
            {busy && <AT style={{ fontSize: 12, color: adm.muted }}>Haiku düşünüyor…</AT>}
            {!!err && <AError>{err}</AError>}
            {items.map((it, i) => (
              <ACard key={i} style={{ gap: 6 }}>
                <AT style={{ fontSize: 11, color: adm.muted }}>{it.q}</AT>
                <AT style={{ fontSize: 13, lineHeight: 19 }}>{it.a}</AT>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <SmallBtn label={copied === i ? 'Kopyalandı ✓' : 'Kopyala'} color={copied === i ? adm.green : adm.muted} onPress={() => copy(i, it.a)} />
                  <SmallBtn label="Sohbete ekle" color={adm.green} onPress={() => onInsert(it.a)} />
                </View>
              </ACard>
            ))}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Tüm Sohbetler (yalnız SUPERADMIN; web AllChatsTab karşılığı) ─────────────
// Açık, sıradaki ve kapanmış bütün sohbetler (üye + mekân); basınca tamamı: mesajlar, görseller, iç notlar, devirler, değerlendirme,
// Haiku sorgu kayıtları. Açık sohbette mevcut devralma (POST /admin/live-support/chats/:id/take).

interface AllRow { id: string; name: string; kind: 'user' | 'venue'; avatar: Avatar | null; topic: string; status: string; agentNo: string | null; startedAt: string; durationMin: number; stars: number | null }
interface AllDetail {
  id: string; name: string; requesterName: string; kind: 'user' | 'venue'; avatar: Avatar | null; topic: string; status: string; agentNo: string | null;
  startedAt: string; closedAt: string | null; closedBy: string | null; durationMin: number; messages: Msg[];
  notes: { id: string; agentNo: string; content: string; createdAt: string }[];
  transfers: { id: string; from: string | null; to: string | null; note: string; createdAt: string }[];
  rating: { helped: boolean; stars: number; tags: string[]; comment: string | null; createdAt: string } | null;
  aiLogs: AiLog[];
}
const CHAT_STATUS: Record<string, string> = { QUEUED: 'Sırada', ACTIVE: 'Açık', CLOSED: 'Kapandı' };
const CLOSED_BY: Record<string, string> = { USER: 'kullanıcı', AGENT: 'temsilci', AUTO: 'otomatik', ABUSE: 'kötüye kullanım' };
const dur = (m: number) => (m < 60 ? `${Math.max(0, Math.round(m))} dk` : `${Math.floor(m / 60)} sa ${Math.round(m % 60)} dk`);
const starsText = (n: number | null) => (n === null ? '—' : '★'.repeat(n) + '☆'.repeat(5 - n));
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function AllChatsTab({ onOpen }: { onOpen: (id: string) => void }) {
  const [f, setF] = useState({ from: '', to: '', status: '', topic: '', agentNo: '', kind: '', q: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; page: number; pages: number; rows: AllRow[] } | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    const p: Record<string, string> = { ...f, page: String(page) };
    if (!DAY_RE.test(p.from)) p.from = '';
    if (!DAY_RE.test(p.to)) p.to = '';
    const qs = Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    api.get<{ total: number; page: number; pages: number; rows: AllRow[] }>(`/admin/live-support/manage/chats?${qs}`).then((d) => { setData(d); setErr(''); }).catch((e: Error) => setErr(e.message));
  }, [f, page]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const set = (k: keyof typeof f, v: string) => { setF((p) => ({ ...p, [k]: v })); setPage(1); };
  const chips = (k: 'status' | 'topic' | 'kind', opts: [string, string][]) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {opts.map(([v, l]) => <SmallBtn key={v || 'all'} label={l} color={adm.cyan} filled={f[k] === v} onPress={() => set(k, v)} />)}
    </View>
  );
  return (
    <View style={{ gap: 10 }}>
      <ACard style={{ gap: 8 }}>
        <TextInput value={f.q} onChangeText={(v) => set('q', v)} placeholder="Ad soyad / mekân adı ara" placeholderTextColor={adm.muted} style={input} keyboardAppearance="dark" autoCorrect={false} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TextInput value={f.from} onChangeText={(v) => set('from', v.replace(/[^\d-]/g, '').slice(0, 10))} placeholder="Başlangıç YYYY-AA-GG" placeholderTextColor={adm.muted} style={[input, { flex: 1 }]} keyboardAppearance="dark" keyboardType="numbers-and-punctuation" />
          <TextInput value={f.to} onChangeText={(v) => set('to', v.replace(/[^\d-]/g, '').slice(0, 10))} placeholder="Bitiş YYYY-AA-GG" placeholderTextColor={adm.muted} style={[input, { flex: 1 }]} keyboardAppearance="dark" keyboardType="numbers-and-punctuation" />
        </View>
        <TextInput value={f.agentNo} onChangeText={(v) => set('agentNo', v.replace(/\D/g, '').slice(0, 5))} placeholder="Temsilci No" placeholderTextColor={adm.muted} style={input} keyboardAppearance="dark" keyboardType="number-pad" />
        {chips('status', [['', 'Tüm durumlar'], ...Object.entries(CHAT_STATUS)])}
        {chips('topic', [['', 'Tüm konular'], ...Object.entries(TOPIC)])}
        {chips('kind', [['', 'Üye + Mekân'], ['user', 'Üye'], ['venue', 'Mekân']])}
      </ACard>
      {!!err && <AError>{err}</AError>}
      {!data ? <AT style={{ color: adm.muted }}>Yükleniyor…</AT> : (
        <>
          <AT style={{ fontSize: 12, color: adm.muted }}>{data.total} sohbet</AT>
          {data.rows.map((r) => (
            <Pressable key={r.id} onPress={() => onOpen(r.id)} accessibilityRole="button" accessibilityLabel={r.name}
              style={({ pressed }) => ({ minHeight: 44, padding: 10, borderRadius: 10, backgroundColor: adm.card, borderWidth: 1, borderColor: adm.border, opacity: pressed ? 0.7 : 1, gap: 3 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <DetayAvatar ring={r.kind === 'venue' ? VENUE_RING : undefined} participant={r.avatar ?? {}} size={32} />
                <AT w={600} style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>{r.name}</AT>
                <AT style={{ fontSize: 12, color: r.status === 'CLOSED' ? adm.muted : r.status === 'ACTIVE' ? adm.green : adm.amber }}>{CHAT_STATUS[r.status] ?? r.status}</AT>
              </View>
              <AT style={{ fontSize: 11, color: adm.muted }}>{r.kind === 'venue' ? 'Mekân' : 'Üye'} · {TOPIC[r.topic]} · Temsilci No {r.agentNo ?? '—'}</AT>
              <AT style={{ fontSize: 11, color: adm.muted }}>{dt(r.startedAt)} · {dur(r.durationMin)} · <AT style={{ fontSize: 11, color: '#e0a526' }}>{starsText(r.stars)}</AT></AT>
            </Pressable>
          ))}
          {!data.rows.length && <AT style={{ fontSize: 12, color: adm.muted }}>Sohbet yok.</AT>}
          {data.pages > 1 && (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
              <SmallBtn label="← Önceki" color={adm.muted} disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
              <AT style={{ fontSize: 12, color: adm.muted }}>{data.page} / {data.pages}</AT>
              <SmallBtn label="Sonraki →" color={adm.muted} disabled={page >= data.pages} onPress={() => setPage((p) => p + 1)} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

function AllChatDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [c, setC] = useState<AllDetail | null>(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const load = useCallback(() => { api.get<AllDetail>(`/admin/live-support/manage/chats/${id}`).then((d) => { setC(d); setErr(''); }).catch((e: Error) => setErr(e.message)); }, [id]);
  useEffect(() => { load(); getAccess().then(setToken); }, [load]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (viewer) setViewer(null); else onBack(); return true; });
    return () => sub.remove();
  }, [viewer, onBack]);
  const img = (f: string) => ({ uri: `${API_PREFIX}/admin/live-support/chats/${id}/images/${f}`, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  async function take() {
    setErr(''); setOk('');
    try { await api.post(`/admin/live-support/chats/${id}/take`, {}); setOk('Sohbeti devraldın. Sohbetler sekmesinden yazabilirsin.'); load(); } catch (e) { setErr((e as Error).message); }
  }
  const open = !!c && (c.status === 'ACTIVE' || c.status === 'QUEUED');
  return (
    <APage>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <SmallBtn label="← Tüm Sohbetler" color={adm.muted} onPress={onBack} />
        {open && <SmallBtn label="Devral" color={adm.blue} onPress={take} />}
      </View>
      {!!ok && <AT style={{ fontSize: 12, color: adm.green, marginBottom: 8 }}>{ok}</AT>}
      {!!err && <AError>{err}</AError>}
      {!c ? (!err && <AT style={{ color: adm.muted }}>Yükleniyor…</AT>) : (
        <View style={{ gap: 10 }}>
          <ACard style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <DetayAvatar ring={c.kind === 'venue' ? VENUE_RING : undefined} participant={c.avatar ?? {}} size={48} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <AT w={700} style={{ fontSize: 16 }}>{c.name}</AT>
                {c.kind === 'venue' && c.requesterName !== c.name && <AT style={{ fontSize: 12, color: adm.muted }}>{c.requesterName}</AT>}
              </View>
            </View>
            <AT style={{ fontSize: 12, color: adm.muted }}>
              {c.kind === 'venue' ? 'Mekân' : 'Üye'} · {TOPIC[c.topic]} · {CHAT_STATUS[c.status] ?? c.status} · Temsilci No {c.agentNo ?? '—'} · {dt(c.startedAt)} · {dur(c.durationMin)}
              {c.closedAt ? ` · kapanış ${dt(c.closedAt)}${c.closedBy ? ` (${CLOSED_BY[c.closedBy] ?? c.closedBy})` : ''}` : ''}
            </AT>
          </ACard>
          <ACard style={{ gap: 8 }}>
            <ALabel>MESAJLAR ({c.messages.length})</ALabel>
            {c.messages.map((m) => {
              if (m.sender === 'SYSTEM' && m.content !== 'GREETING') return <AT key={m.id} style={{ alignSelf: 'center', textAlign: 'center', fontSize: 11, color: adm.muted }}>{SYS[m.content] ?? m.content} · {dt(m.createdAt)}</AT>;
              const user = m.sender === 'USER';
              return (
                <View key={m.id} style={{ alignSelf: user ? 'flex-start' : 'flex-end', maxWidth: '86%', padding: 8, borderRadius: 12, backgroundColor: user ? adm.surface : 'rgba(59,130,246,0.14)', borderWidth: 1, borderColor: user ? adm.border : 'rgba(59,130,246,0.35)' }}>
                  {m.images.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                      {m.images.map((f) => <Pressable key={f} onPress={() => setViewer(f)} accessibilityRole="imagebutton" accessibilityLabel="Görsel"><Image source={img(f)} style={{ width: 100, height: 100, borderRadius: 8 }} /></Pressable>)}
                    </View>
                  )}
                  {(!!m.content || m.sender === 'SYSTEM') && <AT style={{ fontSize: 13, lineHeight: 19 }}>{m.sender === 'SYSTEM' ? SYS.GREETING : m.content}</AT>}
                  <AT style={{ alignSelf: 'flex-end', fontSize: 10, color: adm.muted, marginTop: 2 }}>{!user && m.agentNo ? `No ${m.agentNo} · ` : ''}{dt(m.createdAt)}</AT>
                </View>
              );
            })}
            {!c.messages.length && <AT style={{ fontSize: 12, color: adm.muted }}>—</AT>}
          </ACard>
          <ACard style={{ gap: 6 }}>
            <ALabel>İÇ NOTLAR ({c.notes.length}) · DEVİRLER ({c.transfers.length})</ALabel>
            {c.transfers.map((x) => <AT key={x.id} style={{ fontSize: 12, color: adm.amber }}>Devir {x.from ?? '—'} → {x.to ?? '—'} · {dt(x.createdAt)}: {x.note}</AT>)}
            {c.notes.map((n) => <AT key={n.id} style={{ fontSize: 12 }}>No {n.agentNo} · {dt(n.createdAt)}: {n.content}</AT>)}
            {!c.notes.length && !c.transfers.length && <AT style={{ fontSize: 12, color: adm.muted }}>—</AT>}
          </ACard>
          <ACard style={{ gap: 4 }}>
            <ALabel>DEĞERLENDİRME</ALabel>
            {c.rating ? (<>
              <AT style={{ fontSize: 16, color: '#e0a526' }}>{starsText(c.rating.stars)}</AT>
              <AT style={{ fontSize: 12 }}>Sorun çözüldü mü: {c.rating.helped ? 'Evet' : 'Hayır'} · {dt(c.rating.createdAt)}</AT>
              {c.rating.tags.length > 0 && <AT style={{ fontSize: 12, color: adm.muted }}>{c.rating.tags.join(', ')}</AT>}
              {!!c.rating.comment && <AT style={{ fontSize: 13, lineHeight: 19 }}>{c.rating.comment}</AT>}
            </>) : <AT style={{ fontSize: 12, color: adm.muted }}>Değerlendirme yok.</AT>}
          </ACard>
          <ACard style={{ gap: 6 }}>
            <ALabel style={{ color: adm.cyan }}>HAIKU SORGU KAYITLARI ({c.aiLogs.length})</ALabel>
            {c.aiLogs.map((l) => (
              <View key={l.id} style={{ gap: 2, paddingTop: 6, borderTopWidth: 1, borderTopColor: adm.border }}>
                <AT style={{ fontSize: 11, color: adm.muted }}>{dt(l.createdAt)} · Temsilci No {l.agentNo} · {AI_TYPE[l.requestType] ?? l.requestType} · <AT style={{ fontSize: 11, color: l.success ? adm.green : adm.red }}>{aiResult(l)}</AT></AT>
                <AT style={{ fontSize: 13 }}>{l.question}</AT>
                <AT style={{ fontSize: 11, color: adm.cyan }}>{l.tools.join(', ') || '—'}</AT>
              </View>
            ))}
            {!c.aiLogs.length && <AT style={{ fontSize: 12, color: adm.muted }}>Kayıt yok.</AT>}
          </ACard>
        </View>
      )}
      <Modal visible={!!viewer} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewer(null)}>
        <Pressable onPress={() => setViewer(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
          {!!viewer && <Image source={img(viewer)} resizeMode="contain" style={{ width: '94%', height: '85%' }} accessibilityLabel="Görsel" />}
        </Pressable>
      </Modal>
    </APage>
  );
}

// ─── Hazır yanıtlar ────────────────────────────────────────────────────────

function CannedTab() {
  const [rows, setRows] = useState<Canned[]>([]);
  const [edit, setEdit] = useState<Canned | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(() => { api.get<Canned[]>('/admin/live-support/canned').then(setRows).catch((e: Error) => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  async function save() {
    setErr('');
    try {
      if (edit) await api.patch(`/admin/live-support/manage/canned/${edit.id}`, { title, content });
      else await api.post('/admin/live-support/manage/canned', { title, content });
      setEdit(null); setTitle(''); setContent(''); load();
    } catch (e) { setErr((e as Error).message); }
  }
  return (
    <View style={{ gap: 8 }}>
      <ACard style={{ gap: 8 }}>
        <AT w={600} style={{ fontSize: 13 }}>{edit ? 'Hazır yanıtı düzenle' : 'Yeni hazır yanıt'}</AT>
        <TextInput value={title} onChangeText={setTitle} placeholder="Başlık" placeholderTextColor={adm.muted} style={input} keyboardAppearance="dark" />
        <TextInput value={content} onChangeText={setContent} placeholder="Metin" placeholderTextColor={adm.muted} multiline style={[input, { minHeight: 72 }]} keyboardAppearance="dark" />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <SmallBtn label="Kaydet" color={adm.green} disabled={!title.trim() || !content.trim()} onPress={save} />
          {!!edit && <SmallBtn label="Vazgeç" color={adm.muted} onPress={() => { setEdit(null); setTitle(''); setContent(''); }} />}
        </View>
        {!!err && <AError>{err}</AError>}
      </ACard>
      {rows.map((r) => (
        <ACard key={r.id} style={{ gap: 6 }}>
          <AT w={600} style={{ fontSize: 13 }}>{r.title}</AT>
          <AT style={{ fontSize: 12, color: adm.muted }}>{r.content}</AT>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <SmallBtn label="Düzenle" color={adm.blue} onPress={() => { setEdit(r); setTitle(r.title); setContent(r.content); }} />
            <SmallBtn label="Sil" color={adm.red} onPress={() => { api.delete(`/admin/live-support/manage/canned/${r.id}`).then(load).catch((e: Error) => setErr(e.message)); }} />
          </View>
        </ACard>
      ))}
    </View>
  );
}

// ─── Raporlar ──────────────────────────────────────────────────────────────

interface Report {
  total: number; open: number; avgWaitMin: number | null; topics: Record<string, number>; hourly: number[]; shift: { DAY: number; NIGHT: number }; shiftDay: string; shiftNight: string;
  byAgent: { agentNo: string; closed: number; firstResponseMin: number | null; avgDurationMin: number | null; avgStars: number | null; helpedYesRate: number | null; ratings: number; tags: Record<string, number> }[];
}
function ReportsTab() {
  const [days, setDays] = useState(7);
  const [r, setR] = useState<Report | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { setR(null); api.get<Report>(`/admin/live-support/manage/reports?days=${days}`).then(setR).catch((e: Error) => setErr(e.message)); }, [days]);
  const max = r ? Math.max(1, ...r.hourly) : 1;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {([[1, 'Bugün'], [7, '7 gün'], [30, '30 gün'], [0, 'Tümü']] as const).map(([d, l]) => <SmallBtn key={d} label={l} color={adm.cyan} filled={days === d} onPress={() => setDays(d)} />)}
      </View>
      {!!err && <AError>{err}</AError>}
      {!r ? <AT style={{ color: adm.muted }}>Yükleniyor…</AT> : (
        <>
          <ACard style={{ gap: 4 }}>
            <AT style={{ fontSize: 13 }}>Toplam sohbet: {r.total} · Açık: {r.open}</AT>
            <AT style={{ fontSize: 13 }}>Ortalama bekleme: {fmtMin(r.avgWaitMin)}</AT>
            <AT style={{ fontSize: 13 }}>Gündüz ({r.shiftDay}): {r.shift.DAY} · Gece ({r.shiftNight}): {r.shift.NIGHT}</AT>
            <AT style={{ fontSize: 13 }}>Konular: {Object.entries(r.topics).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}</AT>
          </ACard>
          <ACard>
            <AT w={600} style={{ fontSize: 13, marginBottom: 8 }}>Saatlik yoğunluk (TR saati)</AT>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 100 }}>
              {r.hourly.map((n, h) => (
                <View key={h} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                  <View style={{ width: '100%', height: (n / max) * 80, minHeight: n ? 2 : 0, backgroundColor: adm.blue, borderRadius: 2 }} />
                  <AT style={{ fontSize: 7, color: adm.muted }}>{h}</AT>
                </View>
              ))}
            </View>
          </ACard>
          {r.byAgent.map((a) => (
            <ACard key={a.agentNo} style={{ gap: 3 }}>
              <AT w={600} style={{ fontSize: 13 }}>Temsilci No {a.agentNo}</AT>
              <AT style={{ fontSize: 12 }}>Kapatılan: {a.closed} · İlk yanıt: {fmtMin(a.firstResponseMin)} · Ort. sohbet: {fmtMin(a.avgDurationMin)}</AT>
              <AT style={{ fontSize: 12 }}>Puan ort.: {a.avgStars === null ? '—' : `${a.avgStars.toFixed(2)} (${a.ratings})`} · Evet oranı: {a.helpedYesRate === null ? '—' : `%${Math.round(a.helpedYesRate * 100)}`}</AT>
              <AT style={{ fontSize: 12, color: adm.muted }}>{Object.entries(a.tags).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'}</AT>
            </ACard>
          ))}
          {!r.byAgent.length && <AT style={{ fontSize: 12, color: adm.muted }}>Bu dönemde kapanan sohbet yok.</AT>}
        </>
      )}
    </View>
  );
}

// ─── Temsilciler (SUPERADMIN) ──────────────────────────────────────────────

interface AgentRow { userId: string; name: string; email: string; phone: string | null; role: string; active: boolean; agentNo: string | null; status: string | null }
function AgentsTab() {
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const load = useCallback(() => { api.get<AgentRow[]>('/admin/live-support/manage/agents').then(setRows).catch((e: Error) => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  async function create() {
    setErr(''); setOk('');
    try { const r = await api.post<{ agentNo: string }>('/admin/live-support/manage/agents', f); setOk(`Temsilci hesabı açıldı. Temsilci No: ${r.agentNo}`); setF({ firstName: '', lastName: '', email: '', phone: '', password: '' }); load(); }
    catch (e) { setErr((e as Error).message); }
  }
  const roleTr: Record<string, string> = { SUPPORT: 'Temsilci', ADMIN: 'Admin', SUPERADMIN: 'Süper Admin' };
  return (
    <View style={{ gap: 8 }}>
      <ACard style={{ gap: 8 }}>
        <AT w={600} style={{ fontSize: 13 }}>Temsilci hesabı aç</AT>
        {([['firstName', 'Ad'], ['lastName', 'Soyad'], ['email', 'E-posta'], ['phone', 'Telefon (+90…)'], ['password', 'Şifre (en az 8)']] as const).map(([k, l]) => (
          <TextInput key={k} value={f[k]} onChangeText={(v) => setF((p) => ({ ...p, [k]: v }))} placeholder={l} placeholderTextColor={adm.muted} secureTextEntry={k === 'password'} autoCapitalize={k === 'email' || k === 'password' ? 'none' : 'words'} keyboardType={k === 'email' ? 'email-address' : k === 'phone' ? 'phone-pad' : 'default'} style={input} keyboardAppearance="dark" />
        ))}
        <SmallBtn label="Hesap Aç" color={adm.green} onPress={create} />
        {!!err && <AError>{err}</AError>}
        {!!ok && <AT style={{ fontSize: 12, color: adm.green }}>{ok}</AT>}
      </ACard>
      {rows.map((r) => (
        <ACard key={r.userId} style={{ gap: 6, opacity: r.active ? 1 : 0.55 }}>
          <AT w={600} style={{ fontSize: 13 }}>{r.name} · {roleTr[r.role] ?? r.role}</AT>
          <AT style={{ fontSize: 11, color: adm.muted }}>{r.email} · {r.phone ?? '—'} · Temsilci No {r.agentNo ?? '—'} · {r.status === 'ONLINE' ? 'Çevrimiçi' : r.status === 'BREAK' ? 'Mola' : 'Çevrimdışı'}</AT>
          {!r.active && <AT style={{ fontSize: 11, color: adm.amber }}>Bu temsilci artık destek ekibinde değil.</AT>}
          {r.role === 'SUPPORT' && <SmallBtn label={r.active ? 'Hesabı Kapat' : 'Hesabı Aç'} color={r.active ? adm.red : adm.green} onPress={() => { api.patch(`/admin/live-support/manage/agents/${r.userId}`, { active: !r.active }).then(load).catch((e: Error) => setErr(e.message)); }} />}
        </ACard>
      ))}
    </View>
  );
}

// ─── Kısıtlamalar ve Haiku kayıtları (SUPERADMIN) ──────────────────────────

interface Restr { id: string; requesterName: string; kind: string; days: number; expiresAt: string; createdAt: string; agentNo: string | null; liftedAt: string | null; active: boolean }
function RestrictionsTab() {
  const [rows, setRows] = useState<Restr[]>([]);
  const [err, setErr] = useState('');
  const load = useCallback(() => { api.get<Restr[]>('/admin/live-support/manage/restrictions').then(setRows).catch((e: Error) => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <View style={{ gap: 8 }}>
      {!!err && <AError>{err}</AError>}
      {!rows.length && <AT style={{ fontSize: 13, color: adm.muted }}>Kısıtlama kaydı yok.</AT>}
      {rows.map((r) => (
        <ACard key={r.id} style={{ gap: 6 }}>
          <AT w={600} style={{ fontSize: 13 }}>{r.requesterName} · {r.kind === 'venue' ? 'Mekân' : 'Üye'}</AT>
          <AT style={{ fontSize: 11, color: adm.muted }}>{r.days} gün · {dt(r.createdAt)} → {dt(r.expiresAt)} · Temsilci No {r.agentNo ?? '—'}{r.liftedAt ? ` · kaldırıldı ${dt(r.liftedAt)}` : ''}</AT>
          {r.active && <SmallBtn label="Kısıtlamayı Kaldır" color={adm.green} onPress={() => { api.post(`/admin/live-support/manage/restrictions/${r.id}/lift`, {}).then(load).catch((e: Error) => setErr(e.message)); }} />}
        </ACard>
      ))}
    </View>
  );
}

function AiLogsTab() {
  const [rows, setRows] = useState<AiLog[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => { api.get<typeof rows>('/admin/live-support/manage/ai-logs').then(setRows).catch((e: Error) => setErr(e.message)); }, []);
  return (
    <View style={{ gap: 8 }}>
      {!!err && <AError>{err}</AError>}
      {!rows.length && <AT style={{ fontSize: 13, color: adm.muted }}>Kayıt yok.</AT>}
      {rows.map((r) => (
        <ACard key={r.id} style={{ gap: 3 }}>
          <AT style={{ fontSize: 11, color: adm.muted }}>{dt(r.createdAt)} · Temsilci No {r.agentNo} · {AI_TYPE[r.requestType] ?? r.requestType} · <AT style={{ fontSize: 11, color: r.success ? adm.green : adm.red }}>{aiResult(r)}</AT></AT>
          <AMono style={{ fontSize: 10, color: adm.muted }}>{r.chatId}</AMono>
          <AT style={{ fontSize: 13 }}>{r.question}</AT>
          <AT style={{ fontSize: 11, color: adm.cyan }}>{r.tools.join(', ') || '—'}</AT>
        </ACard>
      ))}
    </View>
  );
}

