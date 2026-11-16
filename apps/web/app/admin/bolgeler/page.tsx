'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BG, SURFACE, BORDER, TEXT, MUTED, RED, GREEN, CYAN, SANS, MONO, LABEL } from '@/lib/adminTheme';

// Bölgeler: şehir = bölge ayarları (ülke, saat dilimi, para birimi, varsayılan dil, telefon kodu, kimlik türleri, aktiflik, sıra)
// ve pasif bölgelerin "Haber ver" bekleme listesi. Aktif yapılan bölge kullanıcı şehir listelerinde üst gruba geçer.
type IdType = 'TC' | 'YKN' | 'PASSPORT';
interface Region {
  id: string; name: string; isActive: boolean; countryCode: string; timezone: string; currency: string;
  defaultLanguage: string; phoneCountryCode: string; idTypes: IdType[]; sortOrder: number; waitlistCount: number;
}
interface WaitRow { id: string; createdAt: string; userId: string; email: string; phone: string | null; name: string }

const ID_LABEL: Record<IdType, string> = { TC: 'TC Kimlik Kartı', YKN: 'Yabancı Kimlik Kartı (YKN)', PASSPORT: 'Pasaport' };
const inputStyle: React.CSSProperties = { width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 12px', fontSize: 13, color: TEXT, outline: 'none', fontFamily: SANS, boxSizing: 'border-box' };
const btn = (color: string): React.CSSProperties => ({ padding: '6px 12px', minHeight: 36, borderRadius: 8, cursor: 'pointer', background: 'transparent', border: `1px solid ${color}`, fontSize: 12, color, fontFamily: SANS });
const fmt = (iso: string) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function RegionEditor({ r, onSaved }: { r: Region; onSaved: () => void }) {
  const [f, setF] = useState({ name: r.name, countryCode: r.countryCode, timezone: r.timezone, currency: r.currency, defaultLanguage: r.defaultLanguage, phoneCountryCode: r.phoneCountryCode, idTypes: r.idTypes, sortOrder: r.sortOrder });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  async function save() {
    setBusy(true); setErr('');
    try { await api.patch(`/admin/regions/${r.id}`, { ...f, sortOrder: Number(f.sortOrder) || 0 }); onSaved(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const field = (label: string, el: React.ReactNode) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ ...LABEL, color: MUTED }}>{label}</span>{el}</label>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 12 }}>
      {field('Ad', <input style={inputStyle} value={f.name} onChange={(e) => set('name', e.target.value)} />)}
      {field('Ülke kodu', <input style={inputStyle} value={f.countryCode} maxLength={2} onChange={(e) => set('countryCode', e.target.value.toUpperCase())} />)}
      {field('Saat dilimi', <input style={inputStyle} value={f.timezone} onChange={(e) => set('timezone', e.target.value)} />)}
      {field('Para birimi', <select style={inputStyle} value={f.currency} onChange={(e) => set('currency', e.target.value)}><option value="TRY">TRY</option><option value="USD">USD</option></select>)}
      {field('Varsayılan dil', <select style={inputStyle} value={f.defaultLanguage} onChange={(e) => set('defaultLanguage', e.target.value)}><option value="tr">Türkçe</option><option value="en">English</option></select>)}
      {field('Telefon kodu', <input style={inputStyle} value={f.phoneCountryCode} onChange={(e) => set('phoneCountryCode', e.target.value)} />)}
      {field('Sıra', <input style={inputStyle} type="number" value={f.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} />)}
      {field('Kimlik türleri', (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(['TC', 'YKN', 'PASSPORT'] as IdType[]).map((it) => (
            <label key={it} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: TEXT }}>
              <input type="checkbox" checked={f.idTypes.includes(it)} onChange={(e) => set('idTypes', e.target.checked ? [...f.idTypes, it] : f.idTypes.filter((x) => x !== it))} />
              {ID_LABEL[it]}
            </label>
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <button type="button" onClick={save} disabled={busy} style={btn(GREEN)}>{busy ? '…' : 'Kaydet'}</button>
        {err && <span style={{ fontSize: 12, color: RED }}>{err}</span>}
      </div>
    </div>
  );
}

export default function BolgelerPage() {
  const [rows, setRows] = useState<Region[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [waitFor, setWaitFor] = useState<string | null>(null);
  const [wait, setWait] = useState<WaitRow[]>([]);
  const load = () => api.get<Region[]>('/admin/regions').then(setRows).catch((e: Error) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function toggle(r: Region) {
    try { await api.patch(`/admin/regions/${r.id}`, { isActive: !r.isActive }); load(); } catch (e) { setError((e as Error).message); }
  }
  async function showWait(id: string) {
    if (waitFor === id) { setWaitFor(null); return; }
    setWaitFor(id); setWait([]);
    try { setWait(await api.get<WaitRow[]>(`/admin/regions/${id}/waitlist`)); } catch (e) { setError((e as Error).message); }
  }

  return (
    <div style={{ padding: 24, color: TEXT, fontFamily: SANS, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>Bölgeler</h1>
      <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Aktif bölgeler kullanıcı şehir listelerinde seçilebilir; Türkiye dışındaki pasif bölgeler &quot;Yakında&quot; grubunda görünür.</p>
      {error && <p style={{ margin: 0, fontSize: 13, color: RED }}>{error}</p>}
      {rows.map((r) => (
        <div key={r.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{r.name}</p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO }}>{r.countryCode} · {r.timezone} · {r.currency} · {r.defaultLanguage} · {r.phoneCountryCode} · sıra {r.sortOrder}</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" onClick={() => toggle(r)} style={btn(r.isActive ? GREEN : MUTED)}>{r.isActive ? 'Aktif' : 'Pasif'}</button>
              <button type="button" onClick={() => showWait(r.id)} style={btn(CYAN)}>Bekleme listesi ({r.waitlistCount})</button>
              <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} style={btn(TEXT)}>{open === r.id ? 'Kapat' : 'Düzenle'}</button>
            </div>
          </div>
          {open === r.id && <RegionEditor r={r} onSaved={() => { setOpen(null); load(); }} />}
          {waitFor === r.id && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {wait.length === 0 ? <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Bekleme listesi boş.</p> : wait.map((w) => (
                <div key={w.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, fontSize: 12, borderTop: `1px solid ${BORDER}`, paddingTop: 6 }}>
                  <span>{w.name || '—'} · {w.email} · {w.phone ?? '—'}</span>
                  <span style={{ color: MUTED, fontFamily: MONO }}>{fmt(w.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
