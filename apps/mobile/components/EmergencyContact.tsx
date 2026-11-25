// Profilim → Gizlilik ve Güvenlik: Acil Durum Kişisi (web components/EmergencyContact.tsx karşılığı). En fazla 2 kişi; ad + telefon
// (giriş / kayıttaki ülke kodu listesi). Her kişi düzenlenebilir, silinebilir (1. silinirse 2. kişi 1. sıraya geçer); 2 kişi kayıtlıyken
// "Kişi Ekle" gizli. HIG: 44 pt dokunma alanı.
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { splitE164, toE164 } from '@ahenk/shared';
import { api } from '@/lib/api';
import { CountryCodeButton } from './PhoneCountry';
import { Card, StdButton, Input, T } from './ui';
import { ll, tw } from '@/theme/theme';

type Contact = { slot: 1 | 2; name: string | null; phone: string };

export function EmergencyContact() {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editing, setEditing] = useState<1 | 2 | null>(null); // Düzenlenen / eklenen kişinin sırası
  const [name, setName] = useState('');
  const [country, setCountry] = useState('TR');
  const [national, setNational] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.get<Contact[]>('/users/me/emergency-contacts').then((c) => setContacts(Array.isArray(c) ? c : [])).catch(() => {}); }, []);

  function startEdit(slot: 1 | 2) {
    const c = contacts.find((x) => x.slot === slot);
    const sp = splitE164(c?.phone);
    setName(c?.name ?? ''); setCountry(sp.country); setNational(sp.national); setError(''); setEditing(slot);
  }
  async function save() {
    if (!editing) return;
    const phone = toE164(country, national);
    if (!name.trim()) { setError(t('emergency.nameRequired')); return; }
    if (!phone) { setError(t('phone.invalid')); return; }
    setBusy(true); setError('');
    try { setContacts(await api.put<Contact[]>(`/users/me/emergency-contacts/${editing}`, { name: name.trim(), phone })); setEditing(null); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove(slot: 1 | 2) {
    setBusy(true); setError('');
    try { setContacts(await api.delete<Contact[]>(`/users/me/emergency-contacts/${slot}`)); setEditing(null); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const nextSlot: 1 | 2 | null = contacts.length >= 2 ? null : contacts.some((c) => c.slot === 1) ? 2 : 1;

  return (
    <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 4, paddingBottom: 8 }}>
      {/* Başlık satırı (Numara Engelleme satırıyla aynı hiza, en az 44 pt): solda başlık, 2 kişiden azsa sağında Kişi Ekle */}
      <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <T style={{ fontSize: 14, color: ll.text, flexShrink: 1 }}>{t('emergency.title')}</T>
        {!editing && nextSlot && <StdButton variant="ghost" label={t('emergency.add')} onPress={() => startEdit(nextSlot)} />}
      </View>
      {/* Her kişi Numara Engelleme kutularıyla aynı stilde ayrı kutu (Card 12 / 16): solda "Ad · Numara" (ana kırmızı), sağda kalem
          (düzenle) ve kırmızı çöp kutusu (sil), ikisi de 44 pt; 2 kişi varsa alt alta */}
      {!editing && contacts.map((c) => (
        <Card key={c.slot} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, gap: 8 }}>
          <T style={{ fontSize: 13, color: tw.primary, flexShrink: 1 }}>{c.name} · {c.phone}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => startEdit(c.slot)} accessibilityRole="button" accessibilityLabel={t('emergency.edit')}
              style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={ll.label} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 20h9" /><Path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></Svg>
            </Pressable>
            <Pressable onPress={() => { void remove(c.slot); }} disabled={busy} accessibilityRole="button" accessibilityLabel={t('emergency.delete')} accessibilityState={{ disabled: busy }}
              style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.4 : pressed ? 0.6 : 1 })}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={tw.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 6h18" /><Path d="M8 6V4h8v2" /><Path d="M19 6l-1 14H6L5 6" /><Path d="M10 11v6" /><Path d="M14 11v6" /></Svg>
            </Pressable>
          </View>
        </Card>
      ))}
      {!!editing && (
        <View style={{ gap: 8 }}>
          <Input form value={name} onChangeText={(v) => setName(v.slice(0, 80))} placeholder={t('emergency.name')} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <CountryCodeButton country={country} onChange={(c) => { setCountry(c); setError(''); }} />
            <Input form style={{ flex: 1 }} value={national} keyboardType="phone-pad" onChangeText={(v) => { setNational(v.replace(/\D/g, '').slice(0, 15)); setError(''); }} placeholder={country === 'TR' ? '5XX XXX XX XX' : ''} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StdButton variant="primary" label={busy ? '…' : t('common.save')} disabled={busy} onPress={() => { void save(); }} />
            <StdButton variant="ghost" label={t('common.cancel')} onPress={() => setEditing(null)} />
          </View>
        </View>
      )}
      {!!error && <T style={{ fontSize: 12, color: tw.accent }}>{error}</T>}
      <T style={{ fontSize: 12, color: ll.label, lineHeight: 18 }}>{t('emergency.note')}</T>
    </View>
  );
}
