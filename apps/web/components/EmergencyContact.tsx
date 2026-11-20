'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { splitE164, toE164 } from '@ahenk/shared';
import { api } from '@/lib/api';
import { CountryCodeButton } from '@/components/PhoneCountryField';

// Profilim → Gizlilik ve Güvenlik: Acil Durum Kişisi (en fazla 1; ad + telefon, giriş / kayıttaki ülke kodu listesi).
// Düzenlenebilir ve silinebilir. Acil Yardım talebinde bu kişiye WhatsApp üzerinden otomatik bilgi gider (mobil components/EmergencyContact.tsx).
export function EmergencyContact() {
  const t = useTranslations();
  const [contact, setContact] = useState<{ name: string; phone: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('TR');
  const [national, setNational] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<{ name: string; phone: string } | null>('/users/me/emergency-contact').then((c) => setContact(c ?? null)).catch(() => {});
  }, []);

  function startEdit() {
    const sp = splitE164(contact?.phone);
    setName(contact?.name ?? ''); setCountry(sp.country); setNational(sp.national); setError(''); setEditing(true);
  }
  async function save() {
    const phone = toE164(country, national);
    if (!name.trim()) { setError(t('emergency.nameRequired')); return; }
    if (!phone) { setError(t('phone.invalid')); return; }
    setBusy(true); setError('');
    try { setContact(await api.put<{ name: string; phone: string }>('/users/me/emergency-contact', { name: name.trim(), phone })); setEditing(false); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError('');
    try { await api.delete('/users/me/emergency-contact'); setContact(null); setEditing(false); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 4 }}>
      <span style={{ fontSize: 14, color: '#f4f1ec' }}>{t('emergency.title')}</span>
      {!editing && contact && (
        <div className="flex items-center justify-between gap-2">
          <span style={{ fontSize: 13, color: '#c9c2b8' }}>{contact.name} · {contact.phone}</span>
          <span className="flex gap-2">
            <button type="button" className="btn-ghost" style={{ minHeight: 44 }} onClick={startEdit}>{t('emergency.edit')}</button>
            <button type="button" className="btn-ghost" style={{ minHeight: 44 }} onClick={() => void remove()} disabled={busy}>{t('emergency.delete')}</button>
          </span>
        </div>
      )}
      {!editing && !contact && (
        <button type="button" className="btn-ghost self-start" style={{ minHeight: 44 }} onClick={startEdit}>{t('emergency.add')}</button>
      )}
      {editing && (
        <div className="flex flex-col gap-2">
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder={t('emergency.name')} className="input-glass px-4 py-3 text-sm" />
          <div className="flex gap-2">
            <CountryCodeButton country={country} onChange={(c) => { setCountry(c); setError(''); }} />
            <input type="tel" value={national} onChange={(e) => { setNational(e.target.value.replace(/\D/g, '').slice(0, 15)); setError(''); }}
              placeholder={country === 'TR' ? '5XX XXX XX XX' : ''} className="input-glass flex-1 px-4 py-3 text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" style={{ minHeight: 44 }} onClick={() => void save()} disabled={busy}>{busy ? '…' : t('common.save')}</button>
            <button type="button" className="btn-ghost" style={{ minHeight: 44 }} onClick={() => setEditing(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
      {error && <p className="text-[#ff6b6b] text-xs" style={{ margin: 0 }}>{error}</p>}
      <p style={{ margin: 0, fontSize: 12, color: '#a39c93', lineHeight: 1.5 }}>{t('emergency.note')}</p>
    </div>
  );
}
