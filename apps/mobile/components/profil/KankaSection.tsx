// apps/web/components/KankaSection.tsx karşılığı (Profilim → Aktif Kankanız)
import { useCallback, useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';
import { api } from '@/lib/api';
import { Btn, StdButton, HIT, Sheet, T } from '../ui';
import { c, gender as G, sans, tw } from '@/theme/theme';
import { useTranslation } from 'react-i18next';
import { DEFAULT_PHONE_COUNTRY, formatNamed, toE164 } from '@ahenk/shared';
import { currentLang } from '@/lib/i18n';
import { CountryCodeButton } from '@/components/PhoneCountry';

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
      <T w={700} style={{ fontSize: size > 40 ? 15 : 12, lineHeight: size > 40 ? 22.5 : 18 }}>{initials}</T>
    </View>
  );
}

function CopyLink({ link }: { link: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
      <T numberOfLines={1} style={{ flex: 1, fontSize: 12, lineHeight: 18, color: c.tBbb }}>{link}</T>
      <Pressable hitSlop={HIT} accessibilityLabel={t('kanka.copyLink')} onPress={async () => { await Clipboard.setStringAsync(link); setCopied(true); setTimeout(() => setCopied(false), 1800); }} style={{ padding: 2 }}>
        {copied ? <T style={{ fontSize: 12, lineHeight: 18, color: c.ok }}>{t('kanka.copied')}</T> : (
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
  const { t } = useTranslation();
  const router = useRouter();
  const [state, setState] = useState<KankaState | null>(null);
  const [sheet, setSheet] = useState<'invite' | 'incoming' | 'kanka' | null>(null);
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const phoneE164 = toE164(country, phone);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [sentLink, setSentLink] = useState<string | null>(null);
  const load = useCallback(() => { api.get<KankaState>('/kanka/me').then(setState).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  // Bekleyen davetin 48 saati dolunca buton kendiliğinden "Davet Et" olur (süre bitiminde durum yeniden yüklenir)
  const pendingUntil = state?.outgoingInvite && !state.outgoingInvite.expired ? state.outgoingInvite.expiresAt : null;
  useEffect(() => {
    if (!pendingUntil) return;
    const tm = setTimeout(load, Math.max(0, new Date(pendingUntil).getTime() - Date.now()) + 1000);
    return () => clearTimeout(tm);
  }, [pendingUntil, load]);
  if (!state) return null;
  const incoming = state.incomingInvites[0];

  async function sendInvite() {
    if (!phoneE164) { setMsg(t('phone.invalid')); return; }
    setBusy(true); setMsg('');
    try { const r = await api.post<{ link: string }>('/kanka/invite', { phone: phoneE164 }); setSentLink(r.link); setPhone(''); load(); }
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
  async function cancelInvite() {
    setBusy(true);
    try { await api.post('/kanka/invite/cancel', {}); } catch { /* durum yeniden yüklenir */ } finally { setBusy(false); load(); }
  }
  const open = (s: 'invite' | 'incoming' | 'kanka') => { setMsg(''); setSentLink(null); setSheet(s); };

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T style={{ fontSize: 14 }}>{t('kanka.activeKanka')}</T>
        {state.kanka ? (
          <Pressable onPress={() => open('kanka')} accessibilityLabel={t('kanka.yourKanka')}><Bubble initials={state.kanka.initials} gender={state.kanka.gender} /></Pressable>
        ) : incoming ? (
          <Btn variant="pillGreen" onPress={() => open('incoming')} label={t('kanka.hasInvite')} />
        ) : pendingUntil ? (
          <Btn variant="pillRed" disabled={busy} onPress={cancelInvite} label={t('kanka.cancelInvite')} />
        ) : (
          <Btn variant="pillRed" onPress={() => open('invite')} label={t('kanka.invite')} />
        )}
      </View>
      {!state.kanka && state.outgoingInvite && (
        <View style={{ gap: 8 }}>
          <T style={{ fontSize: 12, color: c.t888 }}>
            {state.outgoingInvite.expired ? t('kanka.inviteExpired') : t('kanka.inviteSent', { hours: hoursLeft(state.outgoingInvite.expiresAt) })}
          </T>
          {!state.outgoingInvite.expired && <CopyLink link={state.outgoingInvite.link} />}
        </View>
      )}
      {state.kankamla && (
        <T style={{ fontSize: 12, color: c.t888 }}>
          {t('kanka.rightsLeft', { count: state.kankamla.rightsLeft })}{state.kankamla.role === 'KANKA' ? ` ${t('kanka.freeRider')}` : ''}
        </T>
      )}
      <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
        <T w={700} style={{ fontSize: 11, letterSpacing: 0.88, color: c.red, marginBottom: 6 }}>{t('kanka.howTitle')}</T>
        <T style={{ fontSize: 12, color: c.tAaa, lineHeight: 19.2 }}>
          {t('kanka.howBody')}
        </T>
      </View>

      <Sheet visible={sheet === 'invite'} onClose={() => setSheet(null)} avoidKeyboard>
        <T w={700} style={{ fontSize: 16, marginBottom: 8 }}>{t('kanka.inviteTitle')}</T>
        {!state.kycApproved ? (
          <View style={{ gap: 12 }}>
            <T style={{ fontSize: 13, color: c.tAaa, lineHeight: 19.5 }}>{t('kanka.verifyFirst')}</T>
            <StdButton variant="primary" label={t('kanka.verifyMe')} full onPress={() => { setSheet(null); router.navigate({ pathname: '/(tabs)/profilim', params: { tab: 'kyc' } }); }} />
          </View>
        ) : sentLink ? (
          <View style={{ gap: 12 }}>
            <T style={{ fontSize: 13, color: c.ok }}>{t('kanka.sentOk')}</T>
            <T style={{ fontSize: 12, color: c.t888, lineHeight: 18 }}>{t('kanka.sentShare')}</T>
            <CopyLink link={sentLink} />
            <StdButton variant="ghost" label={t('kanka.ok')} full onPress={() => setSheet(null)} />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <T style={{ fontSize: 12, color: c.t888, lineHeight: 18 }}>{t('kanka.rules')}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <CountryCodeButton country={country} onChange={(code) => { setCountry(code); setMsg(''); }} />
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 14 }}>
                <TextInput keyboardType="number-pad" keyboardAppearance="dark" placeholder={country === 'TR' ? '5XX XXX XX XX' : ''} placeholderTextColor={tw.muted} value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 15))}
                  style={{ flex: 1, fontSize: 14, color: tw.text, paddingVertical: 11, fontFamily: sans(400) }} />
              </View>
            </View>
            {!!msg && <T style={{ fontSize: 12, lineHeight: 18, color: tw.accent }}>{msg}</T>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <StdButton variant="ghost" label={t('kanka.cancel')} style={{ flex: 1 }} onPress={() => setSheet(null)} />
              <StdButton variant="primary" label={busy ? '…' : t('kanka.sendInvite')} style={[{ flex: 1 }, busy && { opacity: 0.5 }]} disabled={busy} onPress={sendInvite} />
            </View>
          </View>
        )}
      </Sheet>

      <Sheet visible={sheet === 'incoming' && !!incoming} onClose={() => setSheet(null)}>
        {incoming && (
          <>
            <T w={700} style={{ fontSize: 16, marginBottom: 14 }}>{state.incomingInvites.length} aktif davetin var.</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Bubble initials={incoming.inviterInitials} gender={incoming.inviterGender} size={48} />
              <T style={{ flex: 1, fontSize: 14, color: c.tCcc, lineHeight: 21 }}>{t('kanka.invitedYouPre')}<T w={700} style={{ fontSize: 14 }}>{incoming.inviterInitials}</T> {t('kanka.invitedYouPost')}</T>
            </View>
            {!!msg && <T style={{ fontSize: 12, lineHeight: 18, color: tw.accent, marginBottom: 10 }}>{msg}</T>}
            <View style={{ gap: 8 }}>
              <StdButton variant="primary" label={busy ? '…' : t('kanka.accept')} full disabled={busy} style={busy ? { opacity: 0.5 } : undefined} onPress={() => respond('accept')} />
              <StdButton variant="ghost" label={t('kanka.cancel')} full disabled={busy} onPress={() => respond('decline')} />
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
                <T w={700} style={{ fontSize: 16 }}>{t('kanka.yourKanka')}</T>
                <T style={{ fontSize: 12, lineHeight: 18, color: c.t888 }}>{t('kanka.since', { date: formatNamed(state.kanka.since, currentLang(), { day: 'numeric', month: 'long', year: 'numeric' }) })}</T>
              </View>
            </View>
            <T style={{ fontSize: 12, color: state.kanka.locked ? c.warnAmber : c.t888, marginBottom: 12, lineHeight: 18 }}>
              {state.kanka.locked ? state.kanka.lockReason : t('kanka.leaveInfo')}
            </T>
            {!!msg && <T style={{ fontSize: 12, lineHeight: 18, color: tw.accent, marginBottom: 10 }}>{msg}</T>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <StdButton variant="ghost" label={t('kanka.close')} style={{ flex: 1 }} onPress={() => setSheet(null)} />
              {!state.kanka.locked && (
                <Btn variant="dangerPill" onPress={unlink} disabled={busy} label={busy ? '…' : t('kanka.leave')} />
              )}
            </View>
          </>
        )}
      </Sheet>
    </>
  );
}
