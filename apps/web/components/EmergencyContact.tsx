'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { splitE164, toE164 } from '@ahenk/shared';
import { api } from '@/lib/api';
import { CountryCodeButton } from '@/components/PhoneCountryField';
import { StdButton } from '@ahenk/ui';

// Profilim → Gizlilik ve Güvenlik: Acil Durum Kişisi (en fazla 2; ad + telefon, giriş / kayıttaki ülke kodu listesi).
// Her kişi düzenlenebilir ve silinebilir (1. silinirse 2. kişi 1. sıraya geçer); 2 kişi kayıtlıyken "Kişi Ekle" gizli. Acil Yardım
// talebinde kayıtlı her kişiye WhatsApp üzerinden otomatik bilgi gider (mobil components/EmergencyContact.tsx).
type Contact = { slot: 1 | 2; name: string | null; phone: string };

export function EmergencyContact() {
  const t = useTranslations();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editing, setEditing] = useState<1 | 2 | null>(null); // Düzenlenen / eklenen kişinin sırası
  const [name, setName] = useState('');
  const [country, setCountry] = useState('TR');
  const [national, setNational] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Contact[]>('/users/me/emergency-contacts').then((c) => setContacts(Array.isArray(c) ? c : [])).catch(() => {});
  }, []);

  function startEdit(slot: 1 | 2) {
    const c = contacts.find((x) => x.slot === slot);
    const sp = splitE164(c?.phone);
    setName(c?.name ?? ''); setCountry(sp.country); setNational(sp.national); setError(''); setEditing(slot);
  }
  async function save() {
    if (!editing) return;
    const phone = toE164(country, national);
    if (!name.trim()) { setError(t('emergency.nameRequired')); return; }
    if (!phone) { setError(t('phone.invalid')); return; }
    setBusy(true); setError('');
    try { setContacts(await api.put<Contact[]>(`/users/me/emergency-contacts/${editing}`, { name: name.trim(), phone })); setEditing(null); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove(slot: 1 | 2) {
    setBusy(true); setError('');
    try { setContacts(await api.delete<Contact[]>(`/users/me/emergency-contacts/${slot}`)); setEditing(null); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const nextSlot: 1 | 2 | null = contacts.length >= 2 ? null : contacts.some((c) => c.slot === 1) ? 2 : 1;

  return (
    <div className="flex flex-col gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 4 }}>
      {/* Başlık satırı (Numara Engelleme satırıyla aynı hiza): solda başlık, 2 kişiden azsa sağında Kişi Ekle */}
      <div className="flex items-center justify-between gap-2" style={{ minHeight: 44 }}>
        <span style={{ fontSize: 14, color: '#f4f1ec' }}>{t('emergency.title')}</span>
        {!editing && nextSlot && (
          <StdButton variant="ghost" type="button" onClick={() => startEdit(nextSlot)}>{t('emergency.add')}</StdButton>
        )}
      </div>
      {!editing && contacts.map((c) => (
        <div key={c.slot} className="flex flex-wrap items-center justify-between gap-2">
          <span style={{ fontSize: 13, color: '#c9c2b8' }}>{c.name} · {c.phone}</span>
          <span className="flex flex-wrap gap-2">
            <StdButton variant="ghost" type="button" onClick={() => startEdit(c.slot)}>{t('emergency.edit')}</StdButton>
            <StdButton variant="ghost" type="button" onClick={() => void remove(c.slot)} disabled={busy}>{t('emergency.delete')}</StdButton>
          </span>
        </div>
      ))}
      {editing && (
        <div className="flex flex-col gap-2">
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder={t('emergency.name')} className="input-glass px-4 py-3 text-sm" />
          <div className="flex gap-2">
            <CountryCodeButton country={country} onChange={(c) => { setCountry(c); setError(''); }} />
            <input type="tel" value={national} onChange={(e) => { setNational(e.target.value.replace(/\D/g, '').slice(0, 15)); setError(''); }}
              placeholder={country === 'TR' ? '5XX XXX XX XX' : ''} className="input-glass flex-1 px-4 py-3 text-sm" />
          </div>
          <div className="flex flex-wrap gap-2">
            <StdButton variant="primary" type="button" onClick={() => void save()} disabled={busy}>{busy ? '…' : t('common.save')}</StdButton>
            <StdButton variant="ghost" type="button" onClick={() => setEditing(null)}>{t('common.cancel')}</StdButton>
          </div>
        </div>
      )}
      {error && <p className="text-[#ff6b6b] text-xs" style={{ margin: 0 }}>{error}</p>}
      <p style={{ margin: 0, fontSize: 12, color: '#a39c93', lineHeight: 1.5 }}>{t('emergency.note')}</p>
    </div>
  );
}
