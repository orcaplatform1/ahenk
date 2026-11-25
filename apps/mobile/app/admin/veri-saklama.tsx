// apps/web/app/admin/veri-saklama/page.tsx karşılığı (yalnız SUPERADMIN): politika, kişi arama + dışa aktarma + saklama kilidi,
// dışa aktarma ve silme geçmişi. Arayüz TR + EN (shared i18n "dr.*"). ZIP sistem paylaşım penceresiyle kaydedilir.
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import RNShare from 'react-native-share';
import { api } from '@/lib/api';
import { Btn } from '@/components/ui';
import { ACard, AError, ALabel, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { AInput, AdminSelect } from '@/components/admin/AdminControls';
import { adm } from '@/theme/theme';
import { messagesTr, messagesEn } from '@ahenk/shared';

type Lang = 'tr' | 'en';
type Tx = { tr: string; en: string };
interface Category { id: string; label: Tx; fields: Tx; location: string; duration: Tx; start: Tx; basis: Tx; action: Tx; auto: boolean; count: number | null; oldest: string | null; nextDeletion: string | null; dueNow: number | null }
interface SearchRow { userId: string; name: string; phone: string | null; deleted: boolean; deletedAt: string | null }
interface Lock { id: string; userId: string | null; category: string | null; recordId: string | null; reason: string; createdById: string; createdAt: string; releasedAt: string | null; releaseReason: string | null }
interface ExportRow { id: string; adminId: string; targetUserId: string; reason: string; createdAt: string }
interface RunRow { id: string; ranAt: string; category: string; count: number; enabled: boolean }
interface Person { userId: string; categories: Record<string, Record<string, unknown>>; locks: Lock[] }

const DICT: Record<Lang, Record<string, string>> = {
  tr: (messagesTr as unknown as { dr: Record<string, string> }).dr,
  en: (messagesEn as unknown as { dr: Record<string, string> }).dr,
};
const LANG_KEY = 'ahenk_admin_dr_lang';
const TABS = ['policy', 'person', 'locks', 'exports', 'runs'] as const;
type Tab = (typeof TABS)[number];
const TAB_KEY: Record<Tab, string> = { policy: 'tabPolicy', person: 'tabPerson', locks: 'tabLocks', exports: 'tabExports', runs: 'tabRuns' };
const fmt = (d: string | null | undefined, lang: Lang) => (d ? new Date(d).toLocaleString(lang === 'en' ? 'en-GB' : 'tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
type T = (k: string) => string;

function ReasonBox({ t, title, extra, onSubmit, onCancel }: { t: T; title: string; extra?: React.ReactNode; onSubmit: (reason: string) => Promise<void>; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    if (reason.trim().length < 3) { setErr(t('reasonReq')); return; }
    setBusy(true); setErr('');
    try { await onSubmit(reason.trim()); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <View style={{ gap: 8, padding: 12, borderWidth: 1, borderColor: adm.border, borderRadius: 10, marginTop: 10 }}>
      <AT w={600} style={{ fontSize: 13 }}>{title}</AT>
      {extra}
      <AInput value={reason} onChangeText={setReason} placeholder={t('reason')} multiline accessibilityLabel={t('reason')} style={{ minHeight: 80, paddingHorizontal: 12, textAlignVertical: 'top' }} />
      {!!err && <AT style={{ fontSize: 12, color: adm.red }}>{err}</AT>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn variant="admNoSm" label={t('cancel')} onPress={onCancel} />
        <Btn variant="admOkSm" label={busy ? t('exporting') : t('save')} disabled={busy} onPress={go} />
      </View>
    </View>
  );
}

export default function VeriSaklama() {
  const [lang, setLang] = useState<Lang>('tr');
  useEffect(() => { AsyncStorage.getItem(LANG_KEY).then((v) => { if (v === 'en' || v === 'tr') setLang(v); }).catch(() => undefined); }, []);
  const switchLang = (l: Lang) => { setLang(l); AsyncStorage.setItem(LANG_KEY, l).catch(() => undefined); };
  const t: T = (k) => DICT[lang][k] ?? k;
  const [tab, setTab] = useState<Tab>('policy');
  const [policy, setPolicy] = useState<{ autoDataDeletion: boolean; categories: Category[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get<{ autoDataDeletion: boolean; categories: Category[] }>('/admin/retention/policy').then(setPolicy).catch((e: Error) => setError(e.message)); }, []);
  const catLabel = (id: string | null) => policy?.categories.find((c) => c.id === id)?.label[lang] ?? id ?? '-';
  return (
    <APage maxWidth={960}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <ATitle>{t('title')}</ATitle>
        <View style={{ flexDirection: 'row', gap: 6, width: 110 }}>
          {(['tr', 'en'] as Lang[]).map((l) => <Btn key={l} variant="admSegment" selected={lang === l} label={l.toUpperCase()} onPress={() => switchLang(l)} />)}
        </View>
      </View>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {TABS.map((v) => <Btn key={v} variant="admSegment" selected={tab === v} label={t(TAB_KEY[v])} onPress={() => setTab(v)} style={{ flexBasis: '45%' }} />)}
      </View>
      {!!error && <AError>{error}</AError>}
      {tab === 'policy' && <PolicyTab t={t} lang={lang} policy={policy} />}
      {tab === 'person' && <PersonTab t={t} lang={lang} catLabel={catLabel} categories={policy?.categories ?? []} />}
      {tab === 'locks' && <LocksTab t={t} lang={lang} catLabel={catLabel} />}
      {tab === 'exports' && <ExportsTab t={t} lang={lang} />}
      {tab === 'runs' && <RunsTab t={t} lang={lang} catLabel={catLabel} />}
    </APage>
  );
}

// Kartta her alan "Etiket: Değer" biçiminde alt alta (web dar ekran kartlarıyla aynı)
function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <AT style={{ marginTop: 6, fontSize: 12 }}>
      <AT style={{ fontSize: 12, color: adm.muted }}>{k}: </AT>
      {mono ? <AMono style={{ fontSize: 12, color: adm.text }}>{v}</AMono> : v}
    </AT>
  );
}

function PolicyTab({ t, lang, policy }: { t: T; lang: Lang; policy: { autoDataDeletion: boolean; categories: Category[] } | null }) {
  if (!policy) return <AT style={{ color: adm.muted, fontSize: 13 }}>{t('loading')}</AT>;
  return (
    <View style={{ gap: 10 }}>
      <AT w={600} style={{ fontSize: 13, color: policy.autoDataDeletion ? adm.green : adm.muted }}>{policy.autoDataDeletion ? t('autoOn') : t('autoOff')}</AT>
      {policy.categories.map((c) => (
        <ACard key={c.id}>
          <AT w={600} style={{ fontSize: 14 }}>{c.label[lang]}</AT>
          <Row k={t('fields')} v={c.fields[lang]} />
          <Row k={t('location')} v={c.location} mono />
          <Row k={t('duration')} v={c.duration[lang]} />
          <Row k={t('start')} v={c.start[lang]} />
          <Row k={t('basis')} v={c.basis[lang]} />
          <Row k={t('action')} v={c.action[lang]} />
          <Row k={t('count')} v={c.count ?? '-'} mono />
          <Row k={t('oldest')} v={fmt(c.oldest, lang)} />
          <Row k={t('next')} v={c.auto ? fmt(c.nextDeletion, lang) : '-'} />
          <Row k={t('dueNow')} v={c.dueNow ?? '-'} mono />
        </ACard>
      ))}
    </View>
  );
}

function PersonTab({ t, lang, catLabel, categories }: { t: T; lang: Lang; catLabel: (id: string | null) => string; categories: Category[] }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<SearchRow[] | null>(null);
  const [sel, setSel] = useState<SearchRow | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [mode, setMode] = useState<'' | 'export' | 'lockPerson' | 'lockRecord'>('');
  const [open, setOpen] = useState<string | null>(null);
  const [recCat, setRecCat] = useState('PAYMENT');
  const [recId, setRecId] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function search() {
    setErr(''); setSel(null); setPerson(null);
    try { setRows(await api.get<SearchRow[]>(`/admin/retention/search?q=${encodeURIComponent(q.trim())}`)); } catch (e) { setErr((e as Error).message); }
  }
  const openPerson = useCallback(async (r: SearchRow) => {
    setSel(r); setPerson(null); setMode(''); setMsg(''); setErr(''); setOpen(null);
    try { setPerson(await api.get<Person>(`/admin/retention/person/${r.userId}`)); } catch (e) { setErr((e as Error).message); }
  }, []);
  async function doExport(reason: string) {
    if (!sel) return;
    const res = await api.post<{ fileName: string; base64: string }>(`/admin/retention/export/${sel.userId}`, { reason });
    const file = new File(Paths.cache, res.fileName);
    file.write(res.base64, { encoding: 'base64' });
    setMode(''); setMsg(t('exported'));
    await RNShare.open({ url: file.uri, type: 'application/zip', filename: res.fileName, failOnCancel: false }).catch(() => undefined);
  }
  async function doLock(reason: string, record: boolean) {
    if (!sel) return;
    await api.post('/admin/retention/locks', record ? { category: recCat, recordId: recId.trim(), reason } : { userId: sel.userId, reason });
    setMode(''); openPerson(sel);
  }

  if (sel) {
    return (
      <ACard>
        <View style={{ alignSelf: 'flex-start' }}><Btn variant="admOutline" label={t('back')} onPress={() => { setSel(null); setPerson(null); }} /></View>
        <AT w={600} style={{ fontSize: 15, marginTop: 12 }}>{sel.name || '-'}</AT>
        <AMono style={{ fontSize: 11, color: adm.muted }}>{sel.phone ?? '-'} · {sel.userId} · {sel.deleted ? `${t('deleted')} (${fmt(sel.deletedAt, lang)})` : t('active')}</AMono>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <Btn variant="admAdd" label={t('export')} onPress={() => setMode('export')} />
          <Btn variant="admAdd" label={t('lockPerson')} onPress={() => setMode('lockPerson')} />
          <Btn variant="admAdd" label={t('lockRecord')} onPress={() => setMode('lockRecord')} />
        </View>
        {!!msg && <AT style={{ marginTop: 8, fontSize: 12, color: adm.green }}>{msg}</AT>}
        {mode === 'export' && <ReasonBox t={t} title={t('export')} onSubmit={doExport} onCancel={() => setMode('')} />}
        {mode === 'lockPerson' && <ReasonBox t={t} title={t('lockPerson')} onSubmit={(r) => doLock(r, false)} onCancel={() => setMode('')} />}
        {mode === 'lockRecord' && (
          <ReasonBox t={t} title={t('lockRecord')} onSubmit={(r) => doLock(r, true)} onCancel={() => setMode('')} extra={(
            <View style={{ gap: 8 }}>
              <AdminSelect value={recCat} onChange={setRecCat} options={categories.filter((c) => c.auto).map((c) => ({ value: c.id, label: c.label[lang] }))} placeholder={t('category')} title={t('category')} />
              <AInput value={recId} onChangeText={setRecId} placeholder={t('recordId')} autoCapitalize="none" autoCorrect={false} accessibilityLabel={t('recordId')} style={{ paddingHorizontal: 12 }} />
            </View>
          )} />
        )}
        {!!err && <AError>{err}</AError>}
        {!person ? <AT style={{ color: adm.muted, fontSize: 13, marginTop: 12 }}>{t('loading')}</AT> : (
          <View style={{ gap: 10, marginTop: 14 }}>
            {person.locks.length > 0 && (
              <View>
                <ALabel style={{ color: adm.muted, marginBottom: 4 }}>{t('tabLocks')}</ALabel>
                {person.locks.map((l) => (
                  <AT key={l.id} style={{ fontSize: 12, color: l.releasedAt ? adm.muted : adm.amber }}>
                    {l.userId ? t('personLock') : `${t('recordLock')}: ${catLabel(l.category)} · ${l.recordId}`} · {fmt(l.createdAt, lang)} · {l.reason} · {l.releasedAt ? t('released') : t('locked')}
                  </AT>
                ))}
              </View>
            )}
            {Object.entries(person.categories).map(([id, data]) => {
              const empty = Object.values(data).every((v) => v == null || (Array.isArray(v) && v.length === 0));
              return (
                <View key={id} style={{ borderWidth: 1, borderColor: adm.border, borderRadius: 10, padding: 10 }}>
                  <Btn variant="admNav" selected={open === id} label={`${open === id ? '▾' : '▸'} ${catLabel(id)}`} onPress={() => setOpen(open === id ? null : id)} />
                  {open === id && (empty
                    ? <AT style={{ fontSize: 12, color: adm.muted, marginTop: 6 }}>{t('noRecords')}</AT>
                    : <AMono style={{ fontSize: 11, color: adm.text, marginTop: 6 }}>{JSON.stringify(data, null, 2)}</AMono>)}
                </View>
              );
            })}
          </View>
        )}
      </ACard>
    );
  }
  return (
    <ACard>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <AInput value={q} onChangeText={setQ} onSubmitEditing={search} returnKeyType="search" autoCapitalize="none" autoCorrect={false} placeholder={t('searchPh')} accessibilityLabel={t('searchPh')} style={{ flex: 1, paddingHorizontal: 12 }} />
        <Btn variant="admAdd" label={t('search')} onPress={search} />
      </View>
      {!!err && <AError>{err}</AError>}
      {rows && (rows.length === 0 ? <AT style={{ color: adm.muted, fontSize: 13, marginTop: 10 }}>{t('noResult')}</AT> : (
        <View style={{ gap: 6, marginTop: 12 }}>
          {rows.map((r) => (
            <Btn key={r.userId} variant="admOption" onPress={() => openPerson(r)}>
              <AT w={600} style={{ fontSize: 13 }}>{r.name || '-'}</AT>
              <AMono style={{ fontSize: 11, color: adm.muted }}>{r.phone ?? '-'} · {r.userId} · {r.deleted ? t('deleted') : t('active')}</AMono>
            </Btn>
          ))}
        </View>
      ))}
    </ACard>
  );
}

function LocksTab({ t, lang, catLabel }: { t: T; lang: Lang; catLabel: (id: string | null) => string }) {
  const [data, setData] = useState<{ rows: Lock[]; names: Record<string, string> } | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);
  const load = useCallback(() => { api.get<{ rows: Lock[]; names: Record<string, string> }>('/admin/retention/locks').then(setData).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);
  if (!data) return <AT style={{ color: adm.muted, fontSize: 13 }}>{t('loading')}</AT>;
  if (!data.rows.length) return <ACard><AT style={{ color: adm.muted, fontSize: 13 }}>{t('none')}</AT></ACard>;
  return (
    <ACard style={{ gap: 10 }}>
      {data.rows.map((l) => (
        <View key={l.id} style={{ borderBottomWidth: 1, borderBottomColor: adm.border, paddingBottom: 10 }}>
          <AT w={600} style={{ fontSize: 13, color: l.releasedAt ? adm.muted : adm.amber }}>
            {l.userId ? `${t('personLock')}: ${data.names[l.userId] || l.userId}` : `${t('recordLock')}: ${catLabel(l.category)} · ${l.recordId}`} · {l.releasedAt ? t('released') : t('locked')}
          </AT>
          <AT style={{ fontSize: 12, marginTop: 2 }}>{t('reason')}: {l.reason}</AT>
          <AT style={{ fontSize: 11, color: adm.muted, marginTop: 2 }}>{fmt(l.createdAt, lang)} · {t('admin')}: {data.names[l.createdById] || l.createdById}</AT>
          {!!l.releasedAt && <AT style={{ fontSize: 11, color: adm.muted, marginTop: 2 }}>{t('released')}: {fmt(l.releasedAt, lang)} · {l.releaseReason}</AT>}
          {!l.releasedAt && (releasing === l.id
            ? <ReasonBox t={t} title={t('unlock')} onSubmit={async (r) => { await api.patch(`/admin/retention/locks/${l.id}/release`, { reason: r }); setReleasing(null); load(); }} onCancel={() => setReleasing(null)} />
            : <View style={{ alignSelf: 'flex-start', marginTop: 6 }}><Btn variant="admNo" label={t('unlock')} onPress={() => setReleasing(l.id)} /></View>)}
        </View>
      ))}
    </ACard>
  );
}

function ExportsTab({ t, lang }: { t: T; lang: Lang }) {
  const [data, setData] = useState<{ rows: ExportRow[]; names: Record<string, string> } | null>(null);
  useEffect(() => { api.get<{ rows: ExportRow[]; names: Record<string, string> }>('/admin/retention/exports').then(setData).catch(() => undefined); }, []);
  if (!data) return <AT style={{ color: adm.muted, fontSize: 13 }}>{t('loading')}</AT>;
  if (!data.rows.length) return <ACard><AT style={{ color: adm.muted, fontSize: 13 }}>{t('none')}</AT></ACard>;
  return (
    <ACard style={{ gap: 10 }}>
      {data.rows.map((r) => (
        <View key={r.id} style={{ borderBottomWidth: 1, borderBottomColor: adm.border, paddingBottom: 10 }}>
          <AT style={{ fontSize: 13 }}><AT w={600} style={{ fontSize: 13 }}>{t('target')}:</AT> {data.names[r.targetUserId] || r.targetUserId}</AT>
          <AT style={{ fontSize: 12, marginTop: 2 }}>{t('reason')}: {r.reason}</AT>
          <AT style={{ fontSize: 11, color: adm.muted, marginTop: 2 }}>{fmt(r.createdAt, lang)} · {t('admin')}: {data.names[r.adminId] || r.adminId}</AT>
        </View>
      ))}
    </ACard>
  );
}

function RunsTab({ t, lang, catLabel }: { t: T; lang: Lang; catLabel: (id: string | null) => string }) {
  const [rows, setRows] = useState<RunRow[] | null>(null);
  useEffect(() => { api.get<RunRow[]>('/admin/retention/runs').then(setRows).catch(() => undefined); }, []);
  if (!rows) return <AT style={{ color: adm.muted, fontSize: 13 }}>{t('loading')}</AT>;
  if (!rows.length) return <ACard><AT style={{ color: adm.muted, fontSize: 13 }}>{t('none')}</AT></ACard>;
  return (
    <ACard style={{ gap: 8 }}>
      {rows.map((r) => (
        <View key={r.id} style={{ borderBottomWidth: 1, borderBottomColor: adm.border, paddingBottom: 8 }}>
          <AT w={600} style={{ fontSize: 13 }}>{catLabel(r.category)}</AT>
          <AT style={{ fontSize: 11, color: adm.muted }}>{t('date')}: {fmt(r.ranAt, lang)} · {t('removed')}: {r.count} · {t('switch')}: <AT style={{ fontSize: 11, color: r.enabled ? adm.green : adm.muted }}>{r.enabled ? t('on') : t('off')}</AT></AT>
        </View>
      ))}
    </ACard>
  );
}
