'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

// ─── Renk sabitleri ───────────────────────────────────────────────────────────
const SURFACE = '#0a1628';
const CARD    = '#0d1f3c';
const BORDER  = '#1a3a5c';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const GREEN   = '#22c55e';
const RED     = '#ef4444';
const BLUE    = '#3b82f6';
const CYAN    = '#22d3ee';
const AMBER   = '#f59e0b';
const SANS    = 'Inter, system-ui, sans-serif';
const MONO    = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

const CAT_COLOR: Record<string, string> = {
  SADE:    MUTED,
  ORTA:    BLUE,
  PREMIUM: AMBER,
};
const CAT_BG: Record<string, string> = {
  SADE:    'rgba(100,116,139,0.12)',
  ORTA:    'rgba(59,130,246,0.12)',
  PREMIUM: 'rgba(245,158,11,0.12)',
};
const CAT_BORDER: Record<string, string> = {
  SADE:    'rgba(100,116,139,0.3)',
  ORTA:    'rgba(59,130,246,0.3)',
  PREMIUM: 'rgba(245,158,11,0.35)',
};

// ─── Tipler ───────────────────────────────────────────────────────────────────
interface Venue { id: string; name: string; category: string; address?: string; isActive: boolean; city: { id: string; name: string }; }
interface City  { id: string; name: string; }

const CATS = ['SADE', 'ORTA', 'PREMIUM'];

interface VenueForm { name: string; cityId: string; category: string; address: string; }
const EMPTY_FORM: VenueForm = { name: '', cityId: '', category: 'SADE', address: '' };

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#020c1b',
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: '7px 12px',
  fontSize: 12,
  color: TEXT,
  outline: 'none',
  fontFamily: SANS,
  boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 9, fontWeight: 800,
  letterSpacing: '0.14em',
  color: MUTED, marginBottom: 6,
  fontFamily: SANS,
};

// ─── Sayfa ────────────────────────────────────────────────────────────────────
export default function MekanlarPage() {
  const toast = useToast();
  const [venues, setVenues]   = useState<Venue[]>([]);
  const [cities, setCities]   = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState<{ edit?: Venue } | null>(null);
  const [form, setForm]       = useState<VenueForm>(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get<Venue[]>('/admin/venues'), api.get<City[]>('/admin/cities')])
      .then(([v, c]) => { setVenues(v); setCities(c); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setModal({}); setForm(EMPTY_FORM); }
  function openEdit(v: Venue) {
    setModal({ edit: v });
    setForm({ name: v.name, cityId: v.city.id, category: v.category, address: v.address ?? '' });
  }

  function set<K extends keyof VenueForm>(k: K, v: VenueForm[K]) { setForm((p) => ({ ...p, [k]: v })); }

  async function handleSave() {
    if (!form.name || !form.cityId) { toast.error('Ad ve şehir zorunlu.'); return; }
    setSaving(true);
    try {
      if (modal?.edit) {
        await api.patch(`/admin/venues/${modal.edit.id}`, { name: form.name, category: form.category, address: form.address || undefined });
      } else {
        await api.post('/admin/venues', { name: form.name, cityId: form.cityId, category: form.category, address: form.address || undefined });
      }
      toast.success(modal?.edit ? 'Mekan güncellendi.' : 'Mekan oluşturuldu.');
      setModal(null); load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu mekanı silmek istiyor musunuz?')) return;
    try {
      await api.delete(`/admin/venues/${id}`);
      toast.success('Mekan silindi.'); load();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <AdminShell>
      <div style={{ fontFamily: SANS }}>

        {/* Başlık */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>
              Mekanlar
            </h1>
            {!loading && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: MUTED }}>
                {venues.length} mekan
              </p>
            )}
          </div>
          <button
            onClick={openCreate}
            style={{
              padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.35)',
              fontSize: 12, fontWeight: 600, color: BLUE,
              fontFamily: SANS,
            }}
          >
            + Yeni Mekan
          </button>
        </div>

        {/* Tablo kartı */}
        <div style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          {/* Kart başlığı */}
          <div style={{
            padding: '12px 18px',
            borderBottom: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 2, height: 12, borderRadius: 1, background: CYAN }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: CYAN }}>
              MEKAN LİSTESİ
            </span>
            {!loading && (
              <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>
                {venues.length} kayıt
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ height: 40, background: SURFACE, borderRadius: 6, opacity: 0.5 }} />
              ))}
            </div>
          ) : venues.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📍</div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>
                Henüz mekan eklenmedi
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO }}>
                Yeni Mekan butonuyla başlayın
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {['Ad', 'Şehir', 'Tür', 'Adres', 'Durum', ''].map((h) => (
                      <th key={h} style={{
                        textAlign: 'left',
                        padding: '0 14px 10px',
                        fontSize: 9, fontWeight: 800,
                        letterSpacing: '0.14em', color: MUTED,
                      }}>
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {venues.map((v, i) => (
                    <tr
                      key={v.id}
                      style={{ borderBottom: i < venues.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none' }}
                    >
                      <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: TEXT }}>
                        {v.name}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 11, color: MUTED }}>
                        {v.city.name}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                          padding: '2px 7px', borderRadius: 99,
                          background: CAT_BG[v.category] ?? 'transparent',
                          border: `1px solid ${CAT_BORDER[v.category] ?? BORDER}`,
                          color: CAT_COLOR[v.category] ?? MUTED,
                        }}>
                          {v.category}
                        </span>
                      </td>
                      <td style={{
                        padding: '11px 14px', fontSize: 11, color: MUTED,
                        maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {v.address ?? '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                          padding: '2px 7px', borderRadius: 99,
                          background: v.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.1)',
                          border: `1px solid ${v.isActive ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.25)'}`,
                          color: v.isActive ? GREEN : MUTED,
                        }}>
                          {v.isActive ? 'AKTİF' : 'PASİF'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => openEdit(v)}
                            style={{ background: 'none', border: 'none', fontSize: 11, color: CYAN, cursor: 'pointer', fontFamily: SANS }}
                          >
                            Düzenle
                          </button>
                          <button
                            onClick={() => handleDelete(v.id)}
                            style={{ background: 'none', border: 'none', fontSize: 11, color: MUTED, cursor: 'pointer', fontFamily: SANS }}
                          >
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.edit ? 'Mekanı Düzenle' : 'Yeni Mekan'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="AD" value={form.name} onChange={(v) => set('name', v)} />

          {!modal?.edit && (
            <div>
              <label style={labelStyle}>ŞEHİR</label>
              <select
                value={form.cityId}
                onChange={(e) => set('cityId', e.target.value)}
                style={inputStyle}
              >
                <option value="">Seç</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>TÜR</label>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              style={inputStyle}
            >
              {CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <FormField label="ADRES (OPSİYONEL)" value={form.address} onChange={(v) => set('address', v)} />

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%', padding: '10px',
              borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
              background: saving ? SURFACE : 'rgba(59,130,246,0.18)',
              border: `1px solid ${saving ? BORDER : 'rgba(59,130,246,0.4)'}`,
              color: saving ? MUTED : BLUE,
              fontSize: 13, fontWeight: 600,
              fontFamily: SANS,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Kaydediliyor…' : modal?.edit ? 'Güncelle' : 'Oluştur'}
          </button>
        </div>
      </Modal>
    </AdminShell>
  );
}

function FormField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 9, fontWeight: 800,
        letterSpacing: '0.14em', color: MUTED, marginBottom: 6,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          background: '#020c1b',
          border: '1px solid #1a3a5c',
          borderRadius: 8,
          padding: '7px 12px',
          fontSize: 12, color: '#e2e8f0',
          outline: 'none',
          fontFamily: 'Inter, system-ui, sans-serif',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
