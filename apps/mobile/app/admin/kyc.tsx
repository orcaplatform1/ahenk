// apps/web/app/admin/kyc/page.tsx karşılığı. Görseller ve canlılık videosu Bearer başlığıyla yüklenir; video uygulama içinde oynatılır (expo-video),
// görsele dokununca dosya Bearer ile indirilip uygulama içinde açılır (web: blob yeni sekmede).
import React, { useEffect, useState } from 'react';
import { Image, Pressable, TextInput, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { openAuthedFile } from '@/lib/authFile';
import { api } from '@/lib/api';
import { BASE } from '@/lib/config';
import { getAccess } from '@/lib/session';
import { Btn } from '@/components/ui';
import { ACard, AError, AGrid, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { AInput } from '@/components/admin/AdminControls';
import { StatusPill } from '@/components/admin/StatusPill';
import { adm, sans } from '@/theme/theme';

const ORANGE = '#fb923c';
type KycStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPICIOUS';
interface KycApplication { id: string; submittedAt: string; status: KycStatus; rejectReason: string | null; idFrontUrl: string | null; idBackUrl: string | null; livenessUrl: string | null; user: { email: string; phone: string | null; profile: { firstName: string; lastName: string } | null }; hasIdentityNumber: boolean }
const TABS: { key: KycStatus; label: string }[] = [{ key: 'PENDING', label: 'Bekleyenler' }, { key: 'APPROVED', label: 'Onaylananlar' }, { key: 'REJECTED', label: 'Reddedilenler' }, { key: 'SUSPICIOUS', label: 'Şüpheli' }];
const ST: Record<KycStatus, { bg: string; border: string; color: string; label: string }> = {
  PENDING: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', color: adm.amber, label: 'Bekliyor' },
  APPROVED: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', color: adm.green, label: 'Onaylandı' },
  REJECTED: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', color: adm.red, label: 'Reddedildi' },
  SUSPICIOUS: { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.3)', color: ORANGE, label: 'Şüpheli' },
};
function isValidTckn(v: string) {
  if (!/^[1-9]\d{10}$/.test(v)) return false;
  const d = v.split('').map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8]; const even = d[1] + d[3] + d[5] + d[7];
  if ((((odd * 7 - even) % 10) + 10) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}
const fmtDate = (v: string) => new Date(v).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const abs = (u: string) => (u.startsWith('/') ? `${BASE}${u}` : u);

function KycVideo({ uri, token }: { uri: string; token: string }) {
  // web: <video controls preload="metadata" objectFit cover>
  const player = useVideoPlayer({ uri, headers: { Authorization: `Bearer ${token}` } });
  return <VideoView player={player} nativeControls contentFit="cover" style={{ width: '100%', height: '100%' }} />;
}

function MediaPreview({ url, label, isVideo, token }: { url: string | null; label: string; isVideo?: boolean; token: string | null }) {
  return (
    <View style={{ minWidth: 0, borderRadius: 8, overflow: 'hidden', backgroundColor: adm.surface, borderWidth: 1, borderColor: adm.border }}>
      <View style={{ aspectRatio: 16 / 9 }}>
        {url && token ? (
          isVideo ? <KycVideo uri={abs(url)} token={token} />
            : <Pressable onPress={() => { openAuthedFile(abs(url)).catch(() => undefined); }} style={{ width: '100%', height: '100%' }}>
                <Image source={{ uri: abs(url), headers: { Authorization: `Bearer ${token}` } }} resizeMode="cover" style={{ width: '100%', height: '100%' }} accessibilityLabel={label} />
              </Pressable>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <AT style={{ fontSize: 10, color: adm.muted }}>{url ? 'Yükleniyor…' : `${label} yüklenmemiş`}</AT>
          </View>
        )}
      </View>
      <AT style={{ fontSize: 10, color: adm.muted, paddingVertical: 4, paddingHorizontal: 8 }}>{label}</AT>
    </View>
  );
}

export default function AdminKyc() {
  const [tab, setTab] = useState<KycStatus>('PENDING');
  const [items, setItems] = useState<KycApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState<Record<string, 'approve' | 'reject'>>({});
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [tckn, setTckn] = useState<Record<string, string>>({});
  const [savingTckn, setSavingTckn] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { getAccess().then(setToken); loadTab('PENDING'); }, []);
  function loadTab(s: KycStatus) {
    setTab(s); setLoading(true); setError(''); setRejectOpen(null);
    api.get<{ items: KycApplication[]; total: number }>(`/kyc/admin?status=${s}&limit=50`).then(r => setItems(r.items ?? [])).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }
  async function saveTckn(id: string) {
    setSavingTckn(id); setError('');
    try { await api.patch(`/kyc/admin/${id}/identity-number`, { identityNumber: tckn[id] }); setItems(p => p.map(x => (x.id === id ? { ...x, hasIdentityNumber: true } : x))); setTckn(p => { const n = { ...p }; delete n[id]; return n; }); }
    catch (e) { setError((e as Error).message); } finally { setSavingTckn(null); }
  }
  const done = (id: string) => setProcessing(p => { const n = { ...p }; delete n[id]; return n; });
  async function approve(id: string) {
    setProcessing(p => ({ ...p, [id]: 'approve' }));
    try { await api.patch(`/kyc/admin/${id}/review`, { status: 'APPROVED', identityNumber: tckn[id] }); setItems(p => p.filter(x => x.id !== id)); } catch (e) { setError((e as Error).message); } finally { done(id); }
  }
  async function reject(id: string) {
    setProcessing(p => ({ ...p, [id]: 'reject' }));
    try { await api.patch(`/kyc/admin/${id}/review`, { status: 'REJECTED', rejectReason: rejectNote[id] ?? '' }); setItems(p => p.filter(x => x.id !== id)); setRejectOpen(null); } catch (e) { setError((e as Error).message); } finally { done(id); }
  }
  const st = ST[tab];
  const tcknInput = { marginBottom: 10, letterSpacing: 1.04, paddingHorizontal: 12 };
  const empty = (
    <ACard style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border }}><ATitle>KYC Başvuruları</ATitle></View>
      {loading ? <View style={{ gap: 6, padding: 16 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 120, backgroundColor: adm.surface, borderRadius: 8, opacity: 0.5 }} />)}</View>
        : <View style={{ paddingVertical: 40, alignItems: 'center' }}><AT w={600} style={{ fontSize: 13, color: adm.muted }}>Bu kategoride başvuru yok</AT></View>}
    </ACard>
  );
  return (
    <APage maxWidth={880}>
      <View style={{ marginBottom: 24 }}><ATitle>KYC Başvuruları</ATitle></View>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => { const on = tab === t.key; const ts = ST[t.key]; return (
          <Btn key={t.key} variant="admTabBtn" label={t.label} onPress={() => loadTab(t.key)} style={on ? { backgroundColor: ts.bg, borderColor: ts.border } : undefined} textStyle={on ? { color: ts.color, fontFamily: sans(700) } : undefined} />
        ); })}
      </View>
      <AError>{error}</AError>
      {loading || items.length === 0 ? empty : (
        <View style={{ gap: 12 }}>
          {items.map(item => {
            const valid = isValidTckn(tckn[item.id] ?? '');
            return (
              <ACard key={item.id}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
                  <View>
                    <AT w={600} style={{ fontSize: 13 }}>{item.user?.profile?.firstName} {item.user?.profile?.lastName}</AT>
                    <AMono style={{ marginTop: 3, fontSize: 10 }}>{fmtDate(item.submittedAt)}</AMono>
                  </View>
                  <StatusPill text={st.label} color={st.color} bg={st.bg} border={st.border} pad={[2, 8]} />
                </View>
                {!!item.rejectReason && (
                  <View style={{ marginBottom: 16, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.07)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                    <AT style={{ fontSize: 11, color: adm.red }}><AT style={{ fontSize: 11, color: adm.muted }}>Red sebebi: </AT>{item.rejectReason}</AT>
                  </View>
                )}
                <AGrid gap={10} style={{ marginBottom: 16 }}>
                  <MediaPreview url={item.idFrontUrl} label="Ön Yüz" token={token} />
                  <MediaPreview url={item.idBackUrl} label="Arka Yüz" token={token} />
                  <MediaPreview url={item.livenessUrl} label="Video" isVideo token={token} />
                </AGrid>
                {tab === 'APPROVED' && !item.hasIdentityNumber && (
                  <View>
                    <AT style={{ marginBottom: 8, fontSize: 11, color: adm.amber }}>TC kimlik numarası girilmemiş. Bu kullanıcı ödeme yapamaz. Kimlik görselinden girin.</AT>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <AInput value={tckn[item.id] ?? ''} onChangeText={t => setTckn(p => ({ ...p, [item.id]: t.replace(/\D/g, '').slice(0, 11) }))} placeholder="TC Kimlik No" keyboardType="number-pad" autoComplete="off" style={{ flex: 1, letterSpacing: 1.04, paddingHorizontal: 12 }} />
                      <Btn variant="admSaveSm" disabled={savingTckn === item.id || !valid} label={savingTckn === item.id ? '…' : 'Kaydet'} onPress={() => saveTckn(item.id)} />
                    </View>
                  </View>
                )}
                {tab === 'PENDING' && (
                  <>
                    <AInput value={tckn[item.id] ?? ''} onChangeText={t => setTckn(p => ({ ...p, [item.id]: t.replace(/\D/g, '').slice(0, 11) }))} placeholder="TC Kimlik No (onay için zorunlu, kimlik görselinden girin)" keyboardType="number-pad" autoComplete="off" style={tcknInput} />
                    {(tckn[item.id] ?? '').length === 11 && !valid && <AT style={{ marginTop: -4, marginBottom: 10, fontSize: 11, color: adm.red }}>Geçersiz TC kimlik numarası</AT>}
                    {rejectOpen === item.id && (
                      <TextInput value={rejectNote[item.id] ?? ''} onChangeText={t => setRejectNote(p => ({ ...p, [item.id]: t }))} placeholder="Red sebebi (opsiyonel)..." placeholderTextColor={adm.muted} multiline numberOfLines={2} keyboardAppearance="dark"
                        style={{ marginBottom: 10, backgroundColor: adm.bg, borderWidth: 1, borderColor: adm.border, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, fontSize: 11, color: adm.text, fontFamily: sans(400), minHeight: 48, textAlignVertical: 'top' }} />
                    )}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <Btn variant="admOkMd" disabled={!!processing[item.id] || !valid} label={processing[item.id] === 'approve' ? '…' : 'Onayla'} onPress={() => approve(item.id)} />
                      {rejectOpen !== item.id
                        ? <Btn variant="admRejectMd" label="Reddet" onPress={() => setRejectOpen(item.id)} />
                        : <Btn variant="admRejectMd" selected disabled={!!processing[item.id]} label={processing[item.id] === 'reject' ? '…' : 'Reddi Onayla'} onPress={() => reject(item.id)} />}
                      {rejectOpen === item.id && <Btn variant="admCancelMd" label="İptal" onPress={() => setRejectOpen(null)} />}
                    </View>
                  </>
                )}
              </ACard>
            );
          })}
        </View>
      )}
    </APage>
  );
}
