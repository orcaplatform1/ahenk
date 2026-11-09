// apps/web/app/mekan/sifremi-unuttum/page.tsx karşılığı
import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { venueApi } from '@/lib/venueApi';
import { OtpInput } from '@/components/OtpInput';
import { PhoneRow } from '@/components/AuthShell';
import { BtnGhost, BtnPrimary, Input, Serif, T, Glow, ScreenGlow } from '@/components/ui';
import { c, tw, ll } from '@/theme/theme';

export default function MekanSifremiUnuttum() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function sendCode() { setLoading(true); setError(''); try { await venueApi.post('/forgot-password', { phone: `+90${phone}` }); setSent(true); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }
  async function reset() {
    if (code.length !== 6) { setError('6 haneli kodu girin.'); return; }
    if (password.length < 6 || password.length > 20) { setError('Şifre 6-20 karakter arasında olmalı.'); return; }
    if (password !== confirm) { setError('Şifreler eşleşmiyor.'); return; }
    setLoading(true); setError('');
    try { await venueApi.post('/reset-password', { phone: `+90${phone}`, code, newPassword: password }); router.replace('/giris'); } catch (e) { setError((e as Error).message); setLoading(false); }
  }
  return (
    <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden', justifyContent: 'center', paddingHorizontal: 24, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <ScreenGlow />
      <Glow />
      <View style={{ width: '100%', maxWidth: 384, alignSelf: 'center' }}>
        {/* Giriş ekranındaki AHENK yazılı logo, aynı boy */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Image source={require('@/assets/start_logo.jpg')} style={{ width: 120, height: 120, borderRadius: 60 }} accessibilityLabel="Ahenk" />
        </View>
        <Serif style={{ fontSize: 36, textAlign: 'center', marginBottom: 8 }}>Şifre Sıfırla</Serif>
        {!sent ? (
          <View style={{ gap: 12, marginTop: 24 }}>
            <T style={{ color: c.t666, fontSize: 14, textAlign: 'center' }}>M. telefon numaranızı girin, WhatsApp numaranıza 6 haneli kod gönderelim.</T>
            <PhoneRow value={phone} onChange={(v) => { setPhone(v); setError(''); }} onSubmit={sendCode} />
            {!!error && <T style={{ fontSize: 12, color: tw.accent }}>{error}</T>}
            <BtnPrimary label={loading ? 'Gönderiliyor…' : 'Kod Gönder'} full disabled={loading || !(phone.length === 10 && phone.startsWith('5'))} style={loading ? { opacity: 0.7 } : undefined} onPress={sendCode} />
          </View>
        ) : (
          <View style={{ gap: 12, marginTop: 24 }}>
            <T style={{ color: c.t666, fontSize: 14, textAlign: 'center' }}>Hesap varsa kayıtlı WhatsApp numarasına kod gönderildi.</T>
            <OtpInput value={code} onChange={setCode} />
            <Input secureTextEntry maxLength={20} textContentType="newPassword" accessibilityLabel="Yeni şifre" placeholder="Yeni şifre (6-20 karakter)" value={password} onChangeText={setPassword} />
            <Input secureTextEntry maxLength={20} textContentType="newPassword" accessibilityLabel="Yeni şifre tekrar" placeholder="Yeni şifre tekrar" value={confirm} onChangeText={setConfirm} />
            {!!error && <T style={{ fontSize: 12, color: tw.accent }}>{error}</T>}
            <BtnPrimary label={loading ? 'Kaydediliyor…' : 'Şifreyi Güncelle'} full disabled={loading} style={loading ? { opacity: 0.7 } : undefined} onPress={reset} />
          </View>
        )}
        <BtnGhost label="Girişe dön" full style={{ marginTop: 12 }} onPress={() => router.back()} />
      </View>
    </View>
  );
}
