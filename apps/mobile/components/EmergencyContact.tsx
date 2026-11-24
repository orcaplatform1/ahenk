// Profilim → Gizlilik ve Güvenlik: Acil Durum Kişisi (web components/EmergencyContact.tsx karşılığı). En fazla 1 kişi; ad + telefon
// (giriş / kayıttaki ülke kodu listesi). Düzenlenebilir, silinebilir. HIG: 44 pt dokunma alanı.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { splitE164, toE164 } from '@ahenk/shared';
import { api } from '@/lib/api';
import { CountryCodeButton } from './PhoneCountry';
import { StdButton, Input, T } from './ui';
import { ll, tw } from '@/theme/theme';

export function EmergencyContact() {
  const { t } = useTranslation();
  const [contact, setContact] = useState<{ name: string; phone: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('TR');
  const [national, setNational] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.get<{ name: string; phone: string } | null>('/users/me/emergency-contact').then((c) => setContact(c ?? null)).catch(() => {}); }, []);

  function startEdit() {
    const sp = splitE164(contact?.phone);
    setName(contact?.name ?? ''); setCountry(sp.country); setNational(sp.national); setError(''); setEditing(true);
  }
  async function save() {
    const phone = toE164(country, national);
    if (!name.trim()) { setError(t('emergency.nameRequired')); return; }
    if (!phone) { setError(t('phone.invalid')); return; }
    setBusy(true); setError('');
    try { setContact(await api.put<{ name: string; phone: string }>('/users/me/emergency-contact', { name: name.trim(), phone })); setEditing(false); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError('');
    try { await api.delete('/users/me/emergency-contact'); setContact(null); setEditing(false); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 4, paddingBottom: 8 }}>
      <T style={{ fontSize: 14, color: ll.text }}>{t('emergency.title')}</T>
      {!editing && contact && (
        <View style={{ gap: 8 }}>
          <T style={{ fontSize: 13, color: ll.text2 }}>{contact.name} · {contact.phone}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StdButton variant="ghost" label={t('emergency.edit')} onPress={startEdit} />
            <StdButton variant="ghost" label={t('emergency.delete')} disabled={busy} onPress={() => { void remove(); }} />
          </View>
        </View>
      )}
      {!editing && !contact && <View style={{ alignItems: 'flex-start' }}><StdButton variant="ghost" label={t('emergency.add')} onPress={startEdit} /></View>}
      {editing && (
        <View style={{ gap: 8 }}>
          <Input form value={name} onChangeText={(v) => setName(v.slice(0, 80))} placeholder={t('emergency.name')} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <CountryCodeButton country={country} onChange={(c) => { setCountry(c); setError(''); }} />
            <Input form style={{ flex: 1 }} value={national} keyboardType="phone-pad" onChangeText={(v) => { setNational(v.replace(/\D/g, '').slice(0, 15)); setError(''); }} placeholder={country === 'TR' ? '5XX XXX XX XX' : ''} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StdButton variant="primary" label={busy ? '…' : t('common.save')} disabled={busy} onPress={() => { void save(); }} />
            <StdButton variant="ghost" label={t('common.cancel')} onPress={() => setEditing(false)} />
          </View>
        </View>
      )}
      {!!error && <T style={{ fontSize: 12, color: tw.accent }}>{error}</T>}
      <T style={{ fontSize: 12, color: ll.label, lineHeight: 18 }}>{t('emergency.note')}</T>
    </View>
  );
}
