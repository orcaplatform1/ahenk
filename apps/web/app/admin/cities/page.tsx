'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BG, SURFACE, BORDER, TEXT, MUTED, RED, GREEN, CYAN, SANS, MONO, LABEL } from '@/lib/adminTheme';
import { ISO_COUNTRY_CODES, flagEmoji, monthName, type CitySeasonFields } from '@ahenk/shared';


const inputStyle: React.CSSProperties = {
  width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
  padding: '7px 12px', fontSize: 13, color: TEXT,
  outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
};

interface City extends CitySeasonFields {
  id: string;
  name: string;
  isActive: boolean;
  isComingSoon?: boolean;
  _count?: { venues: number; districts?: number };
}

// Şehir durumu: Aktif / Pasif / Yakında
type CityStatus = 'ACTIVE' | 'PASSIVE' | 'COMING_SOON';
const statusOf = (c: City): CityStatus => (c.isActive ? 'ACTIVE' : c.isComingSoon ? 'COMING_SOON' : 'PASSIVE');
const STATUS_LABELS: Record<CityStatus, string> = { ACTIVE: 'Aktif', PASSIVE: 'Pasif', COMING_SOON: 'Yakında' };
const STATUS_ACTIONS: Record<CityStatus, string> = { ACTIVE: 'Aktifleştir', PASSIVE: 'Pasifleştir', COMING_SOON: 'Yakında yap' };
const STATUS_ORDER: CityStatus[] = ['ACTIVE', 'PASSIVE', 'COMING_SOON'];
const AMBER = '#f59e0b';

// Sezon (gün + ay, yıl yok; isteğe bağlı, boşsa listede tarih yok) ve ülke (City.countryCode, ISO 3166-1 alpha-2, varsayılan TR;
// TR değilse listede bayrak). Bölgeler sayfası da aynı countryCode alanını düzenler
interface SeasonCountry { sd: string; sm: string; ed: string; em: string; countryCode: string }
const seasonOf = (c?: CitySeasonFields): SeasonCountry => ({
  sd: c?.seasonStartDay ? String(c.seasonStartDay) : '', sm: c?.seasonStartMonth ? String(c.seasonStartMonth) : '',
  ed: c?.seasonEndDay ? String(c.seasonEndDay) : '', em: c?.seasonEndMonth ? String(c.seasonEndMonth) : '', countryCode: c?.countryCode || 'TR',
});
const seasonBody = (v: SeasonCountry) => ({
  seasonStartDay: v.sd ? Number(v.sd) : null, seasonStartMonth: v.sm ? Number(v.sm) : null,
  seasonEndDay: v.ed ? Number(v.ed) : null, seasonEndMonth: v.em ? Number(v.em) : null, countryCode: v.countryCode,
});
// Sezonun dört alanı birlikte seçilir ya da hepsi boş bırakılır
const seasonValid = (v: SeasonCountry) => { const n = [v.sd, v.sm, v.ed, v.em].filter(Boolean).length; return n === 0 || n === 4; };
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const regionName = (() => { try { const dn = new Intl.DisplayNames(['tr'], { type: 'region' }); return (c: string) => dn.of(c) ?? c; } catch { return (c: string) => c; } })();
const COUNTRY_OPTIONS = ISO_COUNTRY_CODES.map(code => ({ code, name: regionName(code) })).sort((a, b) => a.name.localeCompare(b.name, 'tr'));

function SeasonCountryFields({ value, onChange }: { value: SeasonCountry; onChange: (v: SeasonCountry) => void }) {
  const set = (k: keyof SeasonCountry, x: string) => onChange({ ...value, [k]: x });
  const sel: React.CSSProperties = { ...inputStyle, flex: 1, minWidth: 0 };
  const dayMonth = (dk: 'sd' | 'ed', mk: 'sm' | 'em', label: string) => (
    <div>
      <p style={{ ...LABEL, margin: '0 0 4px', color: MUTED }}>{label}</p>
      <div style={{ display: 'flex', gap: 6 }}>
        <select value={value[dk]} onChange={e => set(dk, e.target.value)} aria-label={`${label} günü`} style={sel}>
          <option value="">Gün</option>
          {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={value[mk]} onChange={e => set(mk, e.target.value)} aria-label={`${label} ayı`} style={sel}>
          <option value="">Ay</option>
          {MONTHS.map(m => <option key={m} value={m}>{monthName(m, 'tr')}</option>)}
        </select>
      </div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {dayMonth('sd', 'sm', 'Sezon başlangıcı')}
      {dayMonth('ed', 'em', 'Sezon bitişi')}
      <div>
        <p style={{ ...LABEL, margin: '0 0 4px', color: MUTED }}>Ülke</p>
        <select value={value.countryCode} onChange={e => set('countryCode', e.target.value)} aria-label="Ülke" style={{ ...inputStyle }}>
          {COUNTRY_OPTIONS.map(o => <option key={o.code} value={o.code}>{flagEmoji(o.code)} {o.name} ({o.code})</option>)}
        </select>
      </div>
      {!seasonValid(value) && <p style={{ margin: 0, fontSize: 11, color: RED }}>Sezon başlangıcı ve bitişinin gün ve ayı birlikte seçilmeli.</p>}
    </div>
  );
}

// İlçe seviyeleri (statik moddaki şehir yoğunluğu / tarama listesi)
interface District { id: string; name: string; level: number }
const LEVEL_LABELS: Record<number, string> = { 1: '1. Çok yoğun', 2: '2. Yoğun', 3: '3. Orta', 4: '4. Düşük' };

const smallBtn = (color: string, bg: string, border: string): React.CSSProperties => ({
  padding: '4px 10px', borderRadius: 6, cursor: 'pointer', background: bg, border: `1px solid ${border}`,
  fontSize: 10, color, fontFamily: SANS, flexShrink: 0,
});
const CYAN_BG = 'rgba(34,211,238,0.1)', CYAN_BORDER = 'rgba(34,211,238,0.3)';
const RED_BG = 'rgba(239,68,68,0.1)', RED_BORDER = 'rgba(239,68,68,0.3)';
const MUTED_BG = 'rgba(100,116,139,0.1)', MUTED_BORDER = 'rgba(100,116,139,0.25)';

function LevelPicker({ value, onChange, disabled }: { value: number; onChange: (l: number) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {[1, 2, 3, 4].map(l => {
        const on = value === l;
        return (
          <button key={l} type="button" disabled={disabled} onClick={() => onChange(l)}
            style={{ ...smallBtn(on ? CYAN : MUTED, on ? CYAN_BG : 'transparent', on ? CYAN_BORDER : MUTED_BORDER), opacity: disabled ? 0.5 : 1 }}>
            {LEVEL_LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}

// Şehre basınca açılan İlçe Ekle penceresi: mevcut ilçeler, seviye değiştirme, ilçe silme, ilçe ekleme, şehir silme
function DistrictModal({ city, onClose, onChanged }: { city: City; onClose: () => void; onChanged: (deleted?: boolean) => void }) {
  const [rows, setRows] = useState<District[]>([]);
  const [cityName, setCityName] = useState(city.name);
  const [savedName, setSavedName] = useState(city.name);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [level, setLevel] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [season, setSeason] = useState<SeasonCountry>(seasonOf(city));
  const [savedSeason, setSavedSeason] = useState<SeasonCountry>(seasonOf(city));

  function load() {
    api.get<District[]>(`/admin/cities/${city.id}/districts`)
      .then(setRows)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [city.id]);

  async function run(key: string, fn: () => Promise<unknown>, after?: () => void) {
    setBusy(key); setError('');
    try { await fn(); load(); onChanged(); after?.(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); setConfirmDel(null); }
  }

  const add = () => run('add', () => api.post(`/admin/cities/${city.id}/districts`, { name: name.trim(), level }), () => setName(''));
  const setRowLevel = (d: District, l: number) => { if (l !== d.level) run(d.id, () => api.patch(`/admin/cities/districts/${d.id}`, { level: l })); };
  const delRow = (d: District) => run(d.id, () => api.delete(`/admin/cities/districts/${d.id}`));

  // Şehir adı: yalnız ad değişir, id aynı kalır (ilçe, mekân, kullanıcı bağları korunur)
  async function saveName() {
    const n = cityName.trim();
    setBusy('name'); setError('');
    try { await api.patch(`/admin/cities/${city.id}`, { name: n }); setSavedName(n); setCityName(n); onChanged(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }
  const nameDirty = cityName.trim() !== savedName && cityName.trim().length >= 2;

  // Sezon ve ülke: boş bırakılan alanlar temizlenir
  async function saveSeason() {
    setBusy('season'); setError('');
    try { await api.patch(`/admin/cities/${city.id}`, seasonBody(season)); setSavedSeason(season); onChanged(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }
  const seasonDirty = JSON.stringify(season) !== JSON.stringify(savedSeason) && seasonValid(season);

  async function delCity() {
    setBusy('city'); setError('');
    try { await api.delete(`/admin/cities/${city.id}`); onChanged(true); onClose(); }
    catch (e) { setError((e as Error).message); setBusy(null); setConfirmDel(null); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="ll-card" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 className="ll-title">{savedName} · İlçe Ekle</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: MUTED, padding: 4 }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={cityName} onChange={e => setCityName(e.target.value)} placeholder="Şehir adı" maxLength={60} style={{ ...inputStyle, flex: 1 }} />
          <button onClick={saveName} disabled={busy === 'name' || !nameDirty}
            style={{ ...smallBtn(CYAN, CYAN_BG, CYAN_BORDER), fontSize: 12, fontWeight: 700, padding: '6px 12px', opacity: busy === 'name' || !nameDirty ? 0.5 : 1 }}>
            {busy === 'name' ? 'Kaydediliyor…' : 'Adı Kaydet'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <SeasonCountryFields value={season} onChange={setSeason} />
          <button onClick={saveSeason} disabled={busy === 'season' || !seasonDirty}
            style={{ ...smallBtn(CYAN, CYAN_BG, CYAN_BORDER), alignSelf: 'flex-end', fontSize: 12, fontWeight: 700, padding: '6px 12px', opacity: busy === 'season' || !seasonDirty ? 0.5 : 1 }}>
            {busy === 'season' ? 'Kaydediliyor…' : 'Sezon ve Ülkeyi Kaydet'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="İlçe adı" maxLength={60} style={inputStyle} />
          <LevelPicker value={level} onChange={setLevel} />
          <button onClick={add} disabled={busy === 'add' || !name.trim()}
            style={{ width: '100%', padding: '9px', borderRadius: 8, cursor: 'pointer', background: CYAN_BG, border: `1px solid ${CYAN_BORDER}`,
              fontSize: 13, fontWeight: 700, color: CYAN, fontFamily: SANS, opacity: busy === 'add' || !name.trim() ? 0.5 : 1 }}>
            {busy === 'add' ? 'Ekleniyor…' : '+ İlçe Ekle'}
          </button>
        </div>

        {error && <p style={{ margin: '0 0 10px', fontSize: 11, color: RED }}>{error}</p>}

        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
          <p style={{ ...LABEL, margin: '0 0 8px', color: MUTED }}>MEVCUT İLÇELER ({rows.length})</p>
          {loading ? (
            <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Yükleniyor…</p>
          ) : rows.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Henüz ilçe yok</p>
          ) : rows.map(d => (
            <div key={d.id} style={{ padding: '8px 0', borderBottom: `1px solid rgba(26,58,92,0.5)`, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: TEXT }}>{d.name}</span>
                {confirmDel === d.id ? (
                  <>
                    <button onClick={() => delRow(d)} disabled={busy === d.id} style={smallBtn(RED, RED_BG, RED_BORDER)}>{busy === d.id ? '…' : 'Evet, sil'}</button>
                    <button onClick={() => setConfirmDel(null)} style={smallBtn(MUTED, MUTED_BG, MUTED_BORDER)}>Vazgeç</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDel(d.id)} style={smallBtn(RED, RED_BG, RED_BORDER)}>Sil</button>
                )}
              </div>
              <LevelPicker value={d.level} onChange={l => setRowLevel(d, l)} disabled={busy === d.id} />
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 14, paddingTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          {confirmDel === 'city' ? (
            <>
              <span style={{ flex: 1, fontSize: 12, color: RED }}>{savedName} şehri silinsin mi?</span>
              <button onClick={delCity} disabled={busy === 'city'} style={smallBtn(RED, RED_BG, RED_BORDER)}>{busy === 'city' ? '…' : 'Evet, sil'}</button>
              <button onClick={() => setConfirmDel(null)} style={smallBtn(MUTED, MUTED_BG, MUTED_BORDER)}>Vazgeç</button>
            </>
          ) : (
            <button onClick={() => setConfirmDel('city')} style={{ ...smallBtn(RED, RED_BG, RED_BORDER), marginLeft: 'auto' }}>Şehri Sil</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'add' | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [statusInput, setStatusInput] = useState<CityStatus>('PASSIVE');
  const [seasonInput, setSeasonInput] = useState<SeasonCountry>(seasonOf());
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [districtCity, setDistrictCity] = useState<City | null>(null);

  function load() {
    api.get<City[]>('/admin/cities')
      .then(setCities)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setNameInput(''); setStatusInput('PASSIVE'); setSeasonInput(seasonOf()); setError(''); setModal('add'); }

  async function save() {
    setSaving(true); setError('');
    try {
      await api.post('/admin/cities', { name: nameInput.trim(), status: statusInput, ...seasonBody(seasonInput) });
      setModal(null);
      load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function setStatus(c: City, status: CityStatus) {
    setToggling(c.id); setError('');
    try {
      await api.patch(`/admin/cities/${c.id}`, { status });
      setCities(prev => prev.map(x => x.id === c.id ? { ...x, isActive: status === 'ACTIVE', isComingSoon: status === 'COMING_SOON' } : x));
    } catch (e) { setError((e as Error).message); }
    finally { setToggling(null); }
  }

  return (
    <div className="adm-page" style={{ maxWidth: 760, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className="ll-title">Şehirler</h1>
        <button
          onClick={openAdd}
          style={{
            padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(34,211,238,0.1)', border: `1px solid rgba(34,211,238,0.3)`,
            fontSize: 13, fontWeight: 600, color: CYAN, fontFamily: SANS,
          }}
        >
          + Şehir Ekle
        </button>
      </div>

      {error && !modal && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: RED }}>{error}</p>
      )}

      <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 className="ll-title">Şehirler</h2>
          {!loading && <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>{cities.length} kayıt</span>}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ height: 48, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />)}
          </div>
        ) : cities.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>Şehir yok</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {cities.map((c, i) => (
              <div
                key={c.id}
                style={{
                  padding: '12px 18px',
                  borderBottom: i < cities.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <div onClick={() => setDistrictCity(c)} role="button" style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{c.name}</span>
                    {c.isActive ? (
                      <span style={{
                        ...LABEL,
                        padding: '1px 6px', borderRadius: 99,
                        background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: GREEN,
                      }}>AKTİF</span>
                    ) : c.isComingSoon ? (
                      <span style={{
                        ...LABEL,
                        padding: '1px 6px', borderRadius: 99,
                        background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: AMBER,
                      }}>YAKINDA</span>
                    ) : (
                      <span style={{
                        ...LABEL,
                        padding: '1px 6px', borderRadius: 99,
                        background: 'rgba(100,116,139,0.12)', border: '1px solid rgba(100,116,139,0.25)', color: MUTED,
                      }}>PASİF</span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 10, color: MUTED }}>
                    {c._count ? `${c._count.venues} mekan · ${c._count.districts ?? 0} ilçe` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {STATUS_ORDER.filter(st => st !== statusOf(c)).map(st => {
                    const color = st === 'ACTIVE' ? GREEN : st === 'COMING_SOON' ? AMBER : MUTED;
                    const rgb = st === 'ACTIVE' ? '34,197,94' : st === 'COMING_SOON' ? '245,158,11' : '100,116,139';
                    return (
                      <button
                        key={st}
                        onClick={() => setStatus(c, st)}
                        disabled={toggling === c.id}
                        style={{
                          padding: '4px 10px', borderRadius: 6, cursor: toggling === c.id ? 'not-allowed' : 'pointer',
                          background: `rgba(${rgb},0.1)`, border: `1px solid rgba(${rgb},${st === 'PASSIVE' ? 0.25 : 0.3})`,
                          fontSize: 10, color, fontFamily: SANS,
                          opacity: toggling === c.id ? 0.5 : 1,
                        }}
                      >
                        {toggling === c.id ? '…' : STATUS_ACTIONS[st]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {districtCity && (
        <DistrictModal city={districtCity} onClose={() => setDistrictCity(null)} onChanged={() => load()} />
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="ll-card" style={{ width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className="ll-title">
                Yeni Şehir
              </h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: MUTED, padding: 4 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Şehir adı" style={inputStyle} />
              <div style={{ display: 'flex', gap: 6 }}>
                {STATUS_ORDER.map(st => {
                  const on = statusInput === st;
                  return (
                    <button key={st} type="button" onClick={() => setStatusInput(st)}
                      style={{ ...smallBtn(on ? CYAN : MUTED, on ? CYAN_BG : 'transparent', on ? CYAN_BORDER : MUTED_BORDER), flex: 1, fontSize: 12, padding: '6px 10px' }}>
                      {STATUS_LABELS[st]}
                    </button>
                  );
                })}
              </div>
              <SeasonCountryFields value={seasonInput} onChange={setSeasonInput} />
              {error && <p style={{ margin: 0, fontSize: 11, color: RED }}>{error}</p>}
              <button
                onClick={save}
                disabled={saving || nameInput.trim().length < 2 || !seasonValid(seasonInput)}
                style={{
                  width: '100%', padding: '9px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
                  background: 'rgba(34,211,238,0.1)', border: `1px solid rgba(34,211,238,0.3)`,
                  fontSize: 13, fontWeight: 700, color: CYAN, fontFamily: SANS,
                  opacity: saving || nameInput.trim().length < 2 || !seasonValid(seasonInput) ? 0.5 : 1,
                }}
              >
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
