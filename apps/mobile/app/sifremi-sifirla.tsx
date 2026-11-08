// apps/web/app/sifremi-sifirla/page.tsx karşılığı
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { AuthShell, PasswordInput } from '@/components/AuthShell';
import { OtpInput } from '@/components/OtpInput';
import { BtnGhost, BtnPrimary, Card, ErrorText, T } from '@/components/ui';
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
  return (
    <AuthShell title="Yeni Şifre" subtitle="Kodu gir ve hesabın için yeni bir şifre belirle.">
      {!valid ? (
        <Card style={{ alignItems: 'center', gap: 16 }}>
          <T style={{ color: ll.text2, fontSize: 14, textAlign: 'center' }}>Bağlantı geçersiz. Lütfen kodu yeniden iste.</T>
          <BtnPrimary label="Kod İste" style={{ alignSelf: 'center' }} onPress={() => router.replace('/sifremi-unuttum')} />
        </Card>
      ) : success ? (
        <View style={{ alignItems: 'center', gap: 4, paddingVertical: 16 }}>
          <T w={600} style={{ marginBottom: 4 }}>Şifren güncellendi</T>
          <T style={{ color: ll.label, fontSize: 13 }}>Giriş sayfasına yönlendiriliyorsun…</T>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <Card style={{ gap: 12 }}>
            <T style={{ color: ll.label, fontSize: 13, textAlign: 'center' }}>{phone} numarasına WhatsApp ile gönderilen 6 haneli kodu gir.</T>
            <OtpInput value={code} onChange={(v) => { setCode(v); setError(''); }} error={codeError} />
            <PasswordInput value={password} onChangeText={(t) => { setPassword(t); setError(''); }} placeholder="Yeni şifre" />
            <PasswordInput value={confirm} onChangeText={(t) => { setConfirm(t); setError(''); }} placeholder="Şifre tekrar" onSubmitEditing={submit} />
            <ErrorText>{error}</ErrorText>
          </Card>
          <BtnPrimary label={loading ? 'Kaydediliyor…' : 'Şifremi Sıfırla'} full disabled={loading || code.length !== 6} onPress={submit} />
          <Pressable disabled={resendIn > 0 || resending} onPress={resend} style={{ minHeight: 44, justifyContent: 'center' }}>
            <T style={{ fontSize: 13, color: resendIn > 0 ? tw.muted : ll.label, textAlign: 'center' }}>{resending ? 'Gönderiliyor…' : resendIn > 0 ? `Kodu tekrar gönder (${resendIn} sn)` : 'Kodu tekrar gönder'}</T>
          </Pressable>
        </View>
      )}
      <View style={{ marginTop: 32, alignItems: 'center' }}><BtnGhost label="Girişe Dön" onPress={() => router.replace('/giris')} /></View>
    </AuthShell>
  );
}
