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
const BLUE    = '#3b82f6';
const CYAN    = '#22d3ee';
const SANS    = 'Inter, system-ui, sans-serif';
const MONO    = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

const TOPICS_LIST = ['Teknoloji','Sanat','Spor','Seyahat','Müzik','Sinema','Edebiyat','Gastronomi','Girişimcilik','Bilim'];

// ─── Tipler ───────────────────────────────────────────────────────────────────
interface Bot {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  profile?: { gender?: string; primaryCity?: { name: string } };
  oceanScore?: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number };
}

interface City { id: string; name: string; }

interface BotForm {
  firstName: string; lastName: string; gender: string; cityId: string;
  openness: string; conscientiousness: string; extraversion: string; agreeableness: string; neuroticism: string;
  topics: string[];
}

const EMPTY: BotForm = { firstName: '', lastName: '', gender: 'MALE', cityId: '', openness: '50', conscientiousness: '50', extraversion: '50', agreeableness: '50', neuroticism: '50', topics: [] };

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#020c1b',
  border: '1px solid #1a3a5c', borderRadius: 8,
  padding: '7px 12px', fontSize: 12, color: '#e2e8f0',
  outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
  boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 9, fontWeight: 800,
  letterSpacing: '0.14em', color: '#64748b',
  marginBottom: 6, fontFamily: 'Inter, system-ui, sans-serif',
};

// ─── Sayfa ────────────────────────────────────────────────────────────────────
export default function BotlarPage() {
  const toast = useToast();
  const [bots, setBots]       = useState<Bot[]>([]);
  const [cities, setCities]   = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState<BotForm>(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [toggling, setToggling] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<Bot[]>('/matching/admin/bots'),
      api.get<City[]>('/admin/cities'),
    ]).then(([b, c]) => { setBots(b); setCities(c); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function set<K extends keyof BotForm>(k: K, v: BotForm[K]) { setForm((p) => ({ ...p, [k]: v })); }

  async function handleCreate() {
    if (!form.firstName || !form.lastName || !form.cityId) { toast.error('Ad, soyad ve şehir zorunlu.'); return; }
    setSaving(true);
    try {
      await api.post('/matching/admin/bots', {
        firstName: form.firstName, lastName: form.lastName,
        gender: form.gender, primaryCityId: form.cityId,
        oceanScore: {
          openness: Number(form.openness), conscientiousness: Number(form.conscientiousness),
          extraversion: Number(form.extraversion), agreeableness: Number(form.agreeableness),
          neuroticism: Number(form.neuroticism),
        },
        topics: form.topics,
      });
      toast.success('Bot oluşturuldu.');
      setModal(false); setForm(EMPTY); load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  async function toggleStatus(bot: Bot) {
    setToggling(bot.id);
    try {
      await api.patch(`/matching/admin/bots/${bot.id}/status`, { isActive: !bot.isActive });
      toast.success(bot.isActive ? 'Bot pasife alındı.' : 'Bot aktif edildi.');
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setToggling(''); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu botu silmek istiyor musunuz?')) return;
    try {
      await api.delete(`/matching/admin/bots/${id}`);
      toast.success('Bot silindi.'); load();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <AdminShell>
      <div style={{ fontFamily: SANS }}>

        {/* Başlık */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>
              Botlar
            </h1>
            {!loading && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: MUTED }}>
                {bots.length} bot
              </p>
            )}
          </div>
          <button
            onClick={() => { setModal(true); setForm(EMPTY); }}
            style={{
              padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.35)',
              fontSize: 12, fontWeight: 600, color: BLUE, fontFamily: SANS,
            }}
          >
            + Yeni Bot
          </button>
        </div>

        {/* Tablo kartı */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>

          {/* Kart başlığı */}
          <div style={{
            padding: '12px 18px', borderBottom: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 2, height: 12, borderRadius: 1, background: CYAN }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: CYAN }}>
              BOT LİSTESİ
            </span>
            {!loading && (
              <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>
                {bots.filter(b => b.isActive).length} aktif · {bots.filter(b => !b.isActive).length} pasif
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ height: 40, background: SURFACE, borderRadius: 6, opacity: 0.5 }} />
              ))}
            </div>
          ) : bots.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🤖</div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>
                Henüz bot eklenmedi
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO }}>
                Yeni Bot butonuyla başlayın
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {['Ad Soyad', 'Cinsiyet', 'Şehir', 'Durum', ''].map((h) => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '0 14px 10px',
                        fontSize: 9, fontWeight: 800,
                        letterSpacing: '0.14em', color: MUTED,
                      }}>
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bots.map((b, i) => (
                    <tr key={b.id} style={{ borderBottom: i < bots.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none' }}>
                      <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 600, color: TEXT }}>
                        {b.firstName} {b.lastName}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 11, color: MUTED }}>
                        {b.profile?.gender === 'MALE' ? 'Erkek' : 'Kadın'}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 11, color: MUTED }}>
                        {b.profile?.primaryCity?.name ?? '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <button
                          onClick={() => toggleStatus(b)}
                          disabled={toggling === b.id}
                          style={{
                            padding: '3px 10px', borderRadius: 99, cursor: toggling === b.id ? 'not-allowed' : 'pointer',
                            background: b.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.1)',
                            border: `1px solid ${b.isActive ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.25)'}`,
                            fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                            color: b.isActive ? GREEN : MUTED,
                            fontFamily: SANS,
                            opacity: toggling === b.id ? 0.5 : 1,
                          }}
                        >
                          {toggling === b.id ? '…' : b.isActive ? 'AKTİF' : 'PASİF'}
                        </button>
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleDelete(b.id)}
                          style={{ background: 'none', border: 'none', fontSize: 11, color: MUTED, cursor: 'pointer', fontFamily: SANS }}
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Yeni Bot Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Yeni Bot">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Ad / Soyad */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <BotField label="AD" value={form.firstName} onChange={(v) => set('firstName', v)} />
            <BotField label="SOYAD" value={form.lastName} onChange={(v) => set('lastName', v)} />
          </div>

          {/* Cinsiyet */}
          <div>
            <label style={labelStyle}>CİNSİYET</label>
            <select value={form.gender} onChange={(e) => set('gender', e.target.value)} style={inputStyle}>
              <option value="MALE">Erkek</option>
              <option value="FEMALE">Kadın</option>
            </select>
          </div>

          {/* Şehir */}
          <div>
            <label style={labelStyle}>ŞEHİR</label>
            <select value={form.cityId} onChange={(e) => set('cityId', e.target.value)} style={inputStyle}>
              <option value="">Seç</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* OCEAN */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 2, height: 10, borderRadius: 1, background: CYAN }} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: CYAN }}>
                OCEAN SKORLARI (0–100)
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {(['openness','conscientiousness','extraversion','agreeableness','neuroticism'] as const).map((k) => (
                <div key={k}>
                  <label style={{ ...labelStyle, letterSpacing: '0.1em' }}>
                    {k.slice(0, 3).toUpperCase()}
                  </label>
                  <input
                    type="number" min={0} max={100}
                    value={form[k]}
                    onChange={(e) => set(k, e.target.value)}
                    style={{ ...inputStyle, padding: '6px 8px', textAlign: 'center' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Konu Tercihleri */}
          <div>
            <label style={labelStyle}>KONU TERCİHLERİ</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TOPICS_LIST.map((t) => {
                const selected = form.topics.includes(t);
                return (
                  <button
                    key={t} type="button"
                    onClick={() => set('topics', selected ? form.topics.filter((x) => x !== t) : [...form.topics, t])}
                    style={{
                      padding: '3px 10px', borderRadius: 99, cursor: 'pointer',
                      background: selected ? 'rgba(59,130,246,0.18)' : 'transparent',
                      border: `1px solid ${selected ? 'rgba(59,130,246,0.45)' : BORDER}`,
                      fontSize: 10, fontWeight: selected ? 600 : 400,
                      color: selected ? BLUE : MUTED,
                      fontFamily: SANS,
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Oluştur */}
          <button
            onClick={handleCreate}
            disabled={saving}
            style={{
              width: '100%', padding: '10px', borderRadius: 8,
              cursor: saving ? 'not-allowed' : 'pointer',
              background: saving ? SURFACE : 'rgba(59,130,246,0.18)',
              border: `1px solid ${saving ? BORDER : 'rgba(59,130,246,0.4)'}`,
              color: saving ? MUTED : BLUE,
              fontSize: 13, fontWeight: 600, fontFamily: SANS,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Kaydediliyor…' : 'Oluştur'}
          </button>
        </div>
      </Modal>
    </AdminShell>
  );
}

function BotField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 9, fontWeight: 800,
        letterSpacing: '0.14em', color: '#64748b',
        marginBottom: 6, fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', background: '#020c1b',
          border: '1px solid #1a3a5c', borderRadius: 8,
          padding: '7px 12px', fontSize: 12, color: '#e2e8f0',
          outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
