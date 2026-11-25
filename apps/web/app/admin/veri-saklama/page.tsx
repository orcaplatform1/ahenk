'use client';

// Admin → Veri Saklama (yalnız SUPERADMIN): politika tablosu, kişi arama + dışa aktarma + saklama kilidi, dışa aktarma ve silme geçmişi.
// Politika tek kaynaktan: backend/src/retention/retention-policy.ts. Arayüz TR + EN (metinler shared i18n "dr.*").
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BG, BORDER, TEXT, MUTED, RED, GREEN, SANS, MONO, LABEL } from '@/lib/adminTheme';
import { messagesTr, messagesEn } from '@ahenk/shared';

type Lang = 'tr' | 'en';
type Tx = { tr: string; en: string };
interface Category {
  id: string; label: Tx; fields: Tx; location: string; duration: Tx; start: Tx; basis: Tx; action: Tx; auto: boolean;
  count: number | null; oldest: string | null; nextDeletion: string | null; dueNow: number | null;
}
interface SearchRow { userId: string; name: string; phone: string | null; deleted: boolean; deletedAt: string | null; isBot: boolean }
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

const inputStyle: React.CSSProperties = { width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 12px', fontSize: 13, color: TEXT, outline: 'none', fontFamily: SANS, boxSizing: 'border-box' };
const btn = (color: string): React.CSSProperties => ({ padding: '6px 12px', minHeight: 36, borderRadius: 8, cursor: 'pointer', background: 'transparent', border: `1px solid ${color}`, fontSize: 12, color, fontFamily: SANS });
const cell: React.CSSProperties = { padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: TEXT, verticalAlign: 'top', textAlign: 'left' };

const fmt = (d: string | null | undefined, lang: Lang) => (d ? new Date(d).toLocaleString(lang === 'en' ? 'en-GB' : 'tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' }) : '-');

// Gerekçe istenen işlem (dışa aktarma, kilit, kilit kaldırma)
function ReasonBox({ t, title, extra, onSubmit, onCancel }: { t: (k: string) => string; title: string; extra?: React.ReactNode; onSubmit: (reason: string) => Promise<void>; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    if (reason.trim().length < 3) { setErr(t('reasonReq')); return; }
    setBusy(true); setErr('');
    try { await onSubmit(reason.trim()); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: `1px solid ${BORDER}`, borderRadius: 10, marginTop: 10 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>{title}</p>
      {extra}
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('reason')} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
      {err && <p style={{ margin: 0, fontSize: 12, color: RED }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={btn(MUTED)}>{t('cancel')}</button>
        <button type="button" onClick={go} disabled={busy} style={{ ...btn(GREEN), opacity: busy ? 0.5 : 1 }}>{busy ? t('exporting') : t('save')}</button>
      </div>
    </div>
  );
}

export default function VeriSaklamaPage() {
  const [lang, setLang] = useState<Lang>('tr');
  useEffect(() => { try { const v = localStorage.getItem(LANG_KEY); if (v === 'en' || v === 'tr') setLang(v); } catch { /* tarayıcı depolaması yok */ } }, []);
  const switchLang = (l: Lang) => { setLang(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* yok */ } };
  const t = (k: string) => DICT[lang][k] ?? k;
  const [tab, setTab] = useState<Tab>('policy');
  const [policy, setPolicy] = useState<{ autoDataDeletion: boolean; categories: Category[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get<{ autoDataDeletion: boolean; categories: Category[] }>('/admin/retention/policy').then(setPolicy).catch((e: Error) => setError(e.message)); }, []);
  const catLabel = (id: string | null) => policy?.categories.find((c) => c.id === id)?.label[lang] ?? id ?? '-';

  return (
    <div className="adm-page" style={{ maxWidth: 1100, margin: '0 auto', fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <h1 className="ll-title">{t('title')}</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['tr', 'en'] as Lang[]).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => switchLang(l)} style={{ ...btn(lang === l ? '#22d3ee' : MUTED), minWidth: 44 }}>{l.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {TABS.map((v) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600, background: tab === v ? 'rgba(34,211,238,0.1)' : 'transparent', border: `1px solid ${tab === v ? 'rgba(34,211,238,0.3)' : BORDER}`, color: tab === v ? '#22d3ee' : MUTED }}>
            {t(TAB_KEY[v])}
          </button>
        ))}
      </div>
      {error && <p style={{ color: RED, fontSize: 13 }}>{error}</p>}
      {tab === 'policy' && <PolicyTab t={t} lang={lang} policy={policy} />}
      {tab === 'person' && <PersonTab t={t} lang={lang} catLabel={catLabel} categories={policy?.categories ?? []} />}
      {tab === 'locks' && <LocksTab t={t} lang={lang} catLabel={catLabel} />}
      {tab === 'exports' && <ExportsTab t={t} lang={lang} />}
      {tab === 'runs' && <RunsTab t={t} lang={lang} catLabel={catLabel} />}
    </div>
  );
}

// Dar ekranda (768 px altı) her kategori ayrı kart, alanlar "Etiket: Değer" alt alta; geniş ekranda tablo (okunabilir sütun genişlikleri,
// gerekirse yatay kaydırma; kelimeler harf harf kırılmaz)
const COL_MIN: Record<string, number> = { category: 180, fields: 280, location: 200, duration: 140, start: 140, basis: 200, action: 160, count: 80, oldest: 130, next: 130, dueNow: 90 };
function PolicyTab({ t, lang, policy }: { t: (k: string) => string; lang: Lang; policy: { autoDataDeletion: boolean; categories: Category[] } | null }) {
  if (!policy) return <p style={{ color: MUTED, fontSize: 13 }}>{t('loading')}</p>;
  const heads = ['category', 'fields', 'location', 'duration', 'start', 'basis', 'action', 'count', 'oldest', 'next', 'dueNow'];
  const values = (c: Category): [string, React.ReactNode, boolean][] => [
    ['fields', c.fields[lang], false], ['location', c.location, true], ['duration', c.duration[lang], false], ['start', c.start[lang], false],
    ['basis', c.basis[lang], false], ['action', c.action[lang], false], ['count', c.count ?? '-', true], ['oldest', fmt(c.oldest, lang), false],
    ['next', c.auto ? fmt(c.nextDeletion, lang) : '-', false], ['dueNow', c.dueNow ?? '-', true],
  ];
  const wrap: React.CSSProperties = { wordBreak: 'normal', overflowWrap: 'break-word', whiteSpace: 'normal' };
  return (
    <div className="ll-card">
      <style>{`.vs-cards{display:none}@media (max-width:767px){.vs-table{display:none}.vs-cards{display:flex}}`}</style>
      <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: policy.autoDataDeletion ? GREEN : MUTED }}>{policy.autoDataDeletion ? t('autoOn') : t('autoOff')}</p>
      <div className="vs-table" style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'auto' }}>
          <thead><tr>{heads.map((h) => <th key={h} style={{ ...cell, ...LABEL, ...wrap, color: MUTED, minWidth: COL_MIN[h] }}>{t(h)}</th>)}</tr></thead>
          <tbody>
            {policy.categories.map((c) => (
              <tr key={c.id}>
                <td style={{ ...cell, ...wrap, fontWeight: 600, minWidth: COL_MIN.category }}>{c.label[lang]}</td>
                {values(c).map(([k, v, mono]) => (
                  <td key={k} style={{ ...cell, ...wrap, minWidth: COL_MIN[k], ...(mono ? { fontFamily: MONO, fontSize: k === 'location' ? 11 : 12 } : {}) }}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="vs-cards" style={{ flexDirection: 'column', gap: 10 }}>
        {policy.categories.map((c) => (
          <div key={c.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT, ...wrap }}>{c.label[lang]}</p>
            {values(c).map(([k, v, mono]) => (
              <p key={k} style={{ margin: 0, fontSize: 12, color: TEXT, ...wrap }}>
                <span style={{ color: MUTED }}>{t(k)}: </span><span style={mono ? { fontFamily: MONO } : undefined}>{v}</span>
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonTab({ t, lang, catLabel, categories }: { t: (k: string) => string; lang: Lang; catLabel: (id: string | null) => string; categories: Category[] }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<SearchRow[] | null>(null);
  const [sel, setSel] = useState<SearchRow | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [mode, setMode] = useState<'' | 'export' | 'lockPerson' | 'lockRecord'>('');
  const [recCat, setRecCat] = useState('PAYMENT');
  const [recId, setRecId] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function search() {
    setErr(''); setSel(null); setPerson(null);
    try { setRows(await api.get<SearchRow[]>(`/admin/retention/search?q=${encodeURIComponent(q.trim())}`)); } catch (e) { setErr((e as Error).message); }
  }
  async function open(r: SearchRow) {
    setSel(r); setPerson(null); setMode(''); setMsg(''); setErr('');
    try { setPerson(await api.get<Person>(`/admin/retention/person/${r.userId}`)); } catch (e) { setErr((e as Error).message); }
  }
  async function doExport(reason: string) {
    if (!sel) return;
    const res = await api.post<{ fileName: string; base64: string }>(`/admin/retention/export/${sel.userId}`, { reason });
    const bin = atob(res.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
    const a = document.createElement('a'); a.href = url; a.download = res.fileName; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setMode(''); setMsg(t('exported'));
  }
  async function doLock(reason: string, record: boolean) {
    if (!sel) return;
    await api.post('/admin/retention/locks', record ? { category: recCat, recordId: recId.trim(), reason } : { userId: sel.userId, reason });
    setMode(''); open(sel);
  }

  if (sel) {
    return (
      <div className="ll-card">
        <button type="button" onClick={() => { setSel(null); setPerson(null); }} style={btn(MUTED)}>{t('back')}</button>
        <p style={{ margin: '12px 0 2px', fontSize: 15, fontWeight: 600, color: TEXT }}>{sel.name || '-'}</p>
        <p style={{ margin: 0, fontSize: 12, color: MUTED, fontFamily: MONO }}>{sel.phone ?? '-'} · {sel.userId} · {sel.deleted ? `${t('deleted')} (${fmt(sel.deletedAt, lang)})` : t('active')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => setMode('export')} style={btn('#22d3ee')}>{t('export')}</button>
          <button type="button" onClick={() => setMode('lockPerson')} style={btn('#f59e0b')}>{t('lockPerson')}</button>
          <button type="button" onClick={() => setMode('lockRecord')} style={btn('#f59e0b')}>{t('lockRecord')}</button>
        </div>
        {msg && <p style={{ margin: '8px 0 0', fontSize: 12, color: GREEN }}>{msg}</p>}
        {mode === 'export' && <ReasonBox t={t} title={t('export')} onSubmit={doExport} onCancel={() => setMode('')} />}
        {mode === 'lockPerson' && <ReasonBox t={t} title={t('lockPerson')} onSubmit={(r) => doLock(r, false)} onCancel={() => setMode('')} />}
        {mode === 'lockRecord' && (
          <ReasonBox t={t} title={t('lockRecord')} onSubmit={(r) => doLock(r, true)} onCancel={() => setMode('')} extra={(
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={recCat} onChange={(e) => setRecCat(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 180 }}>
                {categories.filter((c) => c.auto).map((c) => <option key={c.id} value={c.id}>{c.label[lang]}</option>)}
              </select>
              <input value={recId} onChange={(e) => setRecId(e.target.value)} placeholder={t('recordId')} style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
            </div>
          )} />
        )}
        {err && <p style={{ color: RED, fontSize: 13 }}>{err}</p>}
        {!person ? <p style={{ color: MUTED, fontSize: 13, marginTop: 12 }}>{t('loading')}</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {person.locks.length > 0 && (
              <div>
                <p style={{ ...LABEL, color: MUTED, margin: '0 0 4px' }}>{t('tabLocks')}</p>
                {person.locks.map((l) => (
                  <p key={l.id} style={{ margin: '2px 0', fontSize: 12, color: l.releasedAt ? MUTED : '#f59e0b' }}>
                    {l.userId ? t('personLock') : `${t('recordLock')}: ${catLabel(l.category)} · ${l.recordId}`} · {fmt(l.createdAt, lang)} · {l.reason} · {l.releasedAt ? t('released') : t('locked')}
                  </p>
                ))}
              </div>
            )}
            {Object.entries(person.categories).map(([id, data]) => {
              const empty = Object.values(data).every((v) => v == null || (Array.isArray(v) && v.length === 0));
              return (
                <details key={id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: '8px 12px' }}>
                  <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: TEXT }}>{catLabel(id)}</summary>
                  {empty ? <p style={{ fontSize: 12, color: MUTED }}>{t('noRecords')}</p> : (
                    <pre style={{ fontSize: 11, color: TEXT, fontFamily: MONO, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 420, overflow: 'auto' }}>{JSON.stringify(data, null, 2)}</pre>
                  )}
                </details>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="ll-card">
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search(); }} placeholder={t('searchPh')} style={{ ...inputStyle, flex: 1 }} />
        <button type="button" onClick={search} style={btn('#22d3ee')}>{t('search')}</button>
      </div>
      {err && <p style={{ color: RED, fontSize: 13 }}>{err}</p>}
      {rows && (rows.length === 0 ? <p style={{ color: MUTED, fontSize: 13 }}>{t('noResult')}</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
          {rows.map((r) => (
            <button key={r.userId} type="button" onClick={() => open(r)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent', cursor: 'pointer', color: TEXT, fontFamily: SANS }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name || '-'}</span>
              <span style={{ display: 'block', fontSize: 11, color: MUTED, fontFamily: MONO }}>{r.phone ?? '-'} · {r.userId} · {r.deleted ? t('deleted') : t('active')}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function LocksTab({ t, lang, catLabel }: { t: (k: string) => string; lang: Lang; catLabel: (id: string | null) => string }) {
  const [data, setData] = useState<{ rows: Lock[]; names: Record<string, string> } | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);
  const load = () => api.get<{ rows: Lock[]; names: Record<string, string> }>('/admin/retention/locks').then(setData).catch(() => undefined);
  useEffect(() => { load(); }, []);
  if (!data) return <p style={{ color: MUTED, fontSize: 13 }}>{t('loading')}</p>;
  if (!data.rows.length) return <div className="ll-card"><p style={{ margin: 0, color: MUTED, fontSize: 13 }}>{t('none')}</p></div>;
  return (
    <div className="ll-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.rows.map((l) => (
        <div key={l.id} style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: l.releasedAt ? MUTED : '#f59e0b' }}>
            {l.userId ? `${t('personLock')}: ${data.names[l.userId] || l.userId}` : `${t('recordLock')}: ${catLabel(l.category)} · ${l.recordId}`} · {l.releasedAt ? t('released') : t('locked')}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT }}>{t('reason')}: {l.reason}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: MUTED }}>{fmt(l.createdAt, lang)} · {t('admin')}: {data.names[l.createdById] || l.createdById}</p>
          {l.releasedAt && <p style={{ margin: '2px 0 0', fontSize: 11, color: MUTED }}>{t('released')}: {fmt(l.releasedAt, lang)} · {l.releaseReason}</p>}
          {!l.releasedAt && (releasing === l.id
            ? <ReasonBox t={t} title={t('unlock')} onSubmit={async (r) => { await api.patch(`/admin/retention/locks/${l.id}/release`, { reason: r }); setReleasing(null); load(); }} onCancel={() => setReleasing(null)} />
            : <button type="button" onClick={() => setReleasing(l.id)} style={{ ...btn(RED), marginTop: 6 }}>{t('unlock')}</button>)}
        </div>
      ))}
    </div>
  );
}

function ExportsTab({ t, lang }: { t: (k: string) => string; lang: Lang }) {
  const [data, setData] = useState<{ rows: ExportRow[]; names: Record<string, string> } | null>(null);
  useEffect(() => { api.get<{ rows: ExportRow[]; names: Record<string, string> }>('/admin/retention/exports').then(setData).catch(() => undefined); }, []);
  if (!data) return <p style={{ color: MUTED, fontSize: 13 }}>{t('loading')}</p>;
  if (!data.rows.length) return <div className="ll-card"><p style={{ margin: 0, color: MUTED, fontSize: 13 }}>{t('none')}</p></div>;
  return (
    <div className="ll-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.rows.map((r) => (
        <div key={r.id} style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 13, color: TEXT }}><strong>{t('target')}:</strong> {data.names[r.targetUserId] || r.targetUserId}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT }}>{t('reason')}: {r.reason}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: MUTED }}>{fmt(r.createdAt, lang)} · {t('admin')}: {data.names[r.adminId] || r.adminId}</p>
        </div>
      ))}
    </div>
  );
}

function RunsTab({ t, lang, catLabel }: { t: (k: string) => string; lang: Lang; catLabel: (id: string | null) => string }) {
  const [rows, setRows] = useState<RunRow[] | null>(null);
  useEffect(() => { api.get<RunRow[]>('/admin/retention/runs').then(setRows).catch(() => undefined); }, []);
  if (!rows) return <p style={{ color: MUTED, fontSize: 13 }}>{t('loading')}</p>;
  if (!rows.length) return <div className="ll-card"><p style={{ margin: 0, color: MUTED, fontSize: 13 }}>{t('none')}</p></div>;
  return (
    <div className="ll-card" style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520 }}>
        <thead><tr>{['date', 'category', 'removed', 'switch'].map((h) => <th key={h} style={{ ...cell, ...LABEL, color: MUTED }}>{t(h)}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={cell}>{fmt(r.ranAt, lang)}</td>
              <td style={cell}>{catLabel(r.category)}</td>
              <td style={{ ...cell, fontFamily: MONO }}>{r.count}</td>
              <td style={{ ...cell, color: r.enabled ? GREEN : MUTED }}>{r.enabled ? t('on') : t('off')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
