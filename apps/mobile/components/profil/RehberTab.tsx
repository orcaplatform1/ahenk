// apps/web/app/profil/tabs/TabRehber.tsx karşılığı + S-12: rehberden seçme (expo-contacts), liste web liste stilinde
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, View } from 'react-native';
// SDK 58: eski fonksiyon API'si (getContactsAsync) ana 'expo-contacts' girişinden çağrılınca hata fırlatıyor ("Rehber okunamadı."); aynı API expo-contacts/legacy'de
import * as Contacts from 'expo-contacts/legacy';
import { ensurePermission, PERM_REASON } from '@/lib/permissions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { Btn, BtnGhost, BtnPrimary, Card, Head, Input, T, Glow } from '../ui';
import { ll, tw, liveGlow } from '@/theme/theme';
import { useTranslation } from 'react-i18next';
import { formatNamed, splitE164, toE164 } from '@ahenk/shared';
import { CountryCodeButton } from '../PhoneCountry';
import { currentLang } from '@/lib/i18n';

interface ServerBlock { id: string; phoneNumber?: string; hashedPhone?: string; createdAt: string }
const MAX = 50;

// Rehberdeki numara E.164'e: başında + varsa olduğu gibi (ülke kodu numaradan), yoksa kullanıcının kayıtlı telefonunun ülkesi
// varsayılır (libphonenumber-js, @ahenk/shared toE164). Çevrilemeyen numara null (listeye eklenmez)
export function normalizeContactPhone(raw: string, country: string): string | null {
  return toE164(country, raw.trim());
}

export function ContactPicker({ visible, onClose, existing, remaining, onPick, country = 'TR' }: { visible: boolean; onClose: () => void; existing: string[]; remaining: number; onPick: (phones: string[]) => void; country?: string }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  // phone: E.164 ya da çevrilemediyse rehberdeki ham numara (invalid: seçilemez, "Geçersiz numara")
  const [rows, setRows] = useState<{ key: string; name: string; phone: string; invalid?: boolean }[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible) return;
    setSel(new Set()); setQ(''); setError('');
    (async () => {
      const perm = await ensurePermission(() => Contacts.getPermissionsAsync(), () => Contacts.requestPermissionsAsync(), PERM_REASON.contacts);
      if (perm !== true) { setError(t('block.contactsDenied')); return; }
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name] });
      const seen = new Set<string>();
      const list: { key: string; name: string; phone: string; invalid?: boolean }[] = [];
      for (const ct of data) for (const p of ct.phoneNumbers ?? []) {
        const raw = (p.number ?? '').trim();
        if (!raw) continue;
        const n = normalizeContactPhone(raw, country);
        const id = n ?? `raw:${raw}`;
        if (seen.has(id)) continue;
        seen.add(id); list.push({ key: `${ct.id}-${id}`, name: ct.name ?? '', phone: n ?? raw, invalid: !n });
      }
      setRows(list.sort((a, b) => a.name.localeCompare(b.name, 'tr')));
    })().catch(() => setError(t('block.contactsFailed')));
  }, [visible, country]);
  const shown = useMemo(() => rows.filter(r => !q || r.name.toLocaleLowerCase('tr-TR').includes(q.toLocaleLowerCase('tr-TR')) || r.phone.includes(q.replace(/\D/g, ''))), [rows, q]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      {/* Android'de pencere tam ekran ve durum çubuğunun altına uzanır: başlık ve X güvenli alanın içinde (durum çubuğunun altında).
          iOS pageSheet zaten durum çubuğunun altından başlar. */}
      <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden', paddingTop: (Platform.OS === 'android' ? insets.top : 0) + 16, paddingHorizontal: 16, paddingBottom: insets.bottom + 16, gap: 12 }}>
        <Glow top={liveGlow.offset - 16} right={liveGlow.offset - 16} />
        <Head title={t('block.fromContacts')} right={<Btn variant="closeX" accessibilityLabel={t('common.close')} label="×" textStyle={{ fontSize: 22, color: tw.muted }} onPress={onClose} />} />
        <Input placeholder={t('common.search')} value={q} onChangeText={setQ} />
        {!!error && <T style={{ color: tw.accent, fontSize: 14 }}>{error}</T>}
        <FlatList data={shown} keyExtractor={r => r.key} contentContainerStyle={{ gap: 8 }} renderItem={({ item }) => {
          const already = !item.invalid && existing.includes(item.phone);
          const on = sel.has(item.phone);
          return (
            <Pressable disabled={already || item.invalid} onPress={() => setSel(p => { const n = new Set(p); if (n.has(item.phone)) n.delete(item.phone); else if (n.size < remaining) n.add(item.phone); return n; })}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, opacity: already || item.invalid ? 0.4 : 1, borderColor: on ? 'rgba(192,57,43,0.5)' : 'rgba(255,255,255,0.08)' }}>
                <View style={{ flex: 1 }}>
                  <T style={{ fontSize: 13, color: ll.text2 }}>{item.name || item.phone}</T>
                  <T style={{ fontSize: 12, color: ll.time, marginTop: 2 }}>{item.phone}</T>
                </View>
                <T style={{ fontSize: 12, color: on || item.invalid ? tw.accent : ll.label }}>{item.invalid ? t('block.invalidNumber') : already ? t('block.inList') : on ? '✓' : ''}</T>
              </Card>
            </Pressable>
          );
        }} />
        <BtnPrimary label={t('block.addN', { count: sel.size })} full disabled={sel.size === 0} onPress={() => { onPick([...sel]); onClose(); }} />
      </View>
    </Modal>
  );
}

export function RehberTab() {
  const { t } = useTranslation();
  const [blocks, setBlocks] = useState<ServerBlock[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  // Ülke kodu: varsayılan kayıtlı telefonun ülkesi (elle ekleme ve rehberden gelen "+"sız numaralar)
  const [country, setCountry] = useState('TR');
  useEffect(() => { api.get<{ phone?: string | null }>('/auth/me').then((me) => setCountry(splitE164(me?.phone).country)).catch(() => {}); }, []);
  const load = useCallback(() => { api.get<{ count: number; items: ServerBlock[] }>('/contact-blocks').then(r => setBlocks(r.items ?? [])).catch((e: Error) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);

  async function sync(phones: string[]) {
    setAdding(true); setError('');
    try { await api.post('/contact-blocks/sync', { hashedPhones: phones }); setInput(''); load(); } catch (e) { setError((e as Error).message); } finally { setAdding(false); }
  }
  async function add() {
    const e164 = toE164(country, input);
    if (!e164) { setError(t('phone.invalid')); return; }
    if (blocks.length >= MAX) { setError(t('block.max50')); return; }
    await sync([e164]);
  }
  async function del(b: ServerBlock) {
    setDeleting(b.id);
    try { await api.delete(`/contact-blocks/${b.id}`); setBlocks(p => p.filter(x => x.id !== b.id)); } catch (e) { setError((e as Error).message); } finally { setDeleting(null); }
  }
  const display = (b: ServerBlock, i: number) => { const v = b.phoneNumber ?? b.hashedPhone ?? ''; return v.startsWith('+') || /^\d{10,}$/.test(v) ? v : t('block.numberN', { n: i + 1 }); };
  const existing = blocks.map(b => b.phoneNumber ?? b.hashedPhone ?? '');

  return (
    <View style={{ gap: 20 }}>
      <Card>
        <Head title={t('block.title')} />
        <T w={600} style={{ fontSize: 24 }}>{blocks.length}<T style={{ fontSize: 14, color: ll.label }}>/50</T></T>
        <T style={{ fontSize: 12, color: ll.label, marginTop: 4 }}>{t('block.info')}</T>
      </Card>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <CountryCodeButton country={country} onChange={(c) => { setCountry(c); setError(''); }} />
        <Input style={{ flex: 1 }} keyboardType="number-pad" value={input} onChangeText={v => { setInput(v.replace(/\D/g, '').slice(0, 15)); setError(''); }} placeholder={country === 'TR' ? '5XX XXX XX XX' : ''} onSubmitEditing={add} />
        <BtnPrimary label={adding ? '…' : t('block.add')} disabled={adding || blocks.length >= MAX} onPress={add} style={[{ alignSelf: 'stretch' }, (adding || blocks.length >= MAX) && { opacity: 0.5 }]} />
      </View>
      <BtnGhost label={t('block.fromContacts')} full disabled={blocks.length >= MAX} onPress={() => setPicker(true)} />
      {!!error && <T style={{ color: tw.accent, fontSize: 14 }}>{error}</T>}
      {blocks.length >= MAX && <T style={{ color: tw.accent, fontSize: 12 }}>{t('block.maxReached')}</T>}
      {blocks.length > 0 && (
        <View style={{ gap: 8 }}>
          {blocks.map((b, i) => (
            <Card key={b.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16 }}>
              <View>
                <T style={{ fontSize: 13, color: ll.text2 }}>{display(b, i)}</T>
                <T style={{ fontSize: 12, color: ll.time, marginTop: 2 }}>{formatNamed(b.createdAt, currentLang(), { day: 'numeric', month: 'long', year: 'numeric' })}</T>
              </View>
              <Btn variant="cardAction" disabled={deleting === b.id} label={deleting === b.id ? '…' : t('block.remove')} onPress={() => del(b)} />
            </Card>
          ))}
        </View>
      )}
      {blocks.length === 0 && <T style={{ fontSize: 14, color: ll.time, textAlign: 'center', paddingVertical: 16 }}>{t('block.empty')}</T>}
      <ContactPicker visible={picker} onClose={() => setPicker(false)} existing={existing} remaining={MAX - blocks.length} onPick={sync} country={country} />
    </View>
  );
}
