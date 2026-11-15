// Şifre sıfırlama (1. adım): "Şifreni gir" ve "Numaranı alabilir miyiz?" ekranlarıyla aynı sade tasarım (AuthFlow StepScreen):
// sol üstte geri ok ("Şifreni gir" ekranına döner), sola hizalı kalın başlık, açıklama, TR +90 + numara, en altta tam genişlikte "Kod Gönder".
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { OtpNoticeAction, otpNoticeOf, resendSecondsOf, type OtpNoticeCode } from '@/components/OtpCountdown';
import { PillButton, StepScreen } from '@/components/AuthFlow';
import { ErrorText, Input, T } from '@/components/ui';
import { ll } from '@/theme/theme';

export default function SifremiUnuttum() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Numara kayıtlı değilse uyarının altında "Kayıt ol" butonu
  const [notice, setNotice] = useState<OtpNoticeCode | null>(null);
  const valid = phone.length === 10 && phone.startsWith('5');
  async function submit() {
    if (!valid) return;
    setLoading(true); setError(''); setNotice(null);
    const full = `+90${phone}`;
    // Kod ekranına bekleme süresinin bitiş anı taşınır (sayaç oradan devam eder)
    const open = (resendSeconds: number | null | undefined) =>
      router.push({ pathname: '/sifremi-sifirla', params: { phone: full, until: resendSeconds && resendSeconds > 0 ? String(Date.now() + resendSeconds * 1000) : '' } });
    try { const r = await api.post<{ resendSeconds?: number }>('/auth/forgot-password', { phone: full }); open(r?.resendSeconds); }
    catch (e) {
      // Bekleme süresi dolmadan istendi: kod daha önce gönderildi; kod ekranı sunucunun döndüğü kalan saniyeyle açılır
      const left = resendSecondsOf(e);
      if (left !== null) open(left); else { setError((e as Error).message); setNotice(otpNoticeOf(e)); }
    } finally { setLoading(false); }
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: ll.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StepScreen title="Şifreni sıfırla" subtitle="Kayıtlı telefon numarana WhatsApp ile 6 haneli bir kod göndereceğiz." onBack={() => router.back()}
        footer={<PillButton label={loading ? 'Gönderiliyor…' : 'Kod Gönder'} primary disabled={loading || !valid} onPress={submit} />}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ justifyContent: 'center', paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12 }}>
            <T style={{ color: ll.text, fontSize: 14 }}>TR +90</T>
          </View>
          <Input form style={{ flex: 1, paddingVertical: 14 }} keyboardType="number-pad" textContentType="telephoneNumber" autoComplete="tel" autoFocus value={phone}
            onChangeText={(t) => { setPhone(t.replace(/\D/g, '').slice(0, 10)); setError(''); }} placeholder="5XX XXX XX XX" onSubmitEditing={submit} returnKeyType="send" />
        </View>
        <View style={{ marginTop: 12 }}><ErrorText>{error}</ErrorText></View>
        {!!error && !!notice && <View style={{ marginTop: 12 }}><OtpNoticeAction code={notice} /></View>}
      </StepScreen>
    </KeyboardAvoidingView>
  );
}
