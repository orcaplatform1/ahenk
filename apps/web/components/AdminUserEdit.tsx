'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { myRole } from '@/lib/adminRole';
import { OCCUPATION_SECTORS } from '@/lib/occupations';

const BG      = '#020c1b';
const SURFACE = '#0a1628';
const BORDER  = '#1a3a5c';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const RED     = '#ef4444';
const CYAN    = '#22d3ee';
const SANS    = 'Inter, system-ui, sans-serif';

const inputStyle: React.CSSProperties = {
  width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
  padding: '7px 10px', fontSize: 12, color: TEXT, outline: 'none', fontFamily: SANS, boxSizing: 'border-box',
};

export interface EditableUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  occupationSector?: string | null;
  profile: { firstName?: string | null; lastName?: string | null; gender?: string | null; birthDate?: string | null; primaryCity?: string | null } | null;
}

interface City { id: string; name: string; isActive: boolean }

function initial(u: EditableUser) {
  return {
    firstName: u.profile?.firstName ?? '',
    lastName: u.profile?.lastName ?? '',
    gender: u.profile?.gender ?? '',
    birthDate: u.profile?.birthDate ? u.profile.birthDate.slice(0, 10) : '',
    phone: (u.phone ?? '').replace(/^\+90/, ''),
    cityId: u.profile?.primaryCity ?? '',
    occupationSector: u.occupationSector ?? '',
    email: u.email ?? '',
  };
}

// Admin kullanıcı penceresi: kişisel bilgi düzenleme (e-posta yalnızca SUPERADMIN)
export function AdminUserEdit({ user, canEdit, onSaved }: {
  user: EditableUser;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => initial(user));
  const [cities, setCities] = useState<City[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isSuperadmin = myRole() === 'SUPERADMIN';

  useEffect(() => { setForm(initial(user)); }, [user]);
  useEffect(() => {
    if (!open || cities.length) return;
    api.get<City[]>('/admin/cities').then(c => setCities(c.filter(x => x.isActive)))
      .catch((e: Error) => setError(`Şehirler yüklenemedi: ${e.message}`));
  }, [open, cities.length]);

  if (!canEdit) return null;

  const set = (k: keyof ReturnType<typeof initial>, v: string) => setForm(f => ({ ...f, [k]: v }));
  const phoneValid = form.phone === '' || (form.phone.length === 10 && form.phone.startsWith('5'));

  async function save() {
    const before = initial(user);
    // Sadece değişen alanlar gönderilir
    const body: Record<string, string> = {};
    if (form.firstName.trim() !== before.firstName) body.firstName = form.firstName.trim();
    if (form.lastName.trim() !== before.lastName) body.lastName = form.lastName.trim();
    if (form.gender !== before.gender && form.gender) body.gender = form.gender;
    if (form.birthDate !== before.birthDate && form.birthDate) body.birthDate = form.birthDate;
    if (form.phone !== before.phone && form.phone) body.phone = `+90${form.phone}`;
    if (form.cityId !== before.cityId && form.cityId) body.cityId = form.cityId;
    if (form.occupationSector !== before.occupationSector && form.occupationSector) body.occupationSector = form.occupationSector;
    if (isSuperadmin && form.email.trim() !== before.email && form.email.trim()) body.email = form.email.trim();
    if (!Object.keys(body).length) { setOpen(false); return; }

    setSaving(true);
    setError('');
    try {
      await api.patch(`/admin/users/${user.id}/profile`, body);
      setOpen(false);
      onSaved();
    } catch (e) {
      setError(`Kaydedilemedi: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => { setForm(initial(user)); setError(''); setOpen(true); }}
        style={{
          alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
          background: 'rgba(34,211,238,0.08)', color: CYAN, border: '1px solid rgba(34,211,238,0.3)',
          fontSize: 11, fontWeight: 600, fontFamily: SANS,
        }}
      >
        Bilgileri Düzenle
      </button>
    );
  }

  return (
    <div style={{ padding: 12, borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: CYAN }}>BİLGİLERİ DÜZENLE</span>
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
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ ...inputStyle, width: 'auto', color: MUTED, flexShrink: 0 }}>+90</div>
        <input
          type="tel" inputMode="numeric" value={form.phone}
          onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="5XX XXX XX XX" style={inputStyle}
        />
      </div>
      <select value={form.cityId} onChange={e => set('cityId', e.target.value)} style={inputStyle}>
        <option value="">Katılım şehri</option>
        {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select value={form.occupationSector} onChange={e => set('occupationSector', e.target.value)} style={inputStyle}>
        <option value="">Meslek alanı</option>
        {OCCUPATION_SECTORS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {isSuperadmin && (
        <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="E-posta" style={inputStyle} />
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={save} disabled={saving || !phoneValid}
          style={{
            flex: 1, padding: '7px', borderRadius: 8, cursor: saving || !phoneValid ? 'not-allowed' : 'pointer',
            background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)',
            fontSize: 11, fontWeight: 700, color: CYAN, fontFamily: SANS, opacity: saving || !phoneValid ? 0.5 : 1,
          }}
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button
          onClick={() => setOpen(false)} disabled={saving}
          style={{
            flex: 1, padding: '7px', borderRadius: 8, cursor: 'pointer', background: 'transparent',
            border: `1px solid ${BORDER}`, fontSize: 11, color: MUTED, fontFamily: SANS,
          }}
        >
          Vazgeç
        </button>
      </div>
      {!phoneValid && <p style={{ margin: 0, fontSize: 11, color: RED }}>Telefon 5 ile başlayan 10 hane olmalı.</p>}
      {error && <p style={{ margin: 0, fontSize: 11, color: RED }}>{error}</p>}
    </div>
  );
}
