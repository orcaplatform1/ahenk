// Giriş ekranı: "Üye Girişi" (apps/web/app/giris/page.tsx'in aynısı) ve "İşletme Girişi" (varsayılan WhatsApp kodu, ikinci seçenek e-posta + şifre)
import React, { useEffect, useState } from 'react';
import { Image, Linking, Modal, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { API_PREFIX } from '@/lib/config';
import { api, storeLogin } from '@/lib/api';
import { setVenueKind } from '@/lib/session';
import { venueApi } from '@/lib/venueApi';
import { AuthShell, PasswordInput, PhoneRow, Toggle } from '@/components/AuthShell';
import { OtpInput } from '@/components/OtpInput';
import { BtnGhost, BtnPrimary, Card, ErrorText, Input, Serif, T } from '@/components/ui';
import { c, ll, tw } from '@/theme/theme';

interface Sanction { type: 'WARNING' | 'SUSPENSION' | 'BAN'; reason: string; expiresAt: string | null; message: string }
interface LoginResponse { user: { firstName: string; lastName?: string }; accessToken?: string; refreshToken?: string }
type Method = 'whatsapp' | 'email';

// Origin başlığı gönderilmez: backend Origin'siz istemciye token'ı gövdede döndürür
async function authPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as Partial<Sanction> & { message?: string | string[] };
    if (res.status === 403 && (err.type === 'SUSPENSION' || err.type === 'BAN' || err.type === 'WARNING')) {
      const e = new Error((err.message as string) ?? 'Erişim engellendi') as Error & { sanction?: Sanction };
      e.sanction = err as Sanction; throw e;
    }
    throw new Error(Array.isArray(err.message) ? err.message[0] : (err.message ?? 'Bir hata oluştu'));
  }
  return data as T;
}

function useResend() {
  const [left, setLeft] = useState(0);
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(n => n - 1), 1000); return () => clearTimeout(t); }, [left]);
  return [left, setLeft] as const;
}

function MemberLogin() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('whatsapp');
  const [phone, setPhone] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpShake, setOtpShake] = useState(false);
  const [resendIn, setResendIn] = useResend();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sanction, setSanction] = useState<Sanction | null>(null);
  const [welcome, setWelcome] = useState<{ firstName: string; lastName: string } | null>(null);

  const phoneValid = phone.length === 10 && phone.startsWith('5');
  const canSubmit = method === 'whatsapp' ? (otpStep ? otp.length === 6 : phoneValid) : (email.includes('@') && email.includes('.') && password.length >= 6 && password.length <= 20);
  const fail = (e: unknown, shake = false) => {
    const err = e as Error & { sanction?: Sanction };
    if (err.sanction) setSanction(err.sanction);
    else { setError(err.message); if (shake) { setOtpShake(true); setTimeout(() => setOtpShake(false), 500); } }
  };

  async function sendOtp() {
    setLoading(true); setError(''); setSanction(null);
    try { await authPost('/auth/send-login-otp', { phone: `+90${phone}` }); setOtpStep(true); setOtp(''); setResendIn(60); } catch (e) { fail(e); } finally { setLoading(false); }
  }
  async function afterLogin(data: LoginResponse) {
    await storeLogin(data);
    try {
      const me = await api.get<{ role?: string; activeSanction?: Sanction | null }>('/auth/me');
      if (me?.activeSanction?.type === 'WARNING') { setSanction(me.activeSanction); return; }
    } catch { /* devam */ }
    setWelcome({ firstName: data.user.firstName, lastName: data.user.lastName ?? '' });
    setTimeout(() => router.replace('/(tabs)'), 2000);
  }
  async function verifyOtp(code = otp) {
    setLoading(true); setError(''); setSanction(null);
    try { await afterLogin(await authPost<LoginResponse>('/auth/verify-login-otp', { phone: `+90${phone}`, code })); } catch (e) { fail(e, true); } finally { setLoading(false); }
  }
  async function emailLogin() {
    setLoading(true); setError(''); setSanction(null);
    try { await afterLogin(await authPost<LoginResponse>('/auth/login', { email, password })); } catch (e) { fail(e); } finally { setLoading(false); }
  }
  function switchMethod(m: Method) { setMethod(m); setError(''); setOtpStep(false); setOtp(''); }

  return (
    <>
      <Modal visible={!!sanction} transparent animationType="fade" onRequestClose={() => setSanction(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          {sanction && (
            <View style={{ width: '100%', maxWidth: 384, borderRadius: 16, padding: 24, gap: 16, backgroundColor: '#1a0505', borderWidth: 1, borderColor: 'rgba(192,57,43,0.5)' }}>
              <View style={{ gap: 4 }}>
                <T w={600} style={{ fontSize: 18, color: tw.accent }}>{sanction.type === 'WARNING' ? 'Uyarı' : sanction.type === 'SUSPENSION' ? 'Hesap Askıya Alındı' : 'Hesap Engellendi'}</T>
                {!!sanction.expiresAt && <T style={{ fontSize: 12, color: ll.text2 }}>Bitiş: {new Date(sanction.expiresAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</T>}
              </View>
              <T style={{ fontSize: 14, color: c.tCcc, lineHeight: 22 }}>{sanction.reason}</T>
              <T style={{ fontSize: 12, color: ll.label }}>
                Hatalı olduğunu düşünüyorsan <T style={{ fontSize: 12, color: c.red, textDecorationLine: 'underline' }} onPress={() => Linking.openURL('mailto:bilgi@ahenk.co')}>bilgi@ahenk.co</T> adresiyle iletişime geç.
              </T>
              {sanction.type === 'WARNING' ? (
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                  <BtnGhost label="İptal" style={{ flex: 1 }} onPress={async () => { await api.logout(); setSanction(null); }} />
                  <BtnPrimary label="Devam Et" style={{ flex: 1 }} onPress={() => { setSanction(null); router.replace('/(tabs)'); }} />
                </View>
              ) : <BtnGhost label="Kapat" full style={{ marginTop: 4 }} onPress={() => setSanction(null)} />}
            </View>
          )}
        </View>
      </Modal>
      <Modal visible={!!welcome} animationType="fade">
        <View style={{ flex: 1, backgroundColor: tw.bg, alignItems: 'center', paddingTop: '40%' }}>
          <View style={{ alignItems: 'center', gap: 8, marginBottom: 32 }}>
            <Image source={require('@/assets/logo.png')} style={{ width: 48, height: 48, borderRadius: 24 }} />
            <T w={600} style={{ fontSize: 15, letterSpacing: 1.8 }}>AHENK</T>
          </View>
          <Serif style={{ fontSize: 36, marginBottom: 4 }}>Hoş geldin,</Serif>
          <Serif style={{ fontSize: 36, textAlign: 'center' }}>{welcome?.firstName} {welcome?.lastName}</Serif>
        </View>
      </Modal>

      <Card>
        <View style={{ marginBottom: 24 }}>
          <Toggle items={[{ key: 'whatsapp', label: 'WhatsApp ile Giriş' }, { key: 'email', label: 'E-posta ile Giriş' }]} value={method} onChange={switchMethod} />
        </View>
        {method === 'whatsapp' && !otpStep && <View style={{ gap: 12 }}><PhoneRow value={phone} onChange={(v) => { setPhone(v); setError(''); }} onSubmit={() => phoneValid && sendOtp()} /><ErrorText>{error}</ErrorText></View>}
        {method === 'whatsapp' && otpStep && (
          <View style={{ gap: 16 }}>
            <T style={{ color: ll.label, fontSize: 13, textAlign: 'center' }}>+90{phone} numarasına gönderilen 6 haneli kodu gir.</T>
            <OtpInput value={otp} onChange={(v) => { setOtp(v); setError(''); }} error={otpShake} />
            <ErrorText center>{error}</ErrorText>
          </View>
        )}
        {method === 'email' && (
          <View style={{ gap: 12 }}>
            <Input form style={{ paddingVertical: 14 }} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" autoComplete="email" value={email} onChangeText={(t) => { setEmail(t); setError(''); }} placeholder="E-posta adresin" />
            <PasswordInput value={password} onChangeText={(t) => { setPassword(t); setError(''); }} placeholder="Şifren" onSubmitEditing={() => canSubmit && emailLogin()} />
            <ErrorText>{error}</ErrorText>
          </View>
        )}
      </Card>
      <View style={{ marginTop: 16, gap: 12 }}>
        {method === 'whatsapp' && !otpStep && <BtnPrimary label={loading ? 'Gönderiliyor…' : 'Kod Gönder'} disabled={loading || !phoneValid} style={{ width: '72%', alignSelf: 'center', marginTop: 4 }} onPress={sendOtp} />}
        {method === 'whatsapp' && otpStep && (
          <>
            <BtnPrimary label={loading ? 'Doğrulanıyor…' : 'Giriş Yap'} full disabled={loading || !canSubmit} onPress={() => verifyOtp()} />
            <Pressable disabled={resendIn > 0 || loading} onPress={sendOtp} style={{ minHeight: 44, justifyContent: 'center' }}>
              <T style={{ fontSize: 13, color: ll.label, textAlign: 'center' }}>{resendIn > 0 ? `Kodu tekrar gönder (${resendIn} sn)` : 'Kodu tekrar gönder'}</T>
            </Pressable>
            <Pressable onPress={() => { setOtpStep(false); setOtp(''); setError(''); }} style={{ minHeight: 44, justifyContent: 'center' }}>
              <T style={{ fontSize: 13, color: ll.label, textAlign: 'center' }}>← Numarayı değiştir</T>
            </Pressable>
          </>
        )}
        {method === 'email' && <BtnPrimary label={loading ? 'Giriş yapılıyor…' : 'Giriş Yap'} disabled={loading || !canSubmit} style={{ width: '72%', alignSelf: 'center', marginTop: 4 }} onPress={emailLogin} />}
      </View>
      <View style={{ marginTop: 16, gap: 12 }}>
        <BtnGhost label="Şifremi Unuttum" style={{ width: '72%', alignSelf: 'center' }} onPress={() => router.push('/sifremi-unuttum')} />
        <BtnPrimary label="Kayıt Ol" style={{ width: '72%', alignSelf: 'center' }} onPress={() => router.push('/kayit')} />
      </View>
    </>
  );
}

function VenueLogin() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('whatsapp');
  const [phone, setPhone] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [resendIn, setResendIn] = useResend();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const phoneValid = phone.length === 10 && phone.startsWith('5');

  async function done() { await setVenueKind(); router.replace('/mekan/bilgiler'); }
  async function sendOtp() {
    setLoading(true); setError('');
    try { await venueApi.post('/send-login-otp', { phone: `+90${phone}` }); setOtpStep(true); setOtp(''); setResendIn(60); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }
  async function verify(code = otp) {
    setLoading(true); setError('');
    try { await venueApi.post('/verify-login-otp', { phone: `+90${phone}`, code }); await done(); } catch (e) { setError((e as Error).message); setLoading(false); }
  }
  async function emailLogin() {
    setLoading(true); setError('');
    try { await venueApi.post('/login', { email, password }); await done(); } catch (e) { setError((e as Error).message); setLoading(false); }
  }
  return (
    <>
      <Card>
        <View style={{ marginBottom: 24 }}>
          <Toggle items={[{ key: 'whatsapp', label: 'WhatsApp ile Giriş' }, { key: 'email', label: 'E-posta ile Giriş' }]} value={method} onChange={(m) => { setMethod(m); setError(''); setOtpStep(false); setOtp(''); }} />
        </View>
        {method === 'whatsapp' && !otpStep && <View style={{ gap: 12 }}><PhoneRow value={phone} onChange={(v) => { setPhone(v); setError(''); }} onSubmit={() => phoneValid && sendOtp()} /><ErrorText>{error}</ErrorText></View>}
        {method === 'whatsapp' && otpStep && (
          <View style={{ gap: 16 }}>
            <T style={{ color: ll.label, fontSize: 13, textAlign: 'center' }}>+90{phone} numarasına gönderilen 6 haneli kodu gir.</T>
            <OtpInput value={otp} onChange={(v) => { setOtp(v); setError(''); }} />
            <ErrorText center>{error}</ErrorText>
          </View>
        )}
        {method === 'email' && (
          <View style={{ gap: 12 }}>
            <Input form style={{ paddingVertical: 14 }} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" value={email} onChangeText={(t) => { setEmail(t); setError(''); }} placeholder="E-posta" />
            <PasswordInput value={password} onChangeText={(t) => { setPassword(t); setError(''); }} placeholder="Şifre" onSubmitEditing={emailLogin} />
            <ErrorText>{error}</ErrorText>
          </View>
        )}
      </Card>
      <View style={{ marginTop: 16, gap: 12 }}>
        {method === 'whatsapp' && !otpStep && <BtnPrimary label={loading ? 'Gönderiliyor…' : 'Kod Gönder'} disabled={loading || !phoneValid} style={{ width: '72%', alignSelf: 'center', marginTop: 4 }} onPress={sendOtp} />}
        {method === 'whatsapp' && otpStep && (
          <>
            <BtnPrimary label={loading ? 'Doğrulanıyor…' : 'Giriş Yap'} full disabled={loading || otp.length !== 6} onPress={() => verify()} />
            <Pressable disabled={resendIn > 0 || loading} onPress={sendOtp} style={{ minHeight: 44, justifyContent: 'center' }}>
              <T style={{ fontSize: 13, color: ll.label, textAlign: 'center' }}>{resendIn > 0 ? `Kodu tekrar gönder (${resendIn} sn)` : 'Kodu tekrar gönder'}</T>
            </Pressable>
            <Pressable onPress={() => { setOtpStep(false); setOtp(''); setError(''); }} style={{ minHeight: 44, justifyContent: 'center' }}>
              <T style={{ fontSize: 13, color: ll.label, textAlign: 'center' }}>← Numarayı değiştir</T>
            </Pressable>
          </>
        )}
        {method === 'email' && <BtnPrimary label={loading ? 'Giriş yapılıyor…' : 'Giriş Yap'} disabled={loading || !email || !password} style={{ width: '72%', alignSelf: 'center', marginTop: 4 }} onPress={emailLogin} />}
      </View>
      {method === 'email' && (
        <View style={{ marginTop: 16 }}>
          <BtnGhost label="Şifremi Unuttum" style={{ width: '72%', alignSelf: 'center' }} onPress={() => router.push('/mekan-sifremi-unuttum')} />
        </View>
      )}
    </>
  );
}

export default function Giris() {
  const [kind, setKind] = useState<'uye' | 'isletme'>('uye');
  return (
    <AuthShell title="Giriş Yap">
      <View style={{ marginBottom: 16 }}>
        <Toggle items={[{ key: 'uye', label: 'Üye Girişi' }, { key: 'isletme', label: 'İşletme Girişi' }]} value={kind} onChange={setKind} />
      </View>
      {kind === 'uye' ? <MemberLogin /> : <VenueLogin />}
    </AuthShell>
  );
}
