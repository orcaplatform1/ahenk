// apps/web/components/KankaSection.tsx karşılığı (Profilim → Aktif Kankanız)
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path, Rect } from 'react-native-svg';
import { api } from '@/lib/api';
import { Btn, BtnGhost, BtnPrimary, HIT, Sheet, T } from '../ui';
import { c, gender as G, sans, tw } from '@/theme/theme';

type Gender = 'MALE' | 'FEMALE' | null;
interface KankaState {
  kanka: { initials: string; gender: Gender; since: string; locked: boolean; lockReason: string | null } | null;
  outgoingInvite: { link: string; expiresAt: string; expired: boolean } | null;
  incomingInvites: { id: string; inviterInitials: string; inviterGender: Gender; expiresAt: string }[];
  kankamla: { role: 'BUYER' | 'KANKA'; rightsLeft: number; cycles: number; packageCycles: number } | null;
  canInvite: boolean; kycApproved: boolean;
}

function Bubble({ initials, gender, size = 40 }: { initials: string; gender: Gender; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: gender === 'FEMALE' ? G.female : G.male, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' }}>
      <T w={700} style={{ fontSize: size > 40 ? 15 : 12 }}>{initials}</T>
    </View>
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
      <T numberOfLines={1} style={{ flex: 1, fontSize: 12, color: c.tBbb }}>{link}</T>
      <Pressable hitSlop={HIT} accessibilityLabel="Linki kopyala" onPress={async () => { await Clipboard.setStringAsync(link); setCopied(true); setTimeout(() => setCopied(false), 1800); }} style={{ padding: 2 }}>
        {copied ? <T style={{ fontSize: 12, color: c.ok }}>Kopyalandı ✓</T> : (
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={tw.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Rect x={9} y={9} width={12} height={12} rx={2} /><Path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </Svg>
        )}
      </Pressable>
    </View>
  );
}

const hoursLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3600000));

export function KankaSection() {
  const [state, setState] = useState<KankaState | null>(null);
  const [sheet, setSheet] = useState<'invite' | 'incoming' | 'kanka' | null>(null);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [sentLink, setSentLink] = useState<string | null>(null);
  const load = useCallback(() => { api.get<KankaState>('/kanka/me').then(setState).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  if (!state) return null;
  const incoming = state.incomingInvites[0];

  async function sendInvite() {
    if (phone.length !== 10 || !phone.startsWith('5')) { setMsg('5 ile başlayan 10 haneli numara girin.'); return; }
    setBusy(true); setMsg('');
    try { const r = await api.post<{ link: string }>('/kanka/invite', { phone: `+90${phone}` }); setSentLink(r.link); setPhone(''); load(); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  async function respond(action: 'accept' | 'decline') {
    if (!incoming) return;
    setBusy(true); setMsg('');
    try { await api.post(`/kanka/invites/${incoming.id}/${action}`, {}); setSheet(null); load(); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  async function unlink() {
    setBusy(true); setMsg('');
    try { await api.post('/kanka/unlink', {}); setSheet(null); load(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  const open = (s: 'invite' | 'incoming' | 'kanka') => { setMsg(''); setSentLink(null); setSheet(s); };

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T style={{ fontSize: 14 }}>Aktif Kankanız</T>
        {state.kanka ? (
          <Pressable onPress={() => open('kanka')} accessibilityLabel="Kanka"><Bubble initials={state.kanka.initials} gender={state.kanka.gender} /></Pressable>
        ) : incoming ? (
          <Btn variant="pillGreen" onPress={() => open('incoming')} label="Davet Var" />
        ) : (
          <Btn variant="pillRed" onPress={() => open('invite')} label="Davet Et" />
        )}
      </View>
      {!state.kanka && state.outgoingInvite && (
        <View style={{ gap: 8 }}>
          <T style={{ fontSize: 12, color: c.t888 }}>
            {state.outgoingInvite.expired ? 'Gönderdiğin davetin süresi doldu. "Davet Et" ile tekrar gönderebilirsin.' : `Davetin gönderildi · ${hoursLeft(state.outgoingInvite.expiresAt)} saat geçerli. WhatsApp ulaşmazsa linki kendin ilet:`}
          </T>
          {!state.outgoingInvite.expired && <CopyLink link={state.outgoingInvite.link} />}
        </View>
      )}
      {state.kankamla && (
        <T style={{ fontSize: 12, color: c.t888 }}>
          Kankamla: {state.kankamla.rightsLeft} masa hakkı kaldı · {state.kankamla.cycles}/{state.kankamla.packageCycles} döngü{state.kankamla.role === 'KANKA' ? ' (paket kankanda, sen ücretsiz katılıyorsun)' : ''}
        </T>
      )}
      <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
        <T w={700} style={{ fontSize: 11, letterSpacing: 0.88, color: c.red, marginBottom: 6 }}>KANKAMLA NASIL İŞLER?</T>
        <T style={{ fontSize: 12, color: c.tAaa, lineHeight: 19 }}>
          Aynı cinsiyetten, kimliği doğrulanmış bir arkadaşını kanka olarak davet et. Kankamla paketini <T w={700} style={{ fontSize: 12, color: tw.text }}>sadece birinizin alması yeterli</T>; kankan ücretsiz katılır. Paket 2 masa hakkı verir ve her hak 4 döngü geçerlidir. İkiniz, karşı cinsten bir kanka çiftiyle Pazar akşamı 4 kişilik masada buluşursunuz. Davet 48 saat geçerlidir; kanka seçildiği hafta değiştirilemez.
        </T>
      </View>

      <Sheet visible={sheet === 'invite'} onClose={() => setSheet(null)}>
        <T w={700} style={{ fontSize: 16, marginBottom: 8 }}>Kanka Davet Et</T>
        {!state.kycApproved ? (
          <T style={{ fontSize: 13, color: c.t888, lineHeight: 21 }}>Kanka davet etmek için önce kimlik doğrulamanı (KYC) tamamlamalısın.</T>
        ) : sentLink ? (
          <View style={{ gap: 12 }}>
            <T style={{ fontSize: 13, color: c.ok }}>Davet gönderildi. 48 saat geçerli.</T>
            <T style={{ fontSize: 12, color: c.t888, lineHeight: 18 }}>Davet WhatsApp ile iletildi. Ulaşmazsa bu linki kopyalayıp kankana kendin gönder:</T>
            <CopyLink link={sentLink} />
            <BtnGhost label="Tamam" full onPress={() => setSheet(null)} />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <T style={{ fontSize: 12, color: c.t888, lineHeight: 18 }}>Kankan aynı cinsiyetten olmalı ve kimliğini doğrulamış olmalı. Davet 48 saat geçerlidir.</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 14 }}>
              <T style={{ color: c.t555, fontSize: 14, marginRight: 4 }}>+90</T>
              <TextInput keyboardType="number-pad" keyboardAppearance="dark" placeholder="5XX XXX XX XX" placeholderTextColor={tw.muted} value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                style={{ flex: 1, fontSize: 14, color: tw.text, paddingVertical: 11, fontFamily: sans(400) }} />
            </View>
            {!!msg && <T style={{ fontSize: 12, color: tw.accent }}>{msg}</T>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <BtnGhost label="Vazgeç" style={{ flex: 1 }} onPress={() => setSheet(null)} />
              <BtnPrimary label={busy ? '…' : 'Davet Gönder'} style={{ flex: 1 }} disabled={busy} onPress={sendInvite} />
            </View>
          </View>
        )}
      </Sheet>

      <Sheet visible={sheet === 'incoming' && !!incoming} onClose={() => setSheet(null)}>
        {incoming && (
          <>
            <T w={700} style={{ fontSize: 16, marginBottom: 14 }}>{state.incomingInvites.length} aktif davetiniz var.</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Bubble initials={incoming.inviterInitials} gender={incoming.inviterGender} size={48} />
              <T style={{ flex: 1, fontSize: 14, color: c.tCcc, lineHeight: 21 }}><T w={700} style={{ fontSize: 14 }}>{incoming.inviterInitials}</T> sizi kanka olmak için davet etti.</T>
            </View>
            {!state.kycApproved && <T style={{ fontSize: 12, color: c.warnAmber, marginBottom: 10 }}>Kabul etmek için önce kimlik doğrulamanı (KYC) tamamlamalısın.</T>}
            {!!msg && <T style={{ fontSize: 12, color: tw.accent, marginBottom: 10 }}>{msg}</T>}
            <View style={{ gap: 8 }}>
              <BtnPrimary label={busy ? '…' : 'Kabul Et'} full disabled={busy} onPress={() => respond('accept')} />
              <BtnGhost label="Vazgeç" full disabled={busy} onPress={() => respond('decline')} />
            </View>
          </>
        )}
      </Sheet>

      <Sheet visible={sheet === 'kanka' && !!state.kanka} onClose={() => setSheet(null)}>
        {state.kanka && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <Bubble initials={state.kanka.initials} gender={state.kanka.gender} size={48} />
              <View>
                <T w={700} style={{ fontSize: 16 }}>Kankan</T>
                <T style={{ fontSize: 12, color: c.t888 }}>{new Date(state.kanka.since).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' })} tarihinden beri</T>
              </View>
            </View>
            <T style={{ fontSize: 12, color: state.kanka.locked ? c.warnAmber : c.t888, marginBottom: 12, lineHeight: 18 }}>
              {state.kanka.locked ? state.kanka.lockReason : 'Kankalıktan çıkarsan Kankamla masalarına birlikte katılamazsınız. İstersen daha sonra tekrar kanka olabilirsiniz.'}
            </T>
            {!!msg && <T style={{ fontSize: 12, color: tw.accent, marginBottom: 10 }}>{msg}</T>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <BtnGhost label="Kapat" style={{ flex: 1 }} onPress={() => setSheet(null)} />
              {!state.kanka.locked && (
                <Btn variant="dangerPill" onPress={unlink} disabled={busy} label={busy ? '…' : 'Kankalıktan Çıkar'} />
              )}
            </View>
          </>
        )}
      </Sheet>
    </>
  );
}
