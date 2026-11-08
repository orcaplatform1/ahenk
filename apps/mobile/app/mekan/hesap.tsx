// apps/web/app/mekan/panel/hesap/page.tsx karşılığı
import React, { useState } from 'react';
import { View } from 'react-native';
import { VenueAuthError, venueApi } from '@/lib/venueApi';
import { panelCard, useVenuePanel } from '@/lib/venueContext';
import { Btn, BtnPrimary, Input, Serif, T } from '@/components/ui';
import { c, tw } from '@/theme/theme';

export default function Hesap() {
  const { me, onAuthLost } = useVenuePanel();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwMessage, setPwMessage] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [delPassword, setDelPassword] = useState('');
  const [delError, setDelError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function changePassword() {
    setPwMessage(''); setPwError('');
    if (pw.next.length < 6 || pw.next.length > 20) { setPwError('Şifre 6-20 karakter arasında olmalı.'); return; }
    if (pw.next !== pw.confirm) { setPwError('Şifreler eşleşmiyor.'); return; }
    setPwSaving(true);
    try { await venueApi.post('/change-password', { currentPassword: pw.current, newPassword: pw.next }); setPw({ current: '', next: '', confirm: '' }); setPwMessage('Şifreniz güncellendi.'); }
    catch (e) { if (e instanceof VenueAuthError) onAuthLost(); else setPwError((e as Error).message); } finally { setPwSaving(false); }
  }
  async function deactivate() {
    setDeleting(true); setDelError('');
    try { await venueApi.post('/deactivate', { password: delPassword }); onAuthLost(); }
    catch (e) { if (e instanceof VenueAuthError) onAuthLost(); else { setDelError((e as Error).message); setDeleting(false); } }
  }
  const pass = { secureTextEntry: true, maxLength: 20, autoCapitalize: 'none' as const };
  return (
    <View style={{ gap: 12 }}>
      <Serif style={{ fontSize: 25.6 }}>Hesap</Serif>
      <T style={{ color: c.t888, fontSize: 13.6 }}>{me.email}</T>
      <View style={[panelCard, { gap: 10 }]}>
        <T w={600} style={{ fontSize: 16 }}>Şifre Değiştir</T>
        <Input {...pass} textContentType="password" accessibilityLabel="Mevcut şifre" placeholder="Mevcut şifre" value={pw.current} onChangeText={v => setPw(p => ({ ...p, current: v }))} />
        <Input {...pass} textContentType="newPassword" accessibilityLabel="Yeni şifre" placeholder="Yeni şifre (6-20 karakter)" value={pw.next} onChangeText={v => setPw(p => ({ ...p, next: v }))} />
        <Input {...pass} textContentType="newPassword" accessibilityLabel="Yeni şifre tekrar" placeholder="Yeni şifre tekrar" value={pw.confirm} onChangeText={v => setPw(p => ({ ...p, confirm: v }))} />
        {!!pwError && <T style={{ color: tw.accent, fontSize: 12.8 }}>{pwError}</T>}
        {!!pwMessage && <T style={{ color: c.ok, fontSize: 12.8 }}>{pwMessage}</T>}
        <BtnPrimary label={pwSaving ? 'Kaydediliyor…' : 'Şifreyi Güncelle'} full disabled={pwSaving} onPress={changePassword} />
      </View>
      <View style={[panelCard, { gap: 10 }]}>
        <T w={600} style={{ fontSize: 16 }}>Hesabı Sil</T>
        <T style={{ color: c.t888, fontSize: 13.6 }}>Hesabınız kapatılır, mekânınız masa atamalarından çıkar ve panele tekrar giriş yapamazsınız.</T>
        {!confirming ? (
          <Btn variant="venueDelete" label="Hesabı Sil" onPress={() => setConfirming(true)} />
        ) : (
          <View style={{ gap: 10 }}>
            <Input {...pass} accessibilityLabel="Onay için şifre" placeholder="Onaylamak için şifreniz" value={delPassword} onChangeText={setDelPassword} />
            {!!delError && <T style={{ color: tw.accent, fontSize: 12.8 }}>{delError}</T>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn variant="venueCancel" label="Vazgeç" onPress={() => { setConfirming(false); setDelPassword(''); setDelError(''); }} />
              <Btn variant="venueConfirm" label={deleting ? '…' : 'Hesabı Kapat'} disabled={deleting} onPress={deactivate} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
