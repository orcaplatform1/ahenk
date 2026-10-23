'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

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

interface Bot {
  id: string;
  status: string;
  profile?: { firstName?: string | null; lastName?: string | null } | null;
}

export default function AdminBots() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Bot | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '' });
  const [saving, setSaving] = useState(false);

  function load() {
    api.get<Bot[]>('/matching/admin/bots').then(setBots).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setForm({ firstName: '', lastName: '' }); setModal('add'); }
  function openEdit(b: Bot) { setEditing(b); setForm({ firstName: b.profile?.firstName ?? '', lastName: b.profile?.lastName ?? '' }); setModal('edit'); }

  async function save() {
    setSaving(true);
    if (modal === 'add') {
      await api.post('/matching/admin/bots', form).catch(() => {});
    } else if (editing) {
      await api.patch(`/matching/admin/bots/${editing.id}/name`, form).catch(() => {});
    }
    setSaving(false);
    setModal(null);
    load();
  }

  async function toggleStatus(b: Bot) {
    const active = b.status === 'ACTIVE';
    await api.patch(`/matching/admin/bots/${b.id}/status`, { active: !active }).catch(() => {});
    load();
  }

  async function deleteBot(id: string) {
    if (!confirm('Botu sil?')) return;
    await api.delete(`/matching/admin/bots/${id}`).catch(() => {});
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
                        İsim
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
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, width: '100%', maxWidth: 360, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>
                {modal === 'add' ? 'Yeni Bot' : 'İsim Düzenle'}
              </h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: MUTED, padding: 4 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Ad" style={inputStyle} />
              <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Soyad" style={inputStyle} />
              <button
                onClick={save}
                disabled={saving || !form.firstName || !form.lastName}
                style={{
                  width: '100%', padding: '9px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
                  background: 'rgba(34,211,238,0.1)', border: `1px solid rgba(34,211,238,0.3)`,
                  fontSize: 12, fontWeight: 700, color: CYAN, fontFamily: SANS,
                  opacity: saving || !form.firstName || !form.lastName ? 0.5 : 1,
                }}
              >
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
