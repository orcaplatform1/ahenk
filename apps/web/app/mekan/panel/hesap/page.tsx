'use client';

import { useState } from 'react';
import { VenueAuthError, venueApi } from '@/lib/venueApi';
import { panelCard, useVenuePanel } from '../context';

export default function HesapPage() {
  const { me, onAuthLost } = useVenuePanel();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwMessage, setPwMessage] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [delPassword, setDelPassword] = useState('');
  const [delError, setDelError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(''); setPwError('');
    if (pw.next.length < 6 || pw.next.length > 20) { setPwError('Şifre 6-20 karakter arasında olmalı.'); return; }
    if (pw.next !== pw.confirm) { setPwError('Şifreler eşleşmiyor.'); return; }
    setPwSaving(true);
    try {
      await venueApi.post('/change-password', { currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: '', next: '', confirm: '' });
      setPwMessage('Şifreniz güncellendi.');
    } catch (err) {
      if (err instanceof VenueAuthError) onAuthLost();
      else setPwError((err as Error).message);
    } finally { setPwSaving(false); }
  }

  async function deactivate(e: React.FormEvent) {
    e.preventDefault();
    setDeleting(true); setDelError('');
    try {
      await venueApi.post('/deactivate', { password: delPassword });
      onAuthLost();
    } catch (err) {
      if (err instanceof VenueAuthError) onAuthLost();
      else { setDelError((err as Error).message); setDeleting(false); }
    }
  }

  const input = 'input-glass w-full px-4 py-3 text-sm';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 className="font-serif" style={{ fontSize: '1.6rem', margin: 0 }}>Hesap</h1>
      <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>{me.email}</p>

      <form onSubmit={changePassword} style={{ ...panelCard, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Şifre Değiştir</h2>
        <input className={input} type="password" autoComplete="current-password" aria-label="Mevcut şifre" placeholder="Mevcut şifre" maxLength={20} required value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
        <input className={input} type="password" autoComplete="new-password" aria-label="Yeni şifre" placeholder="Yeni şifre (6-20 karakter)" maxLength={20} required value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
        <input className={input} type="password" autoComplete="new-password" aria-label="Yeni şifre tekrar" placeholder="Yeni şifre tekrar" maxLength={20} required value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
        {pwError && <p style={{ color: '#ff6b6b', fontSize: '0.8rem', margin: 0 }}>{pwError}</p>}
        {pwMessage && <p style={{ color: '#4ade80', fontSize: '0.8rem', margin: 0 }}>{pwMessage}</p>}
        <button type="submit" disabled={pwSaving} className="btn-primary w-full justify-center disabled:opacity-70">{pwSaving ? 'Kaydediliyor…' : 'Şifreyi Güncelle'}</button>
      </form>

      <section style={{ ...panelCard, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Hesabı Sil</h2>
        <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>Hesabınız kapatılır, mekânınız masa atamalarından çıkar ve panele tekrar giriş yapamazsınız.</p>
        {!confirming ? (
          <button type="button" onClick={() => setConfirming(true)} style={{ minHeight: 44, borderRadius: 10, border: '1px solid rgba(192,57,43,0.5)', background: 'transparent', color: '#ff6b6b', fontSize: '0.9rem', cursor: 'pointer' }}>Hesabı Sil</button>
        ) : (
          <form onSubmit={deactivate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className={input} type="password" autoComplete="current-password" aria-label="Onay için şifre" placeholder="Onaylamak için şifreniz" maxLength={20} required value={delPassword} onChange={(e) => setDelPassword(e.target.value)} />
            {delError && <p style={{ color: '#ff6b6b', fontSize: '0.8rem', margin: 0 }}>{delError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { setConfirming(false); setDelPassword(''); setDelError(''); }} style={{ flex: 1, minHeight: 44, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#aaa', cursor: 'pointer' }}>Vazgeç</button>
              <button type="submit" disabled={deleting} style={{ flex: 1, minHeight: 44, borderRadius: 10, border: 'none', background: '#c0392b', color: '#fff', cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}>{deleting ? '…' : 'Hesabı Kapat'}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
