'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { OCCUPATION_SECTORS } from '@/lib/occupations';

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
  width: '100%', background: BG,
  border: `1px solid ${BORDER}`, borderRadius: 8,
  padding: '7px 12px', fontSize: 12, color: TEXT,
  outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
};

interface Ocean { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number }

interface Bot {
  id: string;
  status: string;
  botPhone?: string | null;
  occupationSector?: string;
  profile?: { firstName?: string | null; lastName?: string | null; gender?: string | null; birthDate?: string | null; primaryCity?: string | null } | null;
  oceanScore?: Ocean | null;
}

interface City { id: string; name: string; isActive: boolean }

const OCEAN_FIELDS: { key: keyof Ocean; label: string }[] = [
  { key: 'openness', label: 'Açıklık' },
  { key: 'conscientiousness', label: 'Sorumluluk' },
  { key: 'extraversion', label: 'Dışadönüklük' },
  { key: 'agreeableness', label: 'Uyumluluk' },
  { key: 'neuroticism', label: 'Duygusal Denge' },
];

const EMPTY_FORM = {
  firstName: '', lastName: '', gender: '', occupationSector: '', birthDate: '', phone: '', cityId: '',
  openness: '50', conscientiousness: '50', extraversion: '50', agreeableness: '50', neuroticism: '50',
};
type BotForm = typeof EMPTY_FORM;

function ageOf(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

export default function AdminBots() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Bot | null>(null);
  const [form, setForm] = useState<BotForm>(EMPTY_FORM);
  const [cities, setCities] = useState<City[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');

  function load() {
    api.get<Bot[]>('/matching/admin/bots').then(setBots)
      .catch((e: Error) => setError(`Botlar yüklenemedi: ${e.message}`))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    api.get<City[]>('/admin/cities').then(c => setCities(c.filter(x => x.isActive)))
      .catch((e: Error) => setError(`Şehirler yüklenemedi: ${e.message}`));
  }, []);

  const cityName = (id?: string | null) => cities.find(c => c.id === id)?.name ?? '—';

  function openAdd() { setForm(EMPTY_FORM); setModalError(''); setModal('add'); }
  function openEdit(b: Bot) {
    setEditing(b);
    const o = b.oceanScore;
    setForm({
      firstName: b.profile?.firstName ?? '',
      lastName: b.profile?.lastName ?? '',
      gender: b.profile?.gender ?? '',
      occupationSector: b.occupationSector ?? '',
      birthDate: b.profile?.birthDate ? b.profile.birthDate.slice(0, 10) : '',
      phone: (b.botPhone ?? '').replace(/^\+90/, ''),
      cityId: b.profile?.primaryCity ?? '',
      openness: String(o?.openness ?? 50),
      conscientiousness: String(o?.conscientiousness ?? 50),
      extraversion: String(o?.extraversion ?? 50),
      agreeableness: String(o?.agreeableness ?? 50),
      neuroticism: String(o?.neuroticism ?? 50),
    });
    setModalError('');
    setModal('edit');
  }

  const set = (k: keyof BotForm, v: string) => setForm(f => ({ ...f, [k]: v }));
  const oceanValid = OCEAN_FIELDS.every(({ key }) => form[key] !== '' && Number(form[key]) >= 0 && Number(form[key]) <= 100);
  const formValid = !!form.firstName && !!form.lastName && !!form.gender && !!form.occupationSector && !!form.birthDate
    && form.phone.length === 10 && form.phone.startsWith('5') && !!form.cityId && oceanValid;

  async function save() {
    setSaving(true);
    setModalError('');
    const body = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      gender: form.gender,
      occupationSector: form.occupationSector,
      birthDate: form.birthDate,
      phone: `+90${form.phone}`,
      cityId: form.cityId,
      openness: Number(form.openness),
      conscientiousness: Number(form.conscientiousness),
      extraversion: Number(form.extraversion),
      agreeableness: Number(form.agreeableness),
      neuroticism: Number(form.neuroticism),
    };
    try {
      if (modal === 'add') {
        await api.post('/matching/admin/bots', body);
      } else if (editing) {
        await api.patch(`/matching/admin/bots/${editing.id}`, body);
      }
      setModal(null);
      load();
    } catch (e) {
      setModalError(`Kaydedilemedi: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(b: Bot) {
    const active = b.status === 'ACTIVE';
    setError('');
    try {
      await api.patch(`/matching/admin/bots/${b.id}/status`, { active: !active });
    } catch (e) {
      setError(`Güncellenemedi: ${(e as Error).message}`);
    }
    load();
  }

  async function deleteBot(id: string) {
    if (!confirm('Botu sil?')) return;
    setError('');
    try {
      await api.delete(`/matching/admin/bots/${id}`);
    } catch (e) {
      setError(`Silinemedi: ${(e as Error).message}`);
    }
    load();
  }

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>
          Bot Yönetimi
        </h1>
        <button
          onClick={openAdd}
          style={{
            padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(34,211,238,0.1)', border: `1px solid rgba(34,211,238,0.3)`,
            fontSize: 12, fontWeight: 600, color: CYAN, fontFamily: SANS,
          }}
        >
          + Bot Ekle
        </button>
      </div>

      {error && <p style={{ margin: '0 0 16px', fontSize: 12, color: RED }}>{error}</p>}

      {loading ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 2, height: 12, borderRadius: 1, background: CYAN }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: CYAN }}>BOTLAR</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 48, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 2, height: 12, borderRadius: 1, background: CYAN }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: CYAN }}>BOTLAR</span>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>
              {bots.length} kayıt
            </span>
          </div>

          {bots.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>Bot yok</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO }}>Yeni bot eklemek için + Bot Ekle butonunu kullan</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {bots.map((b, i) => {
                const active = b.status === 'ACTIVE';
                const firstName = b.profile?.firstName ?? '';
                const lastName = b.profile?.lastName ?? '';
                return (
                  <div
                    key={b.id}
                    style={{
                      padding: '12px 18px',
                      borderBottom: i < bots.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{firstName} {lastName}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                          padding: '2px 7px', borderRadius: 99,
                          background: active ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
                          border: `1px solid ${active ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.25)'}`,
                          color: active ? GREEN : MUTED,
                        }}>
                          {active ? 'AKTİF' : 'PASİF'}
                        </span>
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: 10, color: MUTED }}>
                        {b.profile?.gender === 'MALE' ? 'Erkek' : b.profile?.gender === 'FEMALE' ? 'Kadın' : '—'}
                        {' · '}{ageOf(b.profile?.birthDate) ?? '—'} yaş
                        {' · '}{cityName(b.profile?.primaryCity)}
                        {' · '}{b.occupationSector || '—'}
                        {b.botPhone ? ` · ${b.botPhone}` : ''}
                      </p>
                      {b.oceanScore && (
                        <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>
                          {OCEAN_FIELDS.map(({ key, label }) => `${label[0]}${Math.round(b.oceanScore![key])}`).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => toggleStatus(b)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                          background: active ? 'rgba(100,116,139,0.1)' : 'rgba(34,197,94,0.1)',
                          border: `1px solid ${active ? 'rgba(100,116,139,0.25)' : 'rgba(34,197,94,0.3)'}`,
                          fontSize: 10, color: active ? MUTED : GREEN, fontFamily: SANS,
                        }}
                      >
                        {active ? 'Pasifleştir' : 'Aktifleştir'}
                      </button>
                      <button
                        onClick={() => openEdit(b)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                          background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                          fontSize: 10, color: '#93c5fd', fontFamily: SANS,
                        }}
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => deleteBot(b.id)}
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
                );
              })}
            </div>
          )}
        </div>
      )}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>
                {modal === 'add' ? 'Yeni Bot' : 'Botu Düzenle'}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: MUTED, padding: 4 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Ad" style={inputStyle} />
                <input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Soyad" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={form.gender} onChange={e => set('gender', e.target.value)} style={inputStyle}>
                  <option value="">Cinsiyet</option>
                  <option value="MALE">Erkek</option>
                  <option value="FEMALE">Kadın</option>
                </select>
                <input type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)} style={inputStyle} title="Doğum tarihi" />
              </div>
              <select value={form.occupationSector} onChange={e => set('occupationSector', e.target.value)} style={inputStyle}>
                <option value="">Meslek alanı</option>
                {OCCUPATION_SECTORS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ ...inputStyle, width: 'auto', color: MUTED, flexShrink: 0 }}>+90</div>
                <input
                  type="tel" inputMode="numeric" value={form.phone}
                  onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="5XX XXX XX XX" style={inputStyle}
                />
              </div>
              <select value={form.cityId} onChange={e => set('cityId', e.target.value)} style={inputStyle}>
                <option value="">Şehir</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p style={{ margin: '4px 0 0', fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>KİŞİLİK TESTİ SKORLARI (0-100)</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {OCEAN_FIELDS.map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 9, color: MUTED }}>
                    {label}
                    <input
                      type="number" min={0} max={100} value={form[key]}
                      onChange={e => set(key, e.target.value)}
                      style={{ ...inputStyle, padding: '6px 6px', textAlign: 'center' }}
                    />
                  </label>
                ))}
              </div>
              <button
                onClick={save}
                disabled={saving || !formValid}
                style={{
                  width: '100%', padding: '9px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
                  background: 'rgba(34,211,238,0.1)', border: `1px solid rgba(34,211,238,0.3)`,
                  fontSize: 12, fontWeight: 700, color: CYAN, fontFamily: SANS,
                  opacity: saving || !formValid ? 0.5 : 1,
                }}
              >
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              {modalError && <p style={{ margin: '8px 0 0', fontSize: 12, color: RED }}>{modalError}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
