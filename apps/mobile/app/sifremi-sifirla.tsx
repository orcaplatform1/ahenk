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
import { ll, tw } from '@/theme/theme';

export default function SifremiSifirla() {
  const router = useRouter();
  const { phone = '' } = useLocalSearchParams<{ phone?: string }>();
  const valid = /^\+905[0-9]{9}$/.test(phone);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendIn, setResendIn] = useState(60);
  const [resending, setResending] = useState(false);
  useEffect(() => { if (resendIn <= 0) return; const t = setTimeout(() => setResendIn(n => n - 1), 1000); return () => clearTimeout(t); }, [resendIn]);

  async function resend() {
    setResending(true); setError('');
    try { await api.post('/auth/forgot-password', { phone }); setCode(''); setResendIn(60); } catch (e) { setError((e as Error).message); } finally { setResending(false); }
  }
  async function submit() {
    if (code.length !== 6) { setError('6 haneli kodu girin.'); return; }
    if (!password || !confirm) { setError('Tüm alanları doldurun.'); return; }
    if (password.length < 6 || password.length > 20) { setError('Şifre 6-20 karakter arasında olmalı.'); return; }
    if (password !== confirm) { setError('Şifreler eşleşmiyor.'); return; }
    setLoading(true); setError('');
    try { await api.post('/auth/reset-password', { phone, code, newPassword: password }); setSuccess(true); setTimeout(() => router.replace('/giris'), 2000); }
    catch (e) { setError((e as Error).message); setCodeError(true); setTimeout(() => setCodeError(false), 500); } finally { setLoading(false); }
  }

  let content: React.ReactNode;
  if (!valid) {
    content = (
      <StepScreen title="Şifreni sıfırla" subtitle="Bağlantı geçersiz. Lütfen kodu yeniden iste." onBack={() => router.back()}
        footer={<PillButton label="Kod İste" primary onPress={() => router.replace('/sifremi-unuttum')} />}>
        <View />
      </StepScreen>
    );
  } else if (success) {
    content = (
      <StepScreen title="Şifren güncellendi" subtitle="Giriş sayfasına yönlendiriliyorsun…" onBack={() => router.replace('/giris')} footer={null}>
        <View />
      </StepScreen>
    );
  } else {
    content = (
      <StepScreen title="Yeni şifre" subtitle={`${phone} numarasına WhatsApp ile gönderilen 6 haneli kodu gir ve yeni şifreni belirle.`} onBack={() => router.back()}
        footer={<>
          <PillButton label={loading ? 'Kaydediliyor…' : 'Şifremi Sıfırla'} primary disabled={loading || code.length !== 6} onPress={submit} />
          <Btn variant="textLink" disabled={resendIn > 0 || resending} style={{ opacity: 1 }} textStyle={resendIn > 0 ? { color: tw.muted } : undefined} onPress={resend} label={resending ? 'Gönderiliyor…' : resendIn > 0 ? `Kodu tekrar gönder (${resendIn} sn)` : 'Kodu tekrar gönder'} />
        </>}>
        <View style={{ gap: 12 }}>
          <OtpInput value={code} onChange={(v) => { setCode(v); setError(''); }} error={codeError} />
          <PasswordInput value={password} onChangeText={(t) => { setPassword(t); setError(''); }} placeholder="Yeni şifre" />
          <PasswordInput value={confirm} onChangeText={(t) => { setConfirm(t); setError(''); }} placeholder="Şifre tekrar" onSubmitEditing={submit} />
          <ErrorText>{error}</ErrorText>
        </View>
      </StepScreen>
    );
  }
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: ll.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{content}</KeyboardAvoidingView>;
}
