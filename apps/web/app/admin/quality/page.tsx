'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SURFACE, BORDER, TEXT, MUTED, RED, AMBER, GREEN, SANS, MONO, LABEL } from '@/lib/adminTheme';
import { AdminUserPhoto } from '@/components/AdminUserPhoto';

// Şikâyetler: masa sohbeti mesaj şikâyetleri ve "Otomatik engel" kayıtları. Detayda şikâyet edilen mesaj işaretli olarak sohbetin
// tamamı, gönderenin önceki uyarıları ve karar butonları (Uyar / Masadan çıkar / Askıya al 3-15-30 gün). Daha önce uyarı almış
// kullanıcıda yalnız Masadan çıkar ve Askıya al aktif. Admin serbest mesaj yazamaz; kullanıcıya hazır şablon push gider.
interface ReportRow {
  id: string; createdAt: string; auto: boolean; reasonLabel: string | null; note: string | null;
  decision: string | null; decisionDays: number | null; meetingId: string; messageContent: string; blocked: boolean;
  senderId: string; senderName: string; reporterName: string | null;
}
interface ReportDetail {
  id: string; auto: boolean; reasonLabel: string | null; note: string | null; decision: string | null; decisionDays: number | null;
  senderId: string; senderName: string; senderPhotoUrl: string | null; hasWarning: boolean;
  warnings: { id: string; reason: string; createdAt: string }[];
  messages: { id: string; content: string; createdAt: string; senderId: string; senderName: string; senderGender: string | null; blocked: boolean; reportCount: number; highlighted: boolean }[];
}

const DECISION_TR: Record<string, string> = { WARN: 'Uyarıldı', REMOVE: 'Masadan çıkarıldı', SUSPEND: 'Askıya alındı' };
const fmt = (iso: string) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const initialsOf = (name: string) => name.split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toLocaleUpperCase('tr-TR') || '?';

export default function AdminQuality() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);

  function load() {
    api.get<ReportRow[]>('/admin/chat-reports').then(setRows)
      .catch((e: Error) => setError(`Şikayetler yüklenemedi: ${e.message}`))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function toggle(id: string) {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id); setDetail(null); setSuspendOpen(false); setError('');
    try { setDetail(await api.get<ReportDetail>(`/admin/chat-reports/${id}`)); }
    catch (e) { setError((e as Error).message); }
  }

  async function decide(action: 'WARN' | 'REMOVE' | 'SUSPEND', days?: number) {
    if (!detail) return;
    const label = action === 'WARN' ? 'uyarılsın' : action === 'REMOVE' ? 'masadan çıkarılsın' : `${days} gün askıya alınsın`;
    if (!confirm(`Kullanıcı ${label} mı? Kullanıcıya hazır şablon bildirim gönderilir.`)) return;
    setBusy(true); setError('');
    try {
      await api.post(`/admin/chat-reports/${detail.id}/decision`, { action, ...(days ? { days } : {}) });
      setDetail(await api.get<ReportDetail>(`/admin/chat-reports/${detail.id}`));
      setSuspendOpen(false);
      load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const btn = (color: string, disabled: boolean): React.CSSProperties => ({
    flex: 1, minHeight: 38, padding: '0 8px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: SANS,
    background: 'transparent', border: `1px solid ${color}`, color, opacity: disabled ? 0.4 : 1,
  });

  return (
    <div className="adm-page" style={{ maxWidth: 760, margin: '0 auto', fontFamily: SANS }}>
      <div style={{ marginBottom: 24 }}><h1 className="ll-title">Şikayetler</h1></div>
      {error && <p style={{ margin: '0 0 16px', fontSize: 13, color: RED }}>{error}</p>}

      <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 className="ll-title">Masa Sohbeti Şikayetleri</h2>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>{rows.length} kayıt</span>
        </div>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ height: 48, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />)}
          </div>
        ) : rows.length === 0 ? (
          <p style={{ margin: 0, padding: '40px 20px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: MUTED }}>Şikayet yok</p>
        ) : rows.map((r, i) => (
          <div key={r.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(26,58,92,0.5)' : 'none' }}>
            <button type="button" onClick={() => void toggle(r.id)} aria-expanded={openId === r.id}
              style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 18px', display: 'flex', gap: 12, alignItems: 'flex-start', fontFamily: SANS }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{r.senderName}</span>
                  <span style={{ ...LABEL, padding: '2px 7px', borderRadius: 99, border: `1px solid ${r.auto ? AMBER : RED}`, color: r.auto ? AMBER : RED }}>
                    {r.auto ? 'Otomatik engel' : 'Şikayet'}
                  </span>
                  {r.decision && <span style={{ ...LABEL, padding: '2px 7px', borderRadius: 99, border: `1px solid ${GREEN}`, color: GREEN }}>{DECISION_TR[r.decision]}{r.decisionDays ? ` (${r.decisionDays} gün)` : ''}</span>}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{r.messageContent}"</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: MUTED }}>
                  {[r.reasonLabel, r.note, r.reporterName ? `Şikayet eden: ${r.reporterName}` : null].filter(Boolean).join(' · ')}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>{fmt(r.createdAt)}</p>
              </div>
              <span style={{ color: MUTED, fontSize: 12 }}>{openId === r.id ? '▲' : '▼'}</span>
            </button>

            {openId === r.id && detail && (
              <div style={{ margin: '0 18px 14px', padding: 14, borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <AdminUserPhoto userId={detail.senderId} photoUrl={detail.senderPhotoUrl} size={48} initials={initialsOf(detail.senderName)}
                    onDeleted={() => setDetail(d => (d ? { ...d, senderPhotoUrl: null } : d))} />
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>{detail.senderName}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: MUTED }}>
                      {detail.warnings.length ? `Önceki uyarılar: ${detail.warnings.length}` : 'Önceki uyarı yok'}
                    </p>
                  </div>
                </div>
                {detail.warnings.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: MUTED }}>
                    {detail.warnings.map(w => <li key={w.id}>{fmt(w.createdAt)} — {w.reason}</li>)}
                  </ul>
                )}

                {/* Sohbetin tamamı; şikâyet edilen mesaj işaretli */}
                <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: 8, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                  {detail.messages.map(m => (
                    <div key={m.id} style={{ padding: '6px 8px', borderRadius: 8, background: m.highlighted ? 'rgba(239,68,68,0.12)' : 'transparent', border: `1px solid ${m.highlighted ? RED : 'transparent'}` }}>
                      <p style={{ margin: 0, fontSize: 11, color: m.senderGender === 'FEMALE' ? '#f48fb1' : '#4fc3f7', fontWeight: 600 }}>
                        {m.senderName} <span style={{ color: MUTED, fontWeight: 400, fontFamily: MONO }}>{fmt(m.createdAt)}</span>
                        {m.blocked && <span style={{ color: AMBER, marginLeft: 6 }}>Otomatik engel (iletilmedi)</span>}
                        {m.reportCount > 0 && <span style={{ color: RED, marginLeft: 6 }}>Şikayet: {m.reportCount}</span>}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT, wordBreak: 'break-word' }}>{m.content}</p>
                    </div>
                  ))}
                </div>

                {detail.decision ? (
                  <p style={{ margin: 0, fontSize: 12, color: GREEN }}>Karar: {DECISION_TR[detail.decision]}{detail.decisionDays ? ` (${detail.decisionDays} gün)` : ''}</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" disabled={busy || detail.hasWarning} onClick={() => void decide('WARN')} style={btn(AMBER, busy || detail.hasWarning)}>Uyar</button>
                      <button type="button" disabled={busy} onClick={() => void decide('REMOVE')} style={btn(RED, busy)}>Masadan çıkar</button>
                      <button type="button" disabled={busy} onClick={() => setSuspendOpen(v => !v)} aria-expanded={suspendOpen} style={btn(RED, busy)}>Askıya al</button>
                    </div>
                    {detail.hasWarning && <p style={{ margin: 0, fontSize: 11, color: MUTED }}>Kullanıcı daha önce uyarı aldı: yalnız Masadan çıkar ve Askıya al kullanılabilir.</p>}
                    {suspendOpen && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[3, 15, 30].map(d => (
                          <button key={d} type="button" disabled={busy} onClick={() => void decide('SUSPEND', d)} style={btn(RED, busy)}>{d} gün</button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
