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
const SANS   = 'Inter, system-ui, sans-serif';
const MONO   = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

const inputStyle: React.CSSProperties = {
  width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
  padding: '7px 12px', fontSize: 12, color: TEXT,
  outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
};

interface City {
  id: string;
  name: string;
  isActive: boolean;
  _count?: { venues: number };
}

export default function AdminCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'add' | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  function load() {
    api.get<City[]>('/admin/cities')
      .then(setCities)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setNameInput(''); setError(''); setModal('add'); }

  async function save() {
    setSaving(true); setError('');
    try {
      await api.post('/admin/cities', { name: nameInput.trim() });
      setModal(null);
      load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function toggleActive(c: City) {
    setToggling(c.id); setError('');
    try {
      await api.patch(`/admin/cities/${c.id}`, { isActive: !c.isActive });
      setCities(prev => prev.map(x => x.id === c.id ? { ...x, isActive: !c.isActive } : x));
    } catch (e) { setError((e as Error).message); }
    finally { setToggling(null); }
  }

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>Şehirler</h1>
        <button
          onClick={openAdd}
          style={{
            padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(34,211,238,0.1)', border: `1px solid rgba(34,211,238,0.3)`,
            fontSize: 12, fontWeight: 600, color: CYAN, fontFamily: SANS,
          }}
        >
          + Şehir Ekle
        </button>
      </div>

      {error && !modal && (
        <p style={{ margin: '0 0 12px', fontSize: 12, color: RED }}>{error}</p>
      )}

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 2, height: 12, borderRadius: 1, background: CYAN }} />
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: CYAN }}>ŞEHİRLER</span>
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{c.name}</span>
                    {!c.isActive && (
                      <span style={{
                        fontSize: 8, fontWeight: 800, letterSpacing: '0.1em',
                        padding: '1px 6px', borderRadius: 99,
                        background: 'rgba(100,116,139,0.12)', border: '1px solid rgba(100,116,139,0.25)', color: MUTED,
                      }}>PASİF</span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 10, color: MUTED }}>
                    {c._count ? `${c._count.venues} mekan` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => toggleActive(c)}
                    disabled={toggling === c.id}
                    style={{
                      padding: '4px 10px', borderRadius: 6, cursor: toggling === c.id ? 'not-allowed' : 'pointer',
                      background: c.isActive ? 'rgba(100,116,139,0.1)' : 'rgba(34,197,94,0.1)',
                      border: `1px solid ${c.isActive ? 'rgba(100,116,139,0.25)' : 'rgba(34,197,94,0.3)'}`,
                      fontSize: 10, color: c.isActive ? MUTED : GREEN, fontFamily: SANS,
                      opacity: toggling === c.id ? 0.5 : 1,
                    }}
                  >
                    {toggling === c.id ? '…' : c.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>
                Yeni Şehir
              </h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: MUTED, padding: 4 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Şehir adı" style={inputStyle} />
              {error && <p style={{ margin: 0, fontSize: 11, color: RED }}>{error}</p>}
              <button
                onClick={save}
                disabled={saving || nameInput.trim().length < 2}
                style={{
                  width: '100%', padding: '9px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
                  background: 'rgba(34,211,238,0.1)', border: `1px solid rgba(34,211,238,0.3)`,
                  fontSize: 12, fontWeight: 700, color: CYAN, fontFamily: SANS,
                  opacity: saving || nameInput.trim().length < 2 ? 0.5 : 1,
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
