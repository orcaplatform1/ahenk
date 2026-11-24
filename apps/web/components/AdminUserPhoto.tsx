'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AMBER, BORDER, MUTED, RED, SANS, TEXT } from '@/lib/adminTheme';
import { StdButton } from '@ahenk/ui';

// Yönetim paneli: kullanıcı profil fotoğrafı. Basınca tam ekran büyük görünüm; büyük görünümde "Sil" → onay penceresi.
// Önceki fotoğraf ihlali yoksa onaylanınca fotoğraf silinir, kullanıcıya uyarı push'u gider (ihlal uyarı olarak kaydedilir);
// varsa askı süresi (3 gün / 15 gün / 1 ay) seçilir ve Askıya al şablonu gider (backend admin-moderation.ts).
export function AdminUserPhoto({ userId, photoUrl, size = 72, gender, initials, onDeleted }: {
  userId: string; photoUrl?: string | null; size?: number; gender?: string | null; initials: string; onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ prior: number } | null>(null);
  const [days, setDays] = useState<3 | 15 | 30 | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const border = gender === 'FEMALE' ? '#f48fb1' : '#4fc3f7';

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (confirm) setConfirm(null); else setOpen(false); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, confirm]);

  async function askDelete() {
    setError(''); setDays(null);
    try {
      const r = await api.get<{ count: number }>(`/admin/users/${userId}/photo-violations`);
      setConfirm({ prior: r.count });
    } catch (e) { setError((e as Error).message); }
  }

  async function doDelete() {
    if (!confirm || (confirm.prior > 0 && !days)) return;
    setBusy(true); setError('');
    try {
      await api.post(`/admin/users/${userId}/profile-photo/delete`, confirm.prior > 0 ? { suspendDays: days } : {});
      setConfirm(null); setOpen(false);
      onDeleted?.();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const circle = (
    <div style={{ width: size, height: size, borderRadius: '50%', border: `${size >= 48 ? 3 : 1.5}px solid ${border}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }}>
      {photoUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={photoUrl} alt="Profil fotoğrafı" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <span style={{ fontSize: Math.round(size * 0.3), fontWeight: 700, color: TEXT }}>{initials}</span>}
    </div>
  );
  if (!photoUrl) return circle;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Fotoğrafı büyüt" style={{ background: 'none', border: 'none', padding: 0, cursor: 'zoom-in', flexShrink: 0 }}>{circle}</button>
      {open && (
        <div role="dialog" aria-label="Profil fotoğrafı" onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20, fontFamily: SANS }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="Profil fotoğrafı" style={{ maxWidth: '92vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 12 }} />
          <button type="button" onClick={(e) => { e.stopPropagation(); void askDelete(); }}
            style={{ minHeight: 44, padding: '0 28px', borderRadius: 10, background: 'rgba(239,68,68,0.15)', border: `1px solid ${RED}`, color: RED, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
            Sil
          </button>
          {error && !confirm && <p style={{ margin: 0, fontSize: 12, color: RED }}>{error}</p>}
          {confirm && (
            <div onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true"
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <div className="ll-card" style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>Fotoğraf silinsin mi?</p>
                <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
                  {confirm.prior === 0
                    ? 'Fotoğraf sunucudan silinir; kullanıcıya "Topluluk kurallarımıza aykırı olan uygunsuz fotoğrafınız kaldırılmıştır." bildirimi gider ve ihlal uyarı olarak kaydedilir.'
                    : `Kullanıcının önceki fotoğraf ihlali var (${confirm.prior}). Fotoğraf silinir ve hesap seçilen süre boyunca askıya alınır.`}
                </p>
                {confirm.prior > 0 && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([3, 15, 30] as const).map((d) => (
                      <button key={d} type="button" onClick={() => setDays(d)} aria-pressed={days === d}
                        style={{ flex: 1, minHeight: 40, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: SANS,
                          background: days === d ? 'rgba(245,158,11,0.15)' : 'transparent', border: `1px solid ${days === d ? AMBER : BORDER}`, color: days === d ? AMBER : TEXT }}>
                        {d === 30 ? '1 ay' : `${d} gün`}
                      </button>
                    ))}
                  </div>
                )}
                {error && <p style={{ margin: 0, fontSize: 12, color: RED }}>{error}</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <StdButton variant="ghost" type="button" onClick={() => setConfirm(null)} className="flex-1 justify-center">Vazgeç</StdButton>
                  <button type="button" onClick={() => void doDelete()} disabled={busy || (confirm.prior > 0 && !days)}
                    style={{ flex: 1, minHeight: 40, borderRadius: 8, cursor: 'pointer', background: RED, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, opacity: busy || (confirm.prior > 0 && !days) ? 0.5 : 1, fontFamily: SANS }}>
                    {busy ? '…' : 'Onayla'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
