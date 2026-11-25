'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BG, SURFACE, BORDER, TEXT, MUTED, RED, GREEN, SANS, MONO, LABEL } from '@/lib/adminTheme';

// Bölgeler: şehir = bölge ayarları (ülke, saat dilimi, para birimi, varsayılan dil, telefon kodu, kimlik türleri, aktiflik, sıra)
// Aktif yapılan bölge kullanıcı şehir listelerinde üst gruba geçer.
type IdType = 'ID_CARD' | 'DRIVER_LICENSE' | 'PASSPORT' | 'RESIDENCE_PERMIT';
interface Region {
  id: string; name: string; isActive: boolean; isComingSoon?: boolean; countryCode: string; timezone: string; currency: string;
  defaultLanguage: string; phoneCountryCode: string; idTypes: IdType[]; sortOrder: number;
}

// Durum: Aktif / Pasif / Yakında
type RegionStatus = 'ACTIVE' | 'PASSIVE' | 'COMING_SOON';
const statusOf = (r: Region): RegionStatus => (r.isActive ? 'ACTIVE' : r.isComingSoon ? 'COMING_SOON' : 'PASSIVE');
const STATUS_LABELS: Record<RegionStatus, string> = { ACTIVE: 'Aktif', PASSIVE: 'Pasif', COMING_SOON: 'Yakında' };
const AMBER = '#f59e0b';
const ID_LABEL: Record<IdType, string> = { ID_CARD: 'Kimlik Kartı', DRIVER_LICENSE: 'Ehliyet', PASSPORT: 'Pasaport', RESIDENCE_PERMIT: 'Oturma İzni' };
const inputStyle: React.CSSProperties = { width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 12px', fontSize: 13, color: TEXT, outline: 'none', fontFamily: SANS, boxSizing: 'border-box' };
const btn = (color: string): React.CSSProperties => ({ padding: '6px 12px', minHeight: 36, borderRadius: 8, cursor: 'pointer', background: 'transparent', border: `1px solid ${color}`, fontSize: 12, color, fontFamily: SANS });

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
      {field('Belge türleri', (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(['ID_CARD', 'DRIVER_LICENSE', 'PASSPORT', 'RESIDENCE_PERMIT'] as IdType[]).map((it) => (
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
  const load = () => api.get<Region[]>('/admin/regions').then(setRows).catch((e: Error) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function setStatus(r: Region, status: RegionStatus) {
    if (statusOf(r) === status) return;
    try { await api.patch(`/admin/regions/${r.id}`, { status }); load(); } catch (e) { setError((e as Error).message); }
  }

  return (
    <div style={{ padding: 24, color: TEXT, fontFamily: SANS, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>Bölgeler</h1>
      <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Aktif bölgeler kullanıcı şehir listelerinde seçilebilir; Yakında bölgeler &quot;Yakında&quot; grubunda seçilemez görünür; pasif bölgeler listelerde görünmez.</p>
      {error && <p style={{ margin: 0, fontSize: 13, color: RED }}>{error}</p>}
      {rows.map((r) => (
        <div key={r.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{r.name}</p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO }}>{r.countryCode} · {r.timezone} · {r.currency} · {r.defaultLanguage} · {r.phoneCountryCode} · sıra {r.sortOrder}</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(['ACTIVE', 'PASSIVE', 'COMING_SOON'] as RegionStatus[]).map((st) => {
                const on = statusOf(r) === st;
                const c = st === 'ACTIVE' ? GREEN : st === 'COMING_SOON' ? AMBER : MUTED;
                return (
                  <button key={st} type="button" onClick={() => setStatus(r, st)}
                    style={{ ...btn(on ? c : BORDER), color: on ? c : MUTED, fontWeight: on ? 700 : 400 }}>
                    {STATUS_LABELS[st]}
                  </button>
                );
              })}
              <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} style={btn(TEXT)}>{open === r.id ? 'Kapat' : 'Düzenle'}</button>
            </div>
          </div>
          {open === r.id && <RegionEditor r={r} onSaved={() => { setOpen(null); load(); }} />}
        </div>
      ))}
    </div>
  );
}
