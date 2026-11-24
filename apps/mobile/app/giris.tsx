// Mobil giriş ekranı (yalnız üye; mekân girişi mobil uygulamada yok). Tam ekran arka plan görseli (logo yok);
// altta yasal metin ve tam genişlikte üç buton: Telefon Numarası ile devam et → "Numaranı alabilir miyiz?" → WhatsApp kodu,
// E-posta ile devam et → "E-postan nedir?" → "Şifreni gir", Kayıt Ol → kayıt akışı. Tüm adımlarda sol üstte geri ok.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_PREFIX } from '@/lib/config';
import { api, langHeaders, storeLogin } from '@/lib/api';
import { PasswordInput } from '@/components/AuthShell';
import { AuthBackground, AuthHeading, useAuthBackgroundIndex, BackArrow, LegalNote, MailIcon, PhoneIcon, PillButton, StepScreen } from '@/components/AuthFlow';
import { WelcomeOverlay } from '@/components/WelcomeOverlay';
import { OtpInput } from '@/components/OtpInput';
import { Btn, StdButton, ErrorText, Input, T } from '@/components/ui';
import { OtpCountdown, OtpNoticeAction, otpNoticeOf, useOtpCountdown, type OtpNoticeCode } from '@/components/OtpCountdown';
import { c, ll, tw } from '@/theme/theme';
import { useTranslation } from 'react-i18next';
import { DEFAULT_PHONE_COUNTRY, formatDateTime, toE164 } from '@ahenk/shared';
import i18n from '@/lib/i18n';
import { CountryCodeButton } from '@/components/PhoneCountry';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

interface Sanction { type: 'WARNING' | 'SUSPENSION' | 'BAN'; reason: string; expiresAt: string | null; message: string }
interface LoginResponse { user: { firstName: string; lastName?: string }; accessToken?: string; refreshToken?: string }
type Step = 'home' | 'phone' | 'otp' | 'email' | 'password';

// Origin başlığı gönderilmez: backend Origin'siz istemciye token'ı gövdede döndürür
async function authPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', ...langHeaders() }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as Partial<Sanction> & { message?: string | string[] };
    if (res.status === 403 && (err.type === 'SUSPENSION' || err.type === 'BAN' || err.type === 'WARNING')) {
      const e = new Error((err.message as string) ?? i18n.t('login.accessBlocked')) as Error & { sanction?: Sanction };
      e.sanction = err as Sanction; throw e;
    }
    // Bekleme süresi dolmadan kod istendiyse yanıttaki kalan saniye hataya eklenir (ortak sayaç okur)
    throw Object.assign(new Error(Array.isArray(err.message) ? err.message[0] : (err.message ?? i18n.t('common.genericError'))), { resendSeconds: (data as { resendSeconds?: number }).resendSeconds, code: (data as { code?: string }).code });
  }
  return data as T;
}

export default function Giris() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('home');
  // Dönüşümlü arka plan: ekran her açıldığında sıradaki görsel (adımlar arasında geçişte değişmez)
  const bgIndex = useAuthBackgroundIndex();
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState(DEFAULT_PHONE_COUNTRY);
  // E.164 (libphonenumber-js, seçilen ülkeye göre)
  const phoneE164 = toE164(country, phone);
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

  const phoneValid = !!phoneE164;
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
    try { const r = await authPost<{ resendSeconds?: number }>('/auth/send-login-otp', { phone: phoneE164 }); setStep('otp'); setOtp(''); countdown.start(r?.resendSeconds); }
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
    try { await afterLogin(await authPost<LoginResponse>('/auth/verify-login-otp', { phone: phoneE164, code })); } catch (e) { fail(e, true); } finally { setLoading(false); }
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
              <T w={600} style={{ fontSize: 18, color: tw.accent }}>{sanction.type === 'WARNING' ? t('login.warning') : sanction.type === 'SUSPENSION' ? t('login.suspended') : t('login.banned')}</T>
              {!!sanction.expiresAt && <T style={{ fontSize: 12, color: ll.text2 }}>{t('login.sanctionEnds', { date: formatDateTime(sanction.expiresAt) })}</T>}
            </View>
            <T style={{ fontSize: 14, color: c.tCcc, lineHeight: 22 }}>{sanction.reason}</T>
            <T style={{ fontSize: 12, color: ll.label }}>
              {t('login.contactPre')} <T style={{ fontSize: 12, color: c.red, textDecorationLine: 'underline' }} onPress={() => Linking.openURL('mailto:bilgi@ahenk.co')}>bilgi@ahenk.co</T> {t('login.contactPost')}
            </T>
            {sanction.type === 'WARNING' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
                <StdButton variant="ghost" label={t('common.cancel')} style={{ flex: 1 }} onPress={async () => { await api.logout(); setSanction(null); }} />
                <StdButton variant="primary" label={t('common.continue')} style={{ flex: 1 }} onPress={() => { setSanction(null); router.replace('/(tabs)'); }} />
              </View>
            ) : <StdButton variant="ghost" label={t('common.close')} full style={{ marginTop: 4 }} onPress={() => setSanction(null)} />}
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
        {/* Dil seçici: sağdan 20 pt, AHENK başlığının dikey ortasında (başlık güvenli alanın 24 pt altında, satır yüksekliği 44) */}
        <LanguageSwitcher top={insets.top + 24} />
        {router.canGoBack() && <BackArrow onPress={() => router.back()} />}
        <View style={{ flex: 1, paddingTop: insets.top }} />
        <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 16, gap: 12 }}>
          <View style={{ marginBottom: 4 }}><LegalNote /></View>
          <PillButton label={t('login.withPhoneM')} icon={(col) => <PhoneIcon color={col} />} onPress={() => go('phone')} />
          <PillButton label={t('login.withEmailM')} icon={(col) => <MailIcon color={col} />} onPress={() => go('email')} />
          <PillButton label={t('kankaInv.register')} primary onPress={() => router.push('/kayit')} />
        </View>
      </View>
    );
  } else if (step === 'phone') {
    content = (
      <StepScreen title={t('login.phoneTitleM')} onBack={() => go('home')}
        footer={<PillButton label={loading ? t('login.sending') : t('login.next')} primary disabled={loading || !phoneValid} onPress={sendOtp} />}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <CountryCodeButton country={country} onChange={(code) => { setCountry(code); setError(''); }} />
          <Input form style={{ flex: 1, paddingVertical: 14 }} keyboardType="number-pad" textContentType="telephoneNumber" autoComplete="tel" autoFocus value={phone}
            onChangeText={(v) => { setPhone(v.replace(/\D/g, '').slice(0, 15)); setError(''); }} placeholder={country === 'TR' ? '5XX XXX XX XX' : ''} onSubmitEditing={() => phoneValid && sendOtp()} returnKeyType="next" />
        </View>
        <View style={{ marginTop: 12 }}><ErrorText>{error}</ErrorText></View>
        {!!error && !!notice && <View style={{ marginTop: 12 }}><OtpNoticeAction code={notice} /></View>}
      </StepScreen>
    );
  } else if (step === 'otp') {
    content = (
      <StepScreen title={t('login.codeTitleM')} subtitle={t('otp.codeSentToM', { phone: phoneE164 ?? phone })} onBack={() => { setOtp(''); go('phone'); }}
        footer={<>
          <PillButton label={loading ? t('login.verifying') : t('login.submit')} primary disabled={loading || otp.length !== 6} onPress={() => verifyOtp()} />
          <Btn variant="textLink" disabled={countdown.waiting || loading} onPress={sendOtp} label={t('login.resend')} />
        </>}>
        <OtpInput value={otp} onChange={(v) => { setOtp(v); setError(''); }} error={otpShake} />
        <View style={{ marginTop: 12 }}><OtpCountdown seconds={countdown.seconds} /></View>
        <View style={{ marginTop: 12 }}><ErrorText center>{error}</ErrorText></View>
      </StepScreen>
    );
  } else if (step === 'email') {
    content = (
      <StepScreen title={t('login.emailTitleM')} onBack={() => go('home')}
        footer={<PillButton label={t('login.next')} primary disabled={!emailValid} onPress={() => go('password')} />}>
        <Input form style={{ paddingVertical: 14 }} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" autoComplete="email" autoFocus value={email}
          onChangeText={(v) => { setEmail(v); setError(''); }} placeholder={t('login.emailPlaceholder')} onSubmitEditing={() => emailValid && go('password')} returnKeyType="next" />
      </StepScreen>
    );
  } else {
    content = (
      <StepScreen title={t('login.passwordTitleM')} onBack={() => { setPassword(''); go('email'); }}
        footer={<>
          <PillButton label={loading ? t('login.loggingIn') : t('login.submit')} primary disabled={loading || !passwordValid} onPress={emailLogin} />
          {/* t('login.forgotM'): mevcut PillButton (normal, primary olmayan) stilinde buton */}
          <PillButton label={t('login.forgotM')} onPress={() => router.push('/sifremi-unuttum')} />
        </>}>
        <PasswordInput value={password} onChangeText={(v) => { setPassword(v); setError(''); }} placeholder={t('login.passwordPlaceholder')} onSubmitEditing={() => passwordValid && emailLogin()} />
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
