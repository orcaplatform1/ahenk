// Canlı Destek (üye): web components/support/SupportChatScreen.tsx karşılığı; Profilim → "Canlı Destek".
// Masa Sohbeti gibi kısa aralıklı yoklama (3 sn, yalnız ekran odaktayken). Konu seçimi → sıra → temsilci → sohbet → değerlendirme.
// HIG: güvenli alan, en az 44 pt dokunma alanı, klavye açıkken mesaj alanı klavyenin üstünde (KeyboardAvoidingView).
// Küçült butonu sohbeti baloncuğa alır (components/SupportBubble.tsx). Kuyruktayken "Beklerken oyna" Breakout açar; temsilci bağlanınca
// (hafif titreşim) ya da küçültülünce oyun tamamen kapanır, dönüşte yeniden başlamaz.
// Maskot: kuyrukta sıra satırının üstünde tam sürüm (72 pt yükseklik), temsilci bağlanınca başlığın solunda tam sürüm (36 pt yükseklik),
// sohbet alanında sabit filigran (tam sürüm, alan genişliğinin %60'ı, ortada, opaklık %8 koyu tema, pointerEvents none; oyun açıkken gizli).
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { api } from '@/lib/api';
import { API_PREFIX } from '@/lib/config';
import { getAccess } from '@/lib/session';
import { openLegal } from '@/lib/links';
import { pickFromLibrary, type PickedImage } from '@/lib/imagePick';
import { supportRemaining } from '@/lib/supportTime';
import { emitSupportChange } from '@/lib/supportBus';
import * as Haptics from 'expo-haptics';
import { Breakout } from '@/components/Breakout';
import { ChatComposer, SmallGhostButton, StatusPill, SUPPORT_EMOJIS } from '@/components/SupportChatParts';
import { Card, Serif, StdButton, T } from '@/components/ui';
import { showAlert } from '@/components/AppAlert';
import { btn, c, inputGlass, ll, sans, tw } from '@/theme/theme';

type Sender = 'USER' | 'AGENT' | 'SYSTEM';
interface Msg { id: string; sender: Sender; agentNo: string | null; content: string; images: string[]; createdAt: string; pending?: boolean }
interface ChatView {
  id: string; status: 'QUEUED' | 'ACTIVE'; topic: string; agentNo: string | null;
  queue: { position: number; ahead: number; etaMin: number | null; online: boolean } | null;
  agentTyping: boolean; agentOnline: boolean; agentReadAt: string | null; messages: Msg[];
}
interface State { restriction: { expiresAt: string } | null; chat: ChatView | null; pendingRating: string | null }

const TOPICS = ['ACCOUNT', 'PAYMENT', 'MEETING', 'OTHER'] as const;
const TAGS = {
  good: ['CARED', 'SOLUTION', 'POLITE', 'FAST', 'PROCESS_OK'],
  mid: ['MORE_CARING', 'KNOWLEDGE', 'FASTER', 'PROCESS_IMPROVE'],
  bad: ['UNINTERESTED', 'NO_REPLY', 'LACK_KNOWLEDGE', 'RUDE', 'PROCESS_BAD', 'SLOW'],
} as const;
const OK_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;
// Canlı destek maskotu (assets); tam sürüm en-boy oranı 1009 / 1024; filigran opaklığı: uygulama yalnız koyu temada (%8)
const MASCOT_FULL = require('@/assets/destek-tam.webp');
const MASCOT_RATIO = 1009 / 1024;
// Sohbet başlığı (temsilci ekranı başlığının oranlarında küçük): maskot yüksekliği ve küçült butonunun görünen çapı
const MASCOT_HEADER = 36;
const MIN_BTN = 22;

// Başlıktaki küçük SONLANDIR: StdButton ghost stili (hap, ince çerçeve, nokta, %14 harf aralığı, büyük harf) küçük boy ve iç boşlukla;
// görünen boy küçük, dokunma alanı hitSlop ile en az 44 pt
const WATERMARK_OPACITY = 0.08;
const TYPING_GAP_MS = 300; // yazı önizlemesi en fazla 300 ms aralıkla gönderilir
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Istanbul' });

export default function CanliDestek() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State | null>(null);
  const [rateFor, setRateFor] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { getAccess().then(setToken); }, []);

  const load = useCallback(async () => {
    try {
      const s = await api.get<State>('/support/state');
      // Sohbet bitince (kullanıcı, temsilci ya da otomatik) değerlendirme ekranı açılır; kötüye kullanımla kapananda açılmaz
      if (!s.chat && s.pendingRating) setRateFor((r) => r ?? s.pendingRating);
      setState(s); setError('');
    } catch (e) { setError((e as Error).message || t('sup.error')); }
  }, [t]);
  useFocusEffect(useCallback(() => { load(); const id = setInterval(load, 3000); return () => clearInterval(id); }, [load]));

  async function start(topic: string) {
    setError('');
    try { await api.post('/support/chats', { topic }); await load(); emitSupportChange(); } catch (e) { setError((e as Error).message || t('sup.error')); }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profilim'));
  let body: React.ReactNode;
  if (!state) body = <T style={{ color: ll.label, fontSize: 13 }}>…</T>;
  else if (thanks) {
    body = (
      <Card style={{ gap: 16 }}>
        <T style={{ color: ll.text, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>{t('sup.rateThanks')}</T>
        <StdButton variant="primary" full label={t('sup.close')} onPress={() => { setThanks(false); setRateFor(null); back(); }} />
      </Card>
    );
  } else if (rateFor && !state.chat) body = <RatingView chatId={rateFor} onDone={() => setThanks(true)} />;
  else if (state.chat) body = <ChatPanel chat={state.chat} token={token} reload={load} onEnded={(id) => setRateFor(id)} onMinimize={() => { emitSupportChange(); back(); }} />;
  else if (state.restriction) body = <Card><T style={{ color: ll.text, fontSize: 14, lineHeight: 21 }}>{t('sup.restricted', { time: supportRemaining(state.restriction.expiresAt, t) })}</T></Card>;
  else {
    body = (
      <Card style={{ gap: 12 }}>
        <Serif style={{ fontSize: 22, color: ll.text }}>{t('sup.header')}</Serif>
        <T style={{ fontSize: 13, color: ll.label }}>{t('sup.chooseTopic')}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TOPICS.map((k) => (
            <Pressable key={k} onPress={() => start(k)} accessibilityRole="button"
              style={({ pressed }) => ({ flexBasis: '48%', flexGrow: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <T style={{ fontSize: 14, color: ll.text }}>{t(`sup.topic${k}`)}</T>
            </Pressable>
          ))}
        </View>
      </Card>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tw.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8, paddingHorizontal: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={back} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <View style={btn.pillRed.box}><T w={600} style={{ fontSize: 12, color: '#ff6b6b' }}>← {t('tabs.profil')}</T></View>
          </Pressable>
          <Serif style={{ fontSize: 26, color: ll.text }}>{t('sup.title')}</Serif>
        </View>
        {!!error && <T accessibilityRole="alert" style={{ color: tw.accent, fontSize: 13 }}>{error}</T>}
        <View style={{ flex: 1 }}>{body}</View>
      </View>
    </KeyboardAvoidingView>
  );
}

function ChatPanel({ chat, token, reload, onEnded, onMinimize }: { chat: ChatView; token: string | null; reload: () => void; onEnded: (id: string) => void; onMinimize: () => void }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<PickedImage[]>([]);
  const [emoji, setEmoji] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const typingAt = useRef(0);
  const msgs = [...chat.messages, ...pending];
  // Oyun yalnız kuyruktayken; temsilci bağlandığı an hafif titreşim ve oyun tamamen kapanır
  const [game, setGame] = useState(false);
  const lastStatus = useRef(chat.status);
  useEffect(() => {
    if (lastStatus.current === 'QUEUED' && chat.status === 'ACTIVE') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    lastStatus.current = chat.status;
    if (chat.status !== 'QUEUED') setGame(false);
  }, [chat.status]);

  useEffect(() => {
    if (!viewer) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setViewer(null); return true; });
    return () => sub.remove();
  }, [viewer]);

  // Yazı önizlemesi: atanmış temsilci gönderilmeden önce görür (sunucuda yalnız bellekte, 5 sn). En fazla 300 ms aralıkla son metin
  // gönderilir; çubuk tamamen silinince hemen boş gider (önizleme ve yazıyor kalkar)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const draftRef = useRef('');
  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current); }, []);
  function pushTyping() { typingAt.current = Date.now(); api.post(`/support/chats/${chat.id}/typing`, { text: draftRef.current }).catch(() => undefined); }
  function onType(v: string) {
    const val = v.slice(0, 2000);
    setText(val);
    draftRef.current = val;
    const wait = TYPING_GAP_MS - (Date.now() - typingAt.current);
    if (!val.trim() || wait <= 0) { if (typingTimer.current) { clearTimeout(typingTimer.current); typingTimer.current = undefined; } pushTyping(); return; }
    if (!typingTimer.current) typingTimer.current = setTimeout(() => { typingTimer.current = undefined; pushTyping(); }, wait);
  }

  async function pick() {
    setErr('');
    const left = 3 - files.length;
    if (left <= 0) { setErr(t('sup.imgLimit')); return; }
    const r = await pickFromLibrary(left);
    if (!Array.isArray(r)) return;
    const ok: PickedImage[] = [];
    for (const f of r) {
      if (!OK_TYPES.includes(f.type.toLowerCase())) { setErr(t('sup.imgType')); continue; }
      if (f.size && f.size > MAX_BYTES) { setErr(t('sup.imgSize')); continue; }
      ok.push(f);
    }
    setFiles((p) => [...p, ...ok].slice(0, 3));
  }

  async function send() {
    const content = text.trim();
    if ((!content && !files.length) || busy) return;
    setBusy(true); setErr(''); setEmoji(false);
    const temp: Msg = { id: `p-${Date.now()}`, sender: 'USER', agentNo: null, content, images: [], createdAt: new Date().toISOString(), pending: true };
    setPending([temp]);
    const fd = new FormData();
    if (content) fd.append('content', content);
    files.forEach((f) => fd.append('images', { uri: f.uri, name: f.name, type: f.type } as unknown as Blob));
    setText(''); setFiles([]);
    // Gönderilince bekleyen önizleme gönderimi iptal (sunucu mesajla birlikte önizlemeyi siler)
    if (typingTimer.current) { clearTimeout(typingTimer.current); typingTimer.current = undefined; }
    draftRef.current = '';
    try { await api.form(`/support/chats/${chat.id}/messages`, fd); reload(); }
    catch (e) { setErr((e as Error).message || t('sup.error')); }
    finally { setPending([]); setBusy(false); }
  }

  async function end() {
    try { await api.post(`/support/chats/${chat.id}/close`); onEnded(chat.id); reload(); } catch (e) { setErr((e as Error).message || t('sup.error')); }
  }

  // Okundu: yalnız kendi mesajlarından temsilcinin okuduğu sonuncusunun altında
  const readId = chat.agentReadAt ? [...chat.messages].reverse().find((m) => m.sender === 'USER' && m.createdAt <= chat.agentReadAt!)?.id : undefined;
  const status = chat.agentTyping ? 'typing' : chat.agentOnline ? 'online' : 'offline';
  const img = (f: string) => ({ uri: `${API_PREFIX}/support/chats/${chat.id}/images/${f}`, headers: token ? { Authorization: `Bearer ${token}` } : undefined });

  return (
    <View style={{ flex: 1, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.025)', overflow: 'hidden' }}>
      {/* Başlık (kuyrukta ve bağlıyken; temsilci ekranı başlığının oranlarında küçük, 320 pt genişlikte tek parça): bağlıyken solda maskot
          tam sürüm, sağında 1. satır "Müşteri Temsilcisi", 2. satır Temsilci No + durum etiketi ve en sağda SONLANDIR; küçült butonu kartın
          sağ üst köşesinde (görünen 22 pt, dokunma alanı 44 pt). Hiçbir yazı kesilmez; dar ekranda 2. satır kendi içinde alt satıra geçer.
          Temsilcinin adı ve cinsiyeti hiçbir yerde gösterilmez */}
      <View style={{ paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {chat.status === 'ACTIVE' && <Image source={MASCOT_FULL} accessible={false} style={{ height: MASCOT_HEADER, width: MASCOT_HEADER * MASCOT_RATIO }} />}
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <T w={700} style={{ fontSize: 13, lineHeight: 18, color: ll.text, paddingRight: MIN_BTN + 4 }}>{t('sup.agentTitle')}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 4 }}>
            {chat.status === 'ACTIVE' && !!chat.agentNo && (<>
              <T style={{ fontSize: 10, lineHeight: 14, color: ll.label }}>{t('sup.agentNo', { no: chat.agentNo })}</T>
              <StatusPill small status={status} label={status === 'typing' ? t('sup.typing') : status === 'online' ? t('sup.online') : t('sup.offlineStatus')} />
            </>)}
            {/* Sonlandır onayı (site paleti, AppAlert): Evet → mevcut sonlandırma / kuyruktan çıkış akışı (değerlendirme dahil), Hayır / geri tuşu / dışarı basma → işlem yok */}
            <SmallGhostButton style={{ marginLeft: 'auto' }} label={t('sup.endShort')} onPress={() => showAlert(t('sup.endConfirm'), undefined, [{ text: t('sup.no'), style: 'cancel' }, { text: t('sup.yes'), onPress: () => { void end(); } }])} />
          </View>
        </View>
        {/* Küçült: kartın sağ üst köşesinde çerçeveli küçük yuvarlak buton (yatay çizgi) */}
        <Pressable onPress={onMinimize} accessibilityRole="button" accessibilityLabel={t('sup.minimize')} hitSlop={(44 - MIN_BTN) / 2}
          style={({ pressed }) => ({ position: 'absolute', top: 6, right: 8, width: MIN_BTN, height: MIN_BTN, borderRadius: MIN_BTN / 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={ll.text} strokeWidth={2.4} strokeLinecap="round"><Path d="M5 12h14" /></Svg>
        </Pressable>
      </View>
      {chat.status === 'QUEUED' && !!chat.queue && (
        <View style={{ paddingVertical: game ? 6 : 10, paddingHorizontal: 14, backgroundColor: 'rgba(245,158,11,0.06)', borderBottomWidth: 1, borderBottomColor: 'rgba(245,158,11,0.2)', gap: 4 }}>
          {/* Oyun açıkken sıra ve tahmin satırı üstte küçük */}
          {!chat.queue.online && !game && <T style={{ fontSize: 13, color: ll.text, lineHeight: 19 }}>{t('sup.offline')}</T>}
          {/* Sıra bilgisinin hemen üstünde maskot (tam sürüm, 72 pt yükseklik); oyun açıkken sıra satırı küçük kaldığı için gösterilmez */}
          {!game && <Image source={MASCOT_FULL} accessible={false} style={{ height: 72, width: 72 * MASCOT_RATIO }} />}
          <T style={{ fontSize: game ? 11 : 13, color: chat.queue.online && !game ? ll.text : ll.label, lineHeight: game ? 16 : 19 }}>
            {chat.queue.etaMin !== null ? t('sup.queue', { n: chat.queue.ahead, m: chat.queue.etaMin }) : t('sup.queueNoEta', { n: chat.queue.ahead })}
          </T>
          {!game && <StdButton variant="ghost" label={t('sup.play')} style={{ alignSelf: 'flex-start', marginTop: 4 }} onPress={() => setGame(true)} />}
        </View>
      )}
      {game ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }} scrollEnabled={false}>
          {/* Oyunu kapat Skor / Can satırının ortasında: oyun tamamen kapanır (bileşen kaldırılır), sıra ekranına dönülür */}
          <Breakout onClose={() => setGame(false)} />
        </ScrollView>
      ) : (<>
      {/* Filigran: sohbet alanının ortasında sabit (mesajlar üstünden kayar), dokunma almaz; renkler korunur */}
      <View style={{ flex: 1 }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={MASCOT_FULL} accessible={false} style={{ width: '60%', height: undefined, aspectRatio: MASCOT_RATIO, opacity: WATERMARK_OPACITY }} />
        </View>
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 8 }} keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          {msgs.map((m) => (
            <View key={m.id}>
              <Bubble m={m} img={img} onImage={(u) => setViewer(u)} />
              {m.id === readId && <T style={{ alignSelf: 'flex-end', fontSize: 10, color: ll.label, marginTop: 2 }}>{t('sup.read')}</T>}
            </View>
          ))}
        </ScrollView>
      </View>
      {!!err && <T accessibilityRole="alert" style={{ paddingHorizontal: 12, paddingBottom: 6, fontSize: 12, color: tw.accent }}>{err}</T>}
      {files.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingBottom: 8 }}>
          {files.map((f, i) => (
            <View key={f.uri} style={{ width: 56, height: 56 }}>
              <Image source={{ uri: f.uri }} style={{ width: 56, height: 56, borderRadius: 8 }} accessibilityLabel={t('sup.image')} />
              <Pressable onPress={() => setFiles((p) => p.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={t('sup.removeImage')} hitSlop={12}
                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: c.red, alignItems: 'center', justifyContent: 'center' }}>
                <T style={{ fontSize: 12, color: '#fff' }}>×</T>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {emoji && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
          {SUPPORT_EMOJIS.map((e) => (
            <Pressable key={e} onPress={() => setText((v) => (v + e).slice(0, 2000))} accessibilityRole="button" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <T style={{ fontSize: 22 }}>{e}</T>
            </Pressable>
          ))}
        </View>
      )}
      {/* Mesaj kutusu: dosya, emoji, yazı alanı ve gönder ikonu kutunun içinde (temsilci ekranıyla aynı düzen) */}
      <View style={{ padding: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
        <ChatComposer value={text} onChangeText={onType} textColor={tw.text}
          onAttach={pick} onEmoji={() => setEmoji((v) => !v)} onSend={send} sendDisabled={busy || (!text.trim() && !files.length)}
          onFocus={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 300)}
          labels={{ attach: t('sup.attach'), emoji: t('sup.emoji'), send: t('sup.send') }} />
      </View>
      </>)}
      <Modal visible={!!viewer} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewer(null)}>
        <Pressable onPress={() => setViewer(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
          {!!viewer && <Image source={{ uri: viewer, headers: token ? { Authorization: `Bearer ${token}` } : undefined }} resizeMode="contain" style={{ width: '94%', height: '85%' }} accessibilityLabel={t('sup.image')} />}
        </Pressable>
      </Modal>
    </View>
  );
}


function Bubble({ m, img, onImage }: { m: Msg; img: (f: string) => { uri: string; headers?: Record<string, string> }; onImage: (u: string) => void }) {
  const { t } = useTranslation();
  if (m.sender === 'SYSTEM' && m.content !== 'GREETING') {
    return (
      <View style={{ alignSelf: 'center', maxWidth: '92%', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
        {m.content === 'NOTICE' ? (
          <T style={{ fontSize: 12, color: ll.label, lineHeight: 18, textAlign: 'center' }}>
            {t('sup.sysNoticePre')}
            <T accessibilityRole="link" onPress={() => { openLegal('/kvkk').catch(() => {}); }} style={{ fontSize: 12, color: ll.text, textDecorationLine: 'underline' }}>{t('sup.sysNoticeLink')}</T>
            {t('sup.sysNoticePost')}
          </T>
        ) : (
          <T style={{ fontSize: 12, color: ll.label, lineHeight: 18, textAlign: 'center' }}>{m.content === 'TRANSFERRED' ? t('sup.sysTransferred') : m.content === 'IDLE_WARNING' ? t('sup.sysIdle') : m.content}</T>
        )}
        {/* Kayıt bildirimi (NOTICE) saatsiz */}
        {m.content !== 'NOTICE' && <T style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 2 }}>{time(m.createdAt)}</T>}
      </View>
    );
  }
  const own = m.sender === 'USER';
  const body = m.sender === 'SYSTEM' ? t('sup.sysGreeting') : m.content;
  return (
    <View style={{ alignSelf: own ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
      <View style={{ paddingTop: 7, paddingBottom: 5, paddingHorizontal: 10, borderRadius: 12, borderBottomRightRadius: own ? 2 : 12, borderBottomLeftRadius: own ? 12 : 2, backgroundColor: own ? 'rgba(192,57,43,0.16)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: own ? 'rgba(192,57,43,0.4)' : 'rgba(255,255,255,0.1)', opacity: m.pending ? 0.7 : 1 }}>
        {m.images.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: body ? 6 : 0 }}>
            {m.images.map((f) => {
              const src = img(f);
              return (
                <Pressable key={f} onPress={() => onImage(src.uri)} accessibilityRole="imagebutton" accessibilityLabel={t('sup.image')}>
                  <Image source={src} style={{ width: 110, height: 110, borderRadius: 8 }} />
                </Pressable>
              );
            })}
          </View>
        )}
        {!!body && <T style={{ fontSize: 14, color: ll.text, lineHeight: 20 }}>{body}</T>}
        <T style={{ alignSelf: 'flex-end', fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{m.pending ? t('sup.sending') : time(m.createdAt)}</T>
      </View>
    </View>
  );
}

function RatingView({ chatId, onDone }: { chatId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const [helped, setHelped] = useState<boolean | null>(null);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const group = stars >= 4 ? 'good' : stars >= 2 ? 'mid' : stars === 1 ? 'bad' : null;
  const can = helped !== null && stars > 0 && !busy;
  useEffect(() => { setTags([]); }, [group]);

  async function submit() {
    if (!can) return;
    setBusy(true); setErr('');
    try { await api.post(`/support/chats/${chatId}/rating`, { helped, stars, tags, comment: comment.trim() || undefined }); onDone(); }
    catch (e) { setErr((e as Error).message || t('sup.error')); }
    finally { setBusy(false); }
  }
  const pill = (on: boolean) => ({ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: 'center' as const, borderWidth: 1, borderColor: on ? c.red : 'rgba(255,255,255,0.12)', backgroundColor: on ? c.red : 'rgba(255,255,255,0.04)' });
  return (
    <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: 16 }}>
        <View style={{ gap: 10 }}>
          <T w={600} style={{ fontSize: 15, color: ll.text }}>{t('sup.rateHelped')}</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={pill(helped === true)} onPress={() => setHelped(true)} accessibilityRole="button" accessibilityState={{ selected: helped === true }}><T style={{ fontSize: 13, color: '#fff' }}>{t('sup.yes')}</T></Pressable>
            <Pressable style={pill(helped === false)} onPress={() => setHelped(false)} accessibilityRole="button" accessibilityState={{ selected: helped === false }}><T style={{ fontSize: 13, color: '#fff' }}>{t('sup.no')}</T></Pressable>
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <T w={600} style={{ fontSize: 15, color: ll.text }}>{t('sup.rateStars')}</T>
          <View style={{ flexDirection: 'row' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setStars(n)} accessibilityRole="button" accessibilityLabel={t('sup.star', { n })} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <T style={{ fontSize: 30, color: n <= stars ? '#e0a526' : 'rgba(255,255,255,0.2)' }}>★</T>
              </Pressable>
            ))}
          </View>
        </View>
        {!!group && (
          <View style={{ gap: 10 }}>
            <T w={600} style={{ fontSize: 14, color: ll.text }}>{t(group === 'good' ? 'sup.rateGood' : group === 'mid' ? 'sup.rateMid' : 'sup.rateBad')}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TAGS[group].map((k) => {
                const on = tags.includes(k);
                return (
                  <Pressable key={k} style={pill(on)} onPress={() => setTags((p) => (on ? p.filter((x) => x !== k) : [...p, k]))} accessibilityRole="button" accessibilityState={{ selected: on }}>
                    <T style={{ fontSize: 13, color: on ? '#fff' : ll.text }}>{t(`sup.tag${k}`)}</T>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        <TextInput value={comment} onChangeText={(v) => setComment(v.slice(0, 1000))} placeholder={t('sup.rateComment')} placeholderTextColor={inputGlass.placeholder} multiline keyboardAppearance="dark"
          style={{ minHeight: 88, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', color: tw.text, fontSize: 14, fontFamily: sans(400), textAlignVertical: 'top' }} />
        {!!err && <T accessibilityRole="alert" style={{ fontSize: 12, color: tw.accent }}>{err}</T>}
        <StdButton variant="primary" full label={t('sup.rateSubmit')} disabled={!can} onPress={submit} />
      </Card>
    </ScrollView>
  );
}
