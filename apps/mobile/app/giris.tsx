// Mobil giriş ekranı (yalnız üye; mekân girişi mobil uygulamada yok). Tam ekran arka plan görseli (logo yok);
// altta yasal metin ve tam genişlikte üç buton: Telefon Numarası ile devam et → "Numaranı alabilir miyiz?" → WhatsApp kodu,
// E-posta ile devam et → "E-postan nedir?" → "Şifreni gir", Kayıt Ol → kayıt akışı. Tüm adımlarda sol üstte geri ok.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_PREFIX } from '@/lib/config';
import { api, storeLogin } from '@/lib/api';
import { PasswordInput } from '@/components/AuthShell';
import { AuthBackground, AuthHeading, useAuthBackgroundIndex, BackArrow, LegalNote, MailIcon, PhoneIcon, PillButton, StepScreen } from '@/components/AuthFlow';
import { WelcomeOverlay } from '@/components/WelcomeOverlay';
import { OtpInput } from '@/components/OtpInput';
import { Btn, BtnGhost, BtnPrimary, ErrorText, Input, T } from '@/components/ui';
import { OtpCountdown, OtpNoticeAction, otpNoticeOf, useOtpCountdown, type OtpNoticeCode } from '@/components/OtpCountdown';
import { c, ll, tw } from '@/theme/theme';

interface Sanction { type: 'WARNING' | 'SUSPENSION' | 'BAN'; reason: string; expiresAt: string | null; message: string }
interface LoginResponse { user: { firstName: string; lastName?: string }; accessToken?: string; refreshToken?: string }
type Step = 'home' | 'phone' | 'otp' | 'email' | 'password';

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
    // Bekleme süresi dolmadan kod istendiyse yanıttaki kalan saniye hataya eklenir (ortak sayaç okur)
    throw Object.assign(new Error(Array.isArray(err.message) ? err.message[0] : (err.message ?? 'Bir hata oluştu')), { resendSeconds: (data as { resendSeconds?: number }).resendSeconds, code: (data as { code?: string }).code });
  }
  return data as T;
}

export default function Giris() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('home');
  // Dönüşümlü arka plan: ekran her açıldığında sıradaki görsel (adımlar arasında geçişte değişmez)
  const bgIndex = useAuthBackgroundIndex();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpShake, setOtpShake] = useState(false);
  // Yeni kod isteme bekleme süresi backend'den gelir (ortak sayaç)
  const countdown = useOtpCountdown();
  // Numara kayıtlı değilse uyarının altında "Kayıt ol" butonu
  const [notice, setNotice] = useState<OtpNoticeCode | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sanction, setSanction] = useState<Sanction | null>(null);
  const [welcome, setWelcome] = useState<{ firstName: string; lastName: string } | null>(null);

  const phoneValid = phone.length === 10 && phone.startsWith('5');
  const emailValid = email.includes('@') && email.includes('.');
  const passwordValid = password.length >= 6 && password.length <= 20;
  const go = (s: Step) => { setError(''); setStep(s); };
  const fail = (e: unknown, shake = false) => {
    const err = e as Error & { sanction?: Sanction };
    if (err.sanction) setSanction(err.sanction);
    else { setError(err.message); if (shake) { setOtpShake(true); setTimeout(() => setOtpShake(false), 500); } }
  };

  async function sendOtp() {
    setLoading(true); setError(''); setSanction(null); setNotice(null);
    try { const r = await authPost<{ resendSeconds?: number }>('/auth/send-login-otp', { phone: `+90${phone}` }); setStep('otp'); setOtp(''); countdown.start(r?.resendSeconds); }
    // Bekleme süresi dolmadan istendi: sayaç sunucunun döndüğü kalan saniyeden başlar
    catch (e) { if (countdown.startFromError(e)) setStep('otp'); setNotice(otpNoticeOf(e)); fail(e); } finally { setLoading(false); }
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

  const sanctionModal = (
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
  );

  let content: React.ReactNode;
  if (step === 'home') {
    content = (
      <View style={{ flex: 1 }}>
        <AuthBackground index={bgIndex} overlay />
        <AuthHeading />
        {router.canGoBack() && <BackArrow onPress={() => router.back()} />}
        <View style={{ flex: 1, paddingTop: insets.top }} />
        <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 16, gap: 12 }}>
          <View style={{ marginBottom: 4 }}><LegalNote /></View>
          <PillButton label="Telefon Numarası ile devam et" icon={(col) => <PhoneIcon color={col} />} onPress={() => go('phone')} />
          <PillButton label="E-posta ile devam et" icon={(col) => <MailIcon color={col} />} onPress={() => go('email')} />
          <PillButton label="Kayıt Ol" primary onPress={() => router.push('/kayit')} />
        </View>
      </View>
    );
  } else if (step === 'phone') {
    content = (
      <StepScreen title="Numaranı alabilir miyiz?" onBack={() => go('home')}
        footer={<PillButton label={loading ? 'Gönderiliyor…' : 'İlerle'} primary disabled={loading || !phoneValid} onPress={sendOtp} />}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ justifyContent: 'center', paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12 }}>
            <T style={{ color: ll.text, fontSize: 14 }}>TR +90</T>
          </View>
          <Input form style={{ flex: 1, paddingVertical: 14 }} keyboardType="number-pad" textContentType="telephoneNumber" autoComplete="tel" autoFocus value={phone}
            onChangeText={(t) => { setPhone(t.replace(/\D/g, '').slice(0, 10)); setError(''); }} placeholder="5XX XXX XX XX" onSubmitEditing={() => phoneValid && sendOtp()} returnKeyType="next" />
        </View>
        <View style={{ marginTop: 12 }}><ErrorText>{error}</ErrorText></View>
        {!!error && !!notice && <View style={{ marginTop: 12 }}><OtpNoticeAction code={notice} /></View>}
      </StepScreen>
    );
  } else if (step === 'otp') {
    content = (
      <StepScreen title="Kodu gir" subtitle={`+90${phone} numarasına WhatsApp ile gönderilen 6 haneli kodu gir.`} onBack={() => { setOtp(''); go('phone'); }}
        footer={<>
          <PillButton label={loading ? 'Doğrulanıyor…' : 'Giriş Yap'} primary disabled={loading || otp.length !== 6} onPress={() => verifyOtp()} />
          <Btn variant="textLink" disabled={countdown.waiting || loading} onPress={sendOtp} label="Yeni kod gönder" />
        </>}>
        <OtpInput value={otp} onChange={(v) => { setOtp(v); setError(''); }} error={otpShake} />
        <View style={{ marginTop: 12 }}><OtpCountdown seconds={countdown.seconds} /></View>
        <View style={{ marginTop: 12 }}><ErrorText center>{error}</ErrorText></View>
      </StepScreen>
    );
  } else if (step === 'email') {
    content = (
      <StepScreen title="E-postan nedir?" onBack={() => go('home')}
        footer={<PillButton label="İlerle" primary disabled={!emailValid} onPress={() => go('password')} />}>
        <Input form style={{ paddingVertical: 14 }} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" autoComplete="email" autoFocus value={email}
          onChangeText={(t) => { setEmail(t); setError(''); }} placeholder="E-posta adresin" onSubmitEditing={() => emailValid && go('password')} returnKeyType="next" />
      </StepScreen>
    );
  } else {
    content = (
      <StepScreen title="Şifreni gir" onBack={() => { setPassword(''); go('email'); }}
        footer={<>
          <PillButton label={loading ? 'Giriş yapılıyor…' : 'Giriş Yap'} primary disabled={loading || !passwordValid} onPress={emailLogin} />
          {/* "Şifremi unuttum": mevcut PillButton (normal, primary olmayan) stilinde buton */}
          <PillButton label="Şifremi unuttum" onPress={() => router.push('/sifremi-unuttum')} />
        </>}>
        <PasswordInput value={password} onChangeText={(t) => { setPassword(t); setError(''); }} placeholder="Şifren" onSubmitEditing={() => passwordValid && emailLogin()} />
        <View style={{ marginTop: 12 }}><ErrorText>{error}</ErrorText></View>
      </StepScreen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: ll.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {sanctionModal}
      <WelcomeOverlay visible={!!welcome} name={`${welcome?.firstName ?? ''} ${welcome?.lastName ?? ''}`} />
      {content}
    </KeyboardAvoidingView>
  );
}
