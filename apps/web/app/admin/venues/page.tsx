'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const BG     = '#020c1b';
const SURFACE = '#0a1628';
const CARD   = '#0d1f3c';
const BORDER = '#1a3a5c';
const TEXT   = '#e2e8f0';
const MUTED  = '#64748b';
const GREEN  = '#22c55e';
const RED    = '#ef4444';
const CYAN   = '#22d3ee';
const BLUE   = '#3b82f6';
const SANS   = 'Inter, system-ui, sans-serif';
const MONO   = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

const inputStyle: React.CSSProperties = {
  width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
  padding: '7px 12px', fontSize: 12, color: TEXT,
  outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
};

interface City { id: string; name: string; }
interface Venue {
  id: string; name: string; category: string; venueType?: string;
  address?: string; description?: string; isActive: boolean;
  city: City;
}

const CATS = ['SADE', 'ORTA', 'PREMIUM'];

export default function AdminVenues() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [form, setForm] = useState({ name: '', category: 'SADE', cityId: '', address: '', description: '' });
  const [saving, setSaving] = useState(false);

  function loadVenues(cityId?: string) {
    const q = cityId ? `?cityId=${cityId}` : '';
    api.get<Venue[]>(`/admin/venues${q}`).then(setVenues).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => {
    api.get<City[]>('/admin/cities').then(setCities).catch(() => {});
    loadVenues();
  }, []);

  function openAdd() {
    setForm({ name: '', category: 'SADE', cityId: cities[0]?.id ?? '', address: '', description: '' });
    setModal('add');
  }

  function openEdit(v: Venue) {
    setEditing(v);
    setForm({ name: v.name, category: v.category, cityId: v.city.id, address: v.address ?? '', description: v.description ?? '' });
    setModal('edit');
  }

  async function save() {
    setSaving(true);
    const body = { name: form.name, category: form.category, cityId: form.cityId, address: form.address || undefined, description: form.description || undefined };
    if (modal === 'add') await api.post('/admin/venues', body).catch(() => {});
    else if (editing) await api.patch(`/admin/venues/${editing.id}`, body).catch(() => {});
    setSaving(false);
    setModal(null);
    loadVenues(selectedCity || undefined);
  }

  async function deleteVenue(id: string) {
    if (!confirm('Mekanı sil?')) return;
    await api.delete(`/admin/venues/${id}`).catch(() => {});
    loadVenues(selectedCity || undefined);
  }

  async function toggleActive(v: Venue) {
    await api.patch(`/admin/venues/${v.id}`, { isActive: !v.isActive }).catch(() => {});
    loadVenues(selectedCity || undefined);
  }

  const filtered = selectedCity ? venues.filter(v => v.city.id === selectedCity) : venues;

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>Mekanlar</h1>
        <button
          onClick={openAdd}
          style={{
            padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(34,211,238,0.1)', border: `1px solid rgba(34,211,238,0.3)`,
            fontSize: 12, fontWeight: 600, color: CYAN, fontFamily: SANS,
          }}
        >
          + Mekan Ekle
        </button>
      </div>

      {/* Şehir filtresi */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        <button
          onClick={() => { setSelectedCity(''); loadVenues(); }}
          style={{
            padding: '4px 12px', borderRadius: 99, fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: selectedCity === '' ? 'rgba(59,130,246,0.15)' : 'transparent',
            border: `1px solid ${selectedCity === '' ? 'rgba(59,130,246,0.35)' : BORDER}`,
            color: selectedCity === '' ? BLUE : MUTED,
          }}
        >
          Tümü
        </button>
        {cities.map(c => (
          <button
            key={c.id}
            onClick={() => { setSelectedCity(c.id); loadVenues(c.id); }}
            style={{
              padding: '4px 12px', borderRadius: 99, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: selectedCity === c.id ? 'rgba(59,130,246,0.15)' : 'transparent',
              border: `1px solid ${selectedCity === c.id ? 'rgba(59,130,246,0.35)' : BORDER}`,
              color: selectedCity === c.id ? BLUE : MUTED,
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 2, height: 12, borderRadius: 1, background: CYAN }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: CYAN }}>MEKANLAR</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ height: 48, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />)}
          </div>
        </div>
      ) : (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 2, height: 12, borderRadius: 1, background: CYAN }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: CYAN }}>MEKANLAR</span>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>{filtered.length} kayıt</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>Mekan yok</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filtered.map((v, i) => (
                <div
                  key={v.id}
                  style={{
                    padding: '12px 18px',
                    borderBottom: i < filtered.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                      {!v.isActive && (
                        <span style={{
                          fontSize: 8, fontWeight: 800, letterSpacing: '0.1em',
                          padding: '1px 6px', borderRadius: 99,
                          background: 'rgba(100,116,139,0.12)', border: '1px solid rgba(100,116,139,0.25)', color: MUTED,
                        }}>PASİF</span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 10, color: MUTED }}>
                      {v.city.name} · {v.category}{v.address ? ` · ${v.address}` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => toggleActive(v)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        background: v.isActive ? 'rgba(100,116,139,0.1)' : 'rgba(34,197,94,0.1)',
                        border: `1px solid ${v.isActive ? 'rgba(100,116,139,0.25)' : 'rgba(34,197,94,0.3)'}`,
                        fontSize: 10, color: v.isActive ? MUTED : GREEN, fontFamily: SANS,
                      }}
                    >
                      {v.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                    </button>
                    <button
                      onClick={() => openEdit(v)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                        fontSize: 10, color: '#93c5fd', fontFamily: SANS,
                      }}
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => deleteVenue(v.id)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        fontSize: 10, color: RED, fontFamily: SANS,
                      }}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>
                {modal === 'add' ? 'Yeni Mekan' : 'Mekanı Düzenle'}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: MUTED, padding: 4 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Mekan adı" style={inputStyle} />
              <select value={form.cityId} onChange={e => setForm(f => ({ ...f, cityId: e.target.value }))} style={{ ...inputStyle, background: SURFACE }}>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inputStyle, background: SURFACE }}>
                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Adres (opsiyonel)" style={inputStyle} />
              <button
                onClick={save}
                disabled={saving || !form.name || !form.cityId}
                style={{
                  width: '100%', padding: '9px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
                  background: 'rgba(34,211,238,0.1)', border: `1px solid rgba(34,211,238,0.3)`,
                  fontSize: 12, fontWeight: 700, color: CYAN, fontFamily: SANS,
                  opacity: saving || !form.name || !form.cityId ? 0.5 : 1,
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
