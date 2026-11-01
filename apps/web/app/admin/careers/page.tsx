'use client';

import { useEffect, useState } from 'react';
import { api, API_PREFIX } from '@/lib/api';
import { SURFACE, BORDER, TEXT, MUTED, RED, GREEN, AMBER, CYAN, SANS, MONO, LABEL } from '@/lib/adminTheme';

// ─── Renk sabitleri ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  PENDING:  AMBER,
  REVIEWED: GREEN,
  REJECTED: RED,
};
const STATUS_BG: Record<string, string> = {
  PENDING:  'rgba(245,158,11,0.12)',
  REVIEWED: 'rgba(34,197,94,0.12)',
  REJECTED: 'rgba(239,68,68,0.12)',
};
const STATUS_BORDER: Record<string, string> = {
  PENDING:  'rgba(245,158,11,0.35)',
  REVIEWED: 'rgba(34,197,94,0.3)',
  REJECTED: 'rgba(239,68,68,0.3)',
};

interface Career {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  city?: string;
  linkedinOrCv?: string;
  motivation?: string;
  hearFrom?: string;
  hearFromOther?: string | null;
  education?: string | null;
  languages?: { name: string; level: number }[] | null;
  workType?: string | null;
  salaryExpectation?: string | null;
  birthDate?: string | null;
  district?: string | null;
  cvFile?: string | null;
  cvOriginalName?: string | null;
  status: string;
  adminNote?: string;
  createdAt: string;
}

export default function AdminCareers() {
  const [items, setItems] = useState<Career[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  function load() {
    api.get<Career[]>('/admin/careers').then(setItems)
      .catch((e: Error) => setError(`Başvurular yüklenemedi: ${e.message}`))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function update(id: string, status: string) {
    setSaving(id);
    setError('');
    try {
      await api.patch(`/admin/careers/${id}`, { status, adminNote: notes[id] || undefined });
      setExpanded(null);
      load();
    } catch (e) {
      setError(`Güncellenemedi: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="adm-page" style={{ maxWidth: 760, margin: '0 auto', fontFamily: SANS }}>

      {/* Başlık */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="ll-title">
          Kariyer Başvuruları
        </h1>
      </div>

      {error && <p style={{ margin: '0 0 16px', fontSize: 13, color: RED }}>{error}</p>}

      {loading ? (
        <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="ll-title">Başvurular</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ height: 64, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="ll-title">Başvurular</h2>
          </div>
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: MUTED }}>Başvuru yok</p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO }}>
              Yeni başvurular burada görünür
            </p>
          </div>
        </div>
      ) : (
        <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Kart başlığı */}
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="ll-title">Başvurular</h2>
            <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>
              {items.length} kayıt
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((c, i) => (
              <div key={c.id} style={{
                borderBottom: i < items.length - 1 ? `1px solid rgba(26,58,92,0.5)` : 'none',
              }}>
                {/* Satır başlığı */}
                <div style={{
                  padding: '14px 18px',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.fullName}
                      </span>
                      <span style={{
                        ...LABEL, flexShrink: 0,
                        padding: '2px 7px', borderRadius: 99,
                        background: STATUS_BG[c.status] ?? 'transparent',
                        border: `1px solid ${STATUS_BORDER[c.status] ?? BORDER}`,
                        color: STATUS_COLOR[c.status] ?? MUTED,
                      }}>
                        {c.status}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: MUTED }}>{c.email}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>
                      {c.city ?? '—'} · {new Date(c.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}
                    </p>
                  </div>
                  <button
                    onClick={() => setExpanded(e => e === c.id ? null : c.id)}
                    style={{
                      flexShrink: 0, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
                      background: expanded === c.id ? 'rgba(34,211,238,0.08)' : 'transparent',
                      border: `1px solid ${expanded === c.id ? 'rgba(34,211,238,0.3)' : BORDER}`,
                      fontSize: 10, color: expanded === c.id ? CYAN : MUTED,
                      fontFamily: SANS,
                    }}
                  >
                    {expanded === c.id ? '▲ Kapat' : '▼ Detay'}
                  </button>
                </div>

                {/* Detay paneli */}
                {expanded === c.id && (
                  <div style={{
                    margin: '0 18px 14px',
                    padding: '14px 16px',
                    borderRadius: 8,
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    {([
                      ['E-posta', c.email],
                      ['Telefon', c.phone],
                      ['Öğrenim durumu', c.education],
                      ['Yabancı dil', c.languages?.length ? c.languages.map(l => `${l.name} ${'★'.repeat(l.level)}`).join(', ') : null],
                      ['Çalışma türü', c.workType],
                      ['Ücret beklentisi', c.salaryExpectation],
                      ['Doğum tarihi', c.birthDate ? c.birthDate.split('-').reverse().join('.') : null],
                      ['Şehir', c.city],
                      ['İlçe', c.district],
                      ['LinkedIn', c.linkedinOrCv],
                      ['Ben Ahenk\'e şunları katabilirim', c.motivation],
                      ['Bizi nereden duydu', [c.hearFrom, c.hearFromOther].filter(Boolean).join(': ')],
                      ['Başvuru tarihi', new Date(c.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })],
                      ['Admin notu', c.adminNote],
                    ] as [string, string | null | undefined][]).map(([label, value]) => (
                      <p key={label} style={{ margin: 0, fontSize: 13, color: MUTED, overflowWrap: 'anywhere' }}>
                        <span style={{ color: TEXT, fontWeight: 600 }}>{label}:</span> {value || '—'}
                      </p>
                    ))}
                    <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
                      <span style={{ color: TEXT, fontWeight: 600 }}>Özgeçmiş (CV):</span>{' '}
                      {c.cvFile
                        ? <a href={`${API_PREFIX}/admin/careers/${c.id}/cv`} target="_blank" rel="noopener noreferrer" style={{ color: CYAN }}>{c.cvOriginalName ?? 'CV dosyasını aç'}</a>
                        : '—'}
                    </p>

                    {c.status === 'PENDING' && (
                      <>
                        <textarea
                          value={notes[c.id] ?? ''}
                          onChange={e => setNotes(n => ({ ...n, [c.id]: e.target.value }))}
                          placeholder="Admin notu (opsiyonel)"
                          rows={2}
                          style={{
                            width: '100%', background: 'transparent',
                            border: `1px solid ${BORDER}`, borderRadius: 8,
                            padding: '7px 10px', fontSize: 11, color: TEXT,
                            outline: 'none', resize: 'none', fontFamily: SANS,
                            boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => update(c.id, 'REVIEWED')}
                            disabled={saving === c.id}
                            style={{
                              flex: 1, padding: '8px', borderRadius: 8, cursor: saving === c.id ? 'not-allowed' : 'pointer',
                              background: 'rgba(34,197,94,0.1)',
                              border: '1px solid rgba(34,197,94,0.3)',
                              fontSize: 11, fontWeight: 600, color: GREEN,
                              fontFamily: SANS, opacity: saving === c.id ? 0.4 : 1,
                            }}
                          >
                            {saving === c.id ? '…' : 'İncelendi'}
                          </button>
                          <button
                            onClick={() => update(c.id, 'REJECTED')}
                            disabled={saving === c.id}
                            style={{
                              flex: 1, padding: '8px', borderRadius: 8, cursor: saving === c.id ? 'not-allowed' : 'pointer',
                              background: 'rgba(239,68,68,0.1)',
                              border: '1px solid rgba(239,68,68,0.3)',
                              fontSize: 11, fontWeight: 600, color: RED,
                              fontFamily: SANS, opacity: saving === c.id ? 0.4 : 1,
                            }}
                          >
                            {saving === c.id ? '…' : 'Reddet'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
