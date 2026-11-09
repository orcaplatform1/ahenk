// apps/web/app/sifremi-unuttum/page.tsx karşılığı
import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { AuthShell, PhoneRow } from '@/components/AuthShell';
import { BtnGhost, BtnPrimary, Card, ErrorText, T } from '@/components/ui';
import { ll } from '@/theme/theme';

export default function SifremiUnuttum() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const valid = phone.length === 10 && phone.startsWith('5');
  async function submit() {
    if (!valid) return;
    setLoading(true); setError('');
    const full = `+90${phone}`;
    try { await api.post('/auth/forgot-password', { phone: full }); router.push({ pathname: '/sifremi-sifirla', params: { phone: full } }); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }
  return (
    <AuthShell title="Şifre Sıfırla" brandLogo>
      <Card style={{ gap: 12 }}>
        <T style={{ color: ll.label, fontSize: 13, textAlign: 'center', marginBottom: 4 }}>Kayıtlı telefon numarana WhatsApp ile 6 haneli bir kod göndereceğiz.</T>
        <PhoneRow value={phone} onChange={(v) => { setPhone(v); setError(''); }} onSubmit={submit} autoFocus />
        <ErrorText>{error}</ErrorText>
      </Card>
      <View style={{ marginTop: 16 }}><BtnPrimary label={loading ? 'Gönderiliyor…' : 'Kod Gönder'} disabled={loading || !valid} style={{ width: '72%', alignSelf: 'center', marginTop: 4 }} onPress={submit} /></View>
      <View style={{ marginTop: 16 }}><BtnGhost label="Girişe Dön" style={{ width: '72%', alignSelf: 'center' }} onPress={() => router.back()} /></View>
    </AuthShell>
  );
}
