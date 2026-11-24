'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BORDER, MUTED, RED, SANS, TEXT, AMBER } from '@/lib/adminTheme';
import { AdminUserPhoto } from '@/components/AdminUserPhoto';
import { AdminSuspendButtons } from '@/components/AdminSuspendButtons';
import { StdButton } from '@ahenk/ui';

// GELMEDİ detayı (masa detayı): gelmeyenin fotoğrafı ve adı, bildirenler ve bildirim zamanı, önceki gelmedi uyarıları ve
// "Uyarı ver" (hazır şablon push). Önceki gelmedi uyarısı varsa "Uyarı ver" pasif, yalnız "Askıya al" (3 gün / 15 gün / 1 ay) aktif.
export function AdminNoShowDetail({ meetingId, user, reports, onClose }: {
  meetingId: string;
  user: { id: string; name: string; photoUrl: string | null; gender?: string | null };
  reports: { reporterName: string; createdAt: string }[];
  onClose: () => void;
}) {
  const [warnings, setWarnings] = useState<{ count: number; warnedMeetingIds: string[] } | null>(null);
  const [history, setHistory] = useState<{ reason: string; createdAt: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  function load() {
    api.get<{ noShowWarnings?: { count: number; warnedMeetingIds: string[] } }>(`/admin/users/${user.id}`).then((u) => setWarnings(u.noShowWarnings ?? { count: 0, warnedMeetingIds: [] })).catch((e: Error) => setError(e.message));
    api.get<{ type: string; reason: string; createdAt: string; meetingId?: string | null }[]>(`/admin/users/${user.id}/sanctions`)
      .then((s) => setHistory(s.filter((x) => x.type === 'WARNING' && x.meetingId))).catch(() => {});
  }
  useEffect(load, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (iso: string) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const hasWarning = (warnings?.count ?? 0) > 0;
  const warnedHere = warnings?.warnedMeetingIds.includes(meetingId);

  async function warn() {
    if (!confirm('Kullanıcıya gelmedi uyarısı verilsin mi? Hazır şablon bildirim gönderilir.')) return;
    setBusy(true); setError(''); setMsg('');
    try { await api.post(`/admin/users/${user.id}/no-show-warning`, { meetingId }); setMsg('Uyarı verildi.'); load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function suspend(days: 3 | 15 | 30) {
    if (!confirm(`Kullanıcı ${days === 30 ? '1 ay' : `${days} gün`} askıya alınsın mı?`)) return;
    setBusy(true); setError(''); setMsg('');
    try { await api.post(`/admin/users/${user.id}/sanction`, { type: 'SUSPENSION', days, reason: 'Masaya katılım sağlamama' }); setMsg('Askıya alındı.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: SANS }}>
      <div className="ll-card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AdminUserPhoto userId={user.id} photoUrl={user.photoUrl} gender={user.gender} size={56} initials={user.name.split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toLocaleUpperCase('tr-TR')} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT }}>{user.name}</p>
            <span style={{ display: 'inline-block', marginTop: 4, padding: '1px 8px', borderRadius: 99, background: RED, color: '#fff', fontSize: 10, fontWeight: 800 }}>GELMEDİ</span>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
          <p style={{ margin: '0 0 4px', fontSize: 11, color: MUTED }}>Bildirenler</p>
          {reports.map((r, i) => <p key={i} style={{ margin: 0, fontSize: 12, color: TEXT }}>{r.reporterName} · {fmt(r.createdAt)}</p>)}
        </div>
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
          <p style={{ margin: '0 0 4px', fontSize: 11, color: MUTED }}>Önceki gelmedi uyarıları ({warnings?.count ?? '…'})</p>
          {history.length === 0 ? <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Uyarı yok</p>
            : history.map((h, i) => <p key={i} style={{ margin: '0 0 4px', fontSize: 11, color: TEXT, lineHeight: 1.4 }}>{fmt(h.createdAt)}: {h.reason}</p>)}
        </div>
        <button type="button" onClick={() => void warn()} disabled={busy || hasWarning || warnedHere}
          style={{ minHeight: 40, borderRadius: 8, border: `1px solid ${AMBER}`, background: 'transparent', color: AMBER, fontSize: 12, fontWeight: 600, cursor: busy || hasWarning ? 'not-allowed' : 'pointer', opacity: busy || hasWarning || warnedHere ? 0.4 : 1, fontFamily: SANS }}>
          Uyarı ver
        </button>
        {hasWarning && (
          <>
            <p style={{ margin: 0, fontSize: 11, color: MUTED }}>Kullanıcının önceki gelmedi uyarısı var: yalnız askıya alınabilir.</p>
            <AdminSuspendButtons busy={busy} color={RED} onPick={(d) => void suspend(d)} />
          </>
        )}
        {msg && <p style={{ margin: 0, fontSize: 12, color: '#22c55e' }}>{msg}</p>}
        {error && <p style={{ margin: 0, fontSize: 12, color: RED }}>{error}</p>}
        <StdButton variant="ghost" type="button" onClick={onClose} className="justify-center">Kapat</StdButton>
      </div>
    </div>
  );
}
