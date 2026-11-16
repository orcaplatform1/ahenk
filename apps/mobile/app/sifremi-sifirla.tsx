// Şifre sıfırlama (2. adım: kod + yeni şifre): "Şifreni gir" ekranıyla aynı sade tasarım (AuthFlow StepScreen) — logo ve kart yok,
// sol üstte geri ok (önceki adıma döner), sola hizalı kalın başlık, alanlar, en altta tam genişlikte buton.
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { PasswordInput } from '@/components/AuthShell';
import { PillButton, StepScreen } from '@/components/AuthFlow';
import { OtpInput } from '@/components/OtpInput';
import { Btn, ErrorText } from '@/components/ui';
import { OtpCountdown, useOtpCountdown } from '@/components/OtpCountdown';
import { ll } from '@/theme/theme';

import { useTranslation } from 'react-i18next';
export default function SifremiSifirla() {
  const { t } = useTranslation();
  const router = useRouter();
  const { phone = '', until = '' } = useLocalSearchParams<{ phone?: string; until?: string }>();
  const valid = /^\+905[0-9]{9}$/.test(phone);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  // Yeni kod isteme bekleme süresi backend'den gelir: önceki ekrandan bitiş anı (until) olarak taşınır
  const countdown = useOtpCountdown();
  const startCountdown = countdown.start;
  useEffect(() => { const end = Number(until); if (end > 0) startCountdown((end - Date.now()) / 1000); }, [until, startCountdown]);

  async function resend() {
    setResending(true); setError('');
    try { const r = await api.post<{ resendSeconds?: number }>('/auth/forgot-password', { phone }); setCode(''); countdown.start(r?.resendSeconds); }
    catch (e) { countdown.startFromError(e); setError((e as Error).message); } finally { setResending(false); }
  }
  async function submit() {
    if (code.length !== 6) { setError(t('resetPw.enterCode')); return; }
    if (!password || !confirm) { setError(t('reg.fillAll')); return; }
    if (password.length < 6 || password.length > 20) { setError(t('reg.pwLength')); return; }
    if (password !== confirm) { setError(t('reg.pwMismatch')); return; }
    setLoading(true); setError('');
    try { await api.post('/auth/reset-password', { phone, code, newPassword: password }); setSuccess(true); setTimeout(() => router.replace('/giris'), 2000); }
    catch (e) { setError((e as Error).message); setCodeError(true); setTimeout(() => setCodeError(false), 500); } finally { setLoading(false); }
  }

  let content: React.ReactNode;
  if (!valid) {
    content = (
      <StepScreen title={t('forgot.titleM')} subtitle={t('resetPw.invalidLink')} onBack={() => router.back()}
        footer={<PillButton label={t('resetPw.requestCode')} primary onPress={() => router.replace('/sifremi-unuttum')} />}>
        <View />
      </StepScreen>
    );
  } else if (success) {
    content = (
      <StepScreen title={t('resetPw.updated')} subtitle={t('resetPw.redirecting')} onBack={() => router.replace('/giris')} footer={null}>
        <View />
      </StepScreen>
    );
  } else {
    content = (
      <StepScreen title={t('resetPw.newPw')} subtitle={t('resetPw.codeInfoM', { phone })} onBack={() => router.back()}
        footer={<>
          <PillButton label={loading ? t('reg.saving') : t('resetPw.reset')} primary disabled={loading || code.length !== 6} onPress={submit} />
          <Btn variant="textLink" disabled={countdown.waiting || resending} onPress={resend} label={resending ? t('forgot.sending') : t('login.resend')} />
        </>}>
        <View style={{ gap: 12 }}>
          <OtpInput value={code} onChange={(v) => { setCode(v); setError(''); }} error={codeError} />
          <OtpCountdown seconds={countdown.seconds} />
          <PasswordInput value={password} onChangeText={(t) => { setPassword(t); setError(''); }} placeholder={t('resetPw.newPw')} />
          <PasswordInput value={confirm} onChangeText={(t) => { setConfirm(t); setError(''); }} placeholder={t('resetPw.pwRepeat')} onSubmitEditing={submit} />
          <ErrorText>{error}</ErrorText>
        </View>
      </StepScreen>
    );
  }
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: ll.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{content}</KeyboardAvoidingView>;
}
