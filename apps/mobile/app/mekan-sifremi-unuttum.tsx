// apps/web/app/mekan/sifremi-unuttum/page.tsx karşılığı
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { venueApi } from '@/lib/venueApi';
import { OtpInput } from '@/components/OtpInput';
import { BtnPrimary, Input, Serif, T } from '@/components/ui';
import { c, tw } from '@/theme/theme';

export default function MekanSifremiUnuttum() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function sendCode() { setLoading(true); setError(''); try { await venueApi.post('/forgot-password', { email }); setSent(true); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }
  async function reset() {
    if (code.length !== 6) { setError('6 haneli kodu girin.'); return; }
    if (password.length < 6 || password.length > 20) { setError('Şifre 6-20 karakter arasında olmalı.'); return; }
    if (password !== confirm) { setError('Şifreler eşleşmiyor.'); return; }
    setLoading(true); setError('');
    try { await venueApi.post('/reset-password', { email, code, newPassword: password }); router.replace('/giris'); } catch (e) { setError((e as Error).message); setLoading(false); }
  }
  return (
    <View style={{ flex: 1, backgroundColor: tw.bg, justifyContent: 'center', paddingHorizontal: 24, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ width: '100%', maxWidth: 384, alignSelf: 'center' }}>
        <Serif style={{ fontSize: 36, textAlign: 'center', marginBottom: 8 }}>Şifre Sıfırla</Serif>
        {!sent ? (
          <View style={{ gap: 12, marginTop: 24 }}>
            <T style={{ color: c.t666, fontSize: 14, textAlign: 'center' }}>Mekân e-postanızı girin, kayıtlı WhatsApp numaranıza 6 haneli kod gönderelim.</T>
            <Input keyboardType="email-address" autoCapitalize="none" accessibilityLabel="E-posta" placeholder="E-posta" value={email} onChangeText={setEmail} />
            {!!error && <T style={{ fontSize: 12, color: tw.accent }}>{error}</T>}
            <BtnPrimary label={loading ? 'Gönderiliyor…' : 'Kod Gönder'} full disabled={loading || !email} onPress={sendCode} />
          </View>
        ) : (
          <View style={{ gap: 12, marginTop: 24 }}>
            <T style={{ color: c.t666, fontSize: 14, textAlign: 'center' }}>Hesap varsa kayıtlı WhatsApp numarasına kod gönderildi.</T>
            <OtpInput value={code} onChange={setCode} />
            <Input secureTextEntry maxLength={20} textContentType="newPassword" accessibilityLabel="Yeni şifre" placeholder="Yeni şifre (6-20 karakter)" value={password} onChangeText={setPassword} />
            <Input secureTextEntry maxLength={20} textContentType="newPassword" accessibilityLabel="Yeni şifre tekrar" placeholder="Yeni şifre tekrar" value={confirm} onChangeText={setConfirm} />
            {!!error && <T style={{ fontSize: 12, color: tw.accent }}>{error}</T>}
            <BtnPrimary label={loading ? 'Kaydediliyor…' : 'Şifreyi Güncelle'} full disabled={loading} onPress={reset} />
          </View>
        )}
        <Pressable onPress={() => router.back()} style={{ alignItems: 'center', marginTop: 20, minHeight: 44, justifyContent: 'center' }}><T style={{ fontSize: 12, color: c.t888 }}>Girişe dön</T></Pressable>
      </View>
    </View>
  );
}
