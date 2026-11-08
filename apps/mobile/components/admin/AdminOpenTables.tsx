// apps/web/components/AdminOpenTables.tsx karşılığı: bu haftanın açık masaları + eşi bekleyenler, 30 sn'de bir yenilenir
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { api } from '@/lib/api';
import { Btn } from '../ui';
import { ACard, ALabel, AMono, AT } from './AdminUi';
import { AdminSelect } from './AdminControls';
import { adm } from '@/theme/theme';

const MALE_C = '#4fc3f7';
const FEMALE_C = '#f48fb1';
const REFRESH_SEC = 30;

interface OpenParticipant { userId: string; initials: string; gender: string | null; age: number | null; isBot?: boolean }
interface OpenTable {
  id: string; type: 'GROUP' | 'ONE_ON_ONE'; scheduledAt: string; city: string | null;
  maxParticipants: number; males: number; females: number; emptySeats: number;
  missing: { male: number; female: number };
  participants: OpenParticipant[];
}
interface WaitingUser { userId: string; initials: string; gender: string | null; age: number | null; city: string | null; cycleNo: number }
interface OpenResponse { group: OpenTable[]; oneOnOne: OpenTable[]; kanka?: OpenTable[]; waiting: WaitingUser[] }
interface BotOption { id: string; name: string; gender: string | null; age: number | null }

const genderColor = (g: string | null) => (g === 'MALE' ? MALE_C : g === 'FEMALE' ? FEMALE_C : adm.muted);
const genderShort = (g: string | null) => (g === 'MALE' ? 'E' : g === 'FEMALE' ? 'K' : '—');
const fmtDate = (d: string) => new Date(d).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <ALabel style={{ marginBottom: 10 }}>{children}</ALabel>;
}
function Empty({ children }: { children: string }) {
  return <AT style={{ fontSize: 13, color: adm.muted }}>{children}</AT>;
}

function BotPicker({ listUrl, placeUrl, onPlaced, onError }: { listUrl: string; placeUrl: string; onPlaced: () => void; onError: (m: string) => void }) {
  const [bots, setBots] = useState<BotOption[] | null>(null);
  const [botId, setBotId] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get<BotOption[]>(listUrl).then(setBots).catch((e: Error) => { setBots([]); onError(e.message); }); }, [listUrl, onError]);
  async function place() {
    if (!botId) return;
    setSaving(true);
    try { await api.post(placeUrl, { botUserId: botId }); onPlaced(); } catch (e) { onError((e as Error).message); } finally { setSaving(false); }
  }
  if (bots === null) return <AT style={{ fontSize: 11, color: adm.muted }}>Botlar yükleniyor…</AT>;
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <AdminSelect value={botId} onChange={setBotId} placeholder={bots.length ? 'Bot seçin' : 'Uygun bot yok'} title="Bot seç" style={{ flex: 1, minWidth: 0 }}
        options={bots.map(b => ({ value: b.id, label: `${b.name || b.id} (${genderShort(b.gender)}${b.age !== null ? `, ${b.age}` : ''})` }))} />
      <Btn variant="admOpenBtn" disabled={saving || !botId} label={saving ? '…' : 'Ekle'} onPress={place} />
    </View>
  );
}

type Common = { isSuperadmin: boolean; onUserClick: (id: string) => void; onChanged: () => void; onError: (m: string) => void };

function TableCard({ t, isSuperadmin, onUserClick, onChanged, onError }: { t: OpenTable } & Common) {
  const [botOpen, setBotOpen] = useState(false);
  const missing = [t.missing.male ? `${t.missing.male} E` : '', t.missing.female ? `${t.missing.female} K` : ''].filter(Boolean).join(' + ');
  return (
    <ACard>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <AT w={600} style={{ fontSize: 13 }}>{t.city ?? 'Şehir yok'} · {fmtDate(t.scheduledAt)}</AT>
        <AMono style={{ fontSize: 11 }}><AMono style={{ fontSize: 11, color: MALE_C }}>{t.males}E</AMono> · <AMono style={{ fontSize: 11, color: FEMALE_C }}>{t.females}K</AMono> · {t.participants.length}/{t.maxParticipants}</AMono>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {t.participants.map(p => (
          <Btn key={p.userId} variant="admInitials" style={{ borderColor: genderColor(p.gender) }} accessibilityLabel="Kullanıcı detayı" onPress={() => onUserClick(p.userId)}
            label={`${p.initials}${p.age !== null ? ` ${p.age}` : ''}${p.isBot ? ' · bot' : ''}`} />
        ))}
        {Array.from({ length: t.emptySeats }, (_, i) => (
          <AT key={`e${i}`} style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 99, fontSize: 11, color: adm.muted, borderWidth: 1, borderStyle: 'dashed', borderColor: adm.border, overflow: 'hidden' }}>boş</AT>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <AT style={{ fontSize: 11, color: adm.muted }}>{t.emptySeats > 0 ? `${t.emptySeats} boş sandalye` : 'Dolu'}</AT>
        {!!missing && <AT style={{ fontSize: 11, color: adm.amber }}>Eksik: {missing}</AT>}
        {isSuperadmin && t.emptySeats > 0 && <Btn variant="admOpenBtn" style={{ marginLeft: 'auto' }} label={botOpen ? 'Kapat' : 'Bot ekle'} onPress={() => setBotOpen(o => !o)} />}
      </View>
      {botOpen && (
        <View style={{ marginTop: 10 }}>
          <BotPicker listUrl={`/admin/matches/${t.id}/bots`} placeUrl={`/admin/matches/${t.id}/bot`} onPlaced={() => { setBotOpen(false); onChanged(); }} onError={onError} />
        </View>
      )}
    </ACard>
  );
}

function WaitingRow({ w, isSuperadmin, onUserClick, onChanged, onError }: { w: WaitingUser } & Common) {
  const [botOpen, setBotOpen] = useState(false);
  const first = w.cycleNo === 1;
  return (
    <ACard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Btn variant="admInitials" style={{ borderColor: genderColor(w.gender) }} onPress={() => onUserClick(w.userId)}
          label={`${w.initials} ${genderShort(w.gender)}${w.age !== null ? ` ${w.age}` : ''}`} />
        <AT style={{ fontSize: 11, color: adm.muted }}>{w.city ?? 'Şehir yok'}</AT>
        <AT w={600} style={{ fontSize: 11, color: first ? adm.amber : adm.text }}>{w.cycleNo}. döngü{first ? ', ilk döngüde bot eklenmez' : ''}</AT>
        {isSuperadmin && <Btn variant="admOpenBtn" style={{ marginLeft: 'auto' }} label={botOpen ? 'Kapat' : 'Bot ile masa kur'} onPress={() => setBotOpen(o => !o)} />}
      </View>
      {botOpen && (
        <View style={{ marginTop: 10 }}>
          <BotPicker listUrl={`/admin/matches/waiting/${w.userId}/bots`} placeUrl={`/admin/matches/waiting/${w.userId}/bot`} onPlaced={() => { setBotOpen(false); onChanged(); }} onError={onError} />
        </View>
      )}
    </ACard>
  );
}

export function AdminOpenTables({ isSuperadmin, onUserClick }: { isSuperadmin: boolean; onUserClick: (userId: string) => void }) {
  const [data, setData] = useState<OpenResponse | null>(null);
  const [error, setError] = useState('');
  const [left, setLeft] = useState(REFRESH_SEC);
  const bar = useRef(new Animated.Value(1)).current;

  const load = useCallback(() => {
    api.get<OpenResponse>('/admin/matches/open')
      .then(d => { setData(d); setError(''); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLeft(REFRESH_SEC));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const id = setInterval(() => setLeft(s => s - 1), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (left <= 0) load(); }, [left, load]);
  // web: transition width 1s linear
  useEffect(() => { Animated.timing(bar, { toValue: Math.max(0, left) / REFRESH_SEC, duration: 1000, easing: Easing.linear, useNativeDriver: false }).start(); }, [left, bar]);

  const onError = useCallback((m: string) => setError(m), []);
  const common = { isSuperadmin, onUserClick, onChanged: load, onError };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <AMono style={{ fontSize: 11 }}>Yenileme: {Math.max(0, left)} sn</AMono>
        <View style={{ flex: 1, height: 3, backgroundColor: adm.surface, borderRadius: 99, overflow: 'hidden', maxWidth: 160 }}>
          <Animated.View style={{ width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), height: '100%', backgroundColor: adm.blue }} />
        </View>
        <Btn variant="admOpenBtn" label="Şimdi yenile" onPress={load} />
      </View>
      {!!error && <AT style={{ marginBottom: 12, fontSize: 13, color: adm.red }}>{error}</AT>}
      {!data ? <AT style={{ fontSize: 13, color: adm.muted }}>Yükleniyor…</AT> : (
        <>
          <SectionTitle>GRUP MASALARI ({data.group.length})</SectionTitle>
          <View style={{ gap: 10, marginBottom: 24 }}>
            {data.group.length === 0 && <Empty>Açık grup masası yok</Empty>}
            {data.group.map(t => <TableCard key={t.id} t={t} {...common} />)}
          </View>
          <SectionTitle>BAŞBAŞA MASALARI ({data.oneOnOne.length})</SectionTitle>
          <View style={{ gap: 10, marginBottom: 24 }}>
            {data.oneOnOne.length === 0 && <Empty>Kurulmuş başbaşa masası yok</Empty>}
            {data.oneOnOne.map(t => <TableCard key={t.id} t={t} {...common} />)}
          </View>
          <SectionTitle>KANKAMLA MASALARI ({data.kanka?.length ?? 0})</SectionTitle>
          <View style={{ gap: 10, marginBottom: 24 }}>
            {(data.kanka?.length ?? 0) === 0 && <Empty>Kurulmuş Kankamla masası yok</Empty>}
            {(data.kanka ?? []).map(t => <TableCard key={t.id} t={t} {...common} />)}
          </View>
          <SectionTitle>BAŞBAŞA: EŞİ BEKLEYENLER ({data.waiting.length})</SectionTitle>
          <View style={{ gap: 10 }}>
            {data.waiting.length === 0 && <Empty>Eşi bekleyen yok</Empty>}
            {data.waiting.map(w => <WaitingRow key={w.userId} w={w} {...common} />)}
          </View>
        </>
      )}
    </View>
  );
}
