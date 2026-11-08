// apps/web/app/profil/tabs/TabRehber.tsx karşılığı + S-12: rehberden seçme (expo-contacts), liste web liste stilinde
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import * as Contacts from 'expo-contacts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { BtnGhost, BtnPrimary, Card, Head, HIT, Input, T } from '../ui';
import { ll, tw } from '@/theme/theme';

interface ServerBlock { id: string; phoneNumber?: string; hashedPhone?: string; createdAt: string }
const MAX = 50;

// Rehberdeki numarayı +90XXXXXXXXXX biçimine çevirir; Türk cep numarası değilse null
export function normalizeTrPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('0090')) d = d.slice(4);
  else if (d.startsWith('90') && d.length === 12) d = d.slice(2);
  else if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  return d.length === 10 && d.startsWith('5') ? `+90${d}` : null;
}

export function ContactPicker({ visible, onClose, existing, remaining, onPick }: { visible: boolean; onClose: () => void; existing: string[]; remaining: number; onPick: (phones: string[]) => void }) {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<{ key: string; name: string; phone: string }[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible) return;
    setSel(new Set()); setQ(''); setError('');
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') { setError('Rehber izni verilmedi. Ayarlar → Ahenk → Kişiler bölümünden izin verebilirsin.'); return; }
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name] });
      const seen = new Set<string>();
      const list: { key: string; name: string; phone: string }[] = [];
      for (const ct of data) for (const p of ct.phoneNumbers ?? []) {
        const n = normalizeTrPhone(p.number ?? '');
        if (!n || seen.has(n)) continue;
        seen.add(n); list.push({ key: `${ct.id}-${n}`, name: ct.name ?? '', phone: n });
      }
      setRows(list.sort((a, b) => a.name.localeCompare(b.name, 'tr')));
    })().catch(() => setError('Rehber okunamadı.'));
  }, [visible]);
  const shown = useMemo(() => rows.filter(r => !q || r.name.toLocaleLowerCase('tr-TR').includes(q.toLocaleLowerCase('tr-TR')) || r.phone.includes(q.replace(/\D/g, ''))), [rows, q]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: '#121212', paddingTop: 16, paddingHorizontal: 16, paddingBottom: insets.bottom + 16, gap: 12 }}>
        <Head title="Rehberden Seç" right={<Pressable hitSlop={HIT} onPress={onClose}><T style={{ fontSize: 22, color: tw.muted }}>×</T></Pressable>} />
        <Input placeholder="Ara" value={q} onChangeText={setQ} />
        {!!error && <T style={{ color: tw.accent, fontSize: 14 }}>{error}</T>}
        <FlatList data={shown} keyExtractor={r => r.key} contentContainerStyle={{ gap: 8 }} renderItem={({ item }) => {
          const already = existing.includes(item.phone);
          const on = sel.has(item.phone);
          return (
            <Pressable disabled={already} onPress={() => setSel(p => { const n = new Set(p); if (n.has(item.phone)) n.delete(item.phone); else if (n.size < remaining) n.add(item.phone); return n; })}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, opacity: already ? 0.4 : 1, borderColor: on ? 'rgba(192,57,43,0.5)' : 'rgba(255,255,255,0.08)' }}>
                <View style={{ flex: 1 }}>
                  <T style={{ fontSize: 13, color: ll.text2 }}>{item.name || item.phone}</T>
                  <T style={{ fontSize: 12, color: ll.time, marginTop: 2 }}>{item.phone}</T>
                </View>
                <T style={{ fontSize: 12, color: on ? tw.accent : ll.label }}>{already ? 'Ekli' : on ? '✓' : ''}</T>
              </Card>
            </Pressable>
          );
        }} />
        <BtnPrimary label={`Ekle (${sel.size})`} full disabled={sel.size === 0} onPress={() => { onPick([...sel]); onClose(); }} />
      </View>
    </Modal>
  );
}

export function RehberTab() {
  const [blocks, setBlocks] = useState<ServerBlock[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const load = useCallback(() => { api.get<{ count: number; items: ServerBlock[] }>('/contact-blocks').then(r => setBlocks(r.items ?? [])).catch((e: Error) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);

  async function sync(phones: string[]) {
    setAdding(true); setError('');
    try { await api.post('/contact-blocks/sync', { hashedPhones: phones }); setInput(''); load(); } catch (e) { setError((e as Error).message); } finally { setAdding(false); }
  }
  async function add() {
    const d = input.replace(/\D/g, '');
    if (d.length !== 10) { setError('10 haneli numara girin.'); return; }
    if (blocks.length >= MAX) { setError('En fazla 50 numara ekleyebilirsiniz.'); return; }
    await sync([`+90${d}`]);
  }
  async function del(b: ServerBlock) {
    setDeleting(b.id);
    try { await api.delete(`/contact-blocks/${b.id}`); setBlocks(p => p.filter(x => x.id !== b.id)); } catch (e) { setError((e as Error).message); } finally { setDeleting(null); }
  }
  const display = (b: ServerBlock, i: number) => { const v = b.phoneNumber ?? b.hashedPhone ?? ''; return v.startsWith('+90') || /^\d{10,}$/.test(v) ? v : `Engellenen Numara #${i + 1}`; };
  const existing = blocks.map(b => b.phoneNumber ?? b.hashedPhone ?? '');

  return (
    <View style={{ gap: 20 }}>
      <Card>
        <Head title="Engellenen numaralar" />
        <T w={600} style={{ fontSize: 24 }}>{blocks.length}<T style={{ fontSize: 14, color: ll.label }}>/50</T></T>
        <T style={{ fontSize: 12, color: ll.label, marginTop: 4 }}>Bu numaralarla eşleştirilmezsiniz.</T>
      </Card>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ justifyContent: 'center', paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12 }}><T style={{ color: ll.label, fontSize: 14 }}>+90</T></View>
        <Input style={{ flex: 1 }} keyboardType="number-pad" value={input} onChangeText={t => { setInput(t.replace(/\D/g, '').slice(0, 10)); setError(''); }} placeholder="5XX XXX XX XX" onSubmitEditing={add} />
        <BtnPrimary label={adding ? '…' : 'Ekle'} disabled={adding || blocks.length >= MAX} onPress={add} style={{ alignSelf: 'stretch' }} />
      </View>
      <BtnGhost label="Rehberden Seç" full disabled={blocks.length >= MAX} onPress={() => setPicker(true)} />
      {!!error && <T style={{ color: tw.accent, fontSize: 14 }}>{error}</T>}
      {blocks.length >= MAX && <T style={{ color: tw.accent, fontSize: 12 }}>Maksimum 50 numaraya ulaştınız.</T>}
      {blocks.length > 0 && (
        <View style={{ gap: 8 }}>
          {blocks.map((b, i) => (
            <Card key={b.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16 }}>
              <View>
                <T style={{ fontSize: 13, color: ll.text2 }}>{display(b, i)}</T>
                <T style={{ fontSize: 12, color: ll.time, marginTop: 2 }}>{new Date(b.createdAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' })}</T>
              </View>
              <Pressable hitSlop={HIT} disabled={deleting === b.id} onPress={() => del(b)} style={{ opacity: deleting === b.id ? 0.4 : 1 }}>
                <T style={{ fontSize: 12, color: ll.label }}>{deleting === b.id ? '…' : 'Sil'}</T>
              </Pressable>
            </Card>
          ))}
        </View>
      )}
      {blocks.length === 0 && <T style={{ fontSize: 14, color: ll.time, textAlign: 'center', paddingVertical: 16 }}>Henüz engellenen numara yok.</T>}
      <ContactPicker visible={picker} onClose={() => setPicker(false)} existing={existing} remaining={MAX - blocks.length} onPick={sync} />
    </View>
  );
}
