'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const SURFACE = '#0a1628';
const CARD   = '#0d1f3c';
const BORDER = '#1a3a5c';
const TEXT   = '#e2e8f0';
const MUTED  = '#64748b';
const GREEN  = '#22c55e';
const RED    = '#ef4444';
const SANS   = 'Inter, system-ui, sans-serif';

interface Settings {
  matchingEnabled: boolean;
  botSystemActive: boolean;
  maintenanceMode: boolean;
}

function Toggle({ label, desc, value, onChange }: {
  label: string; desc?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>{label}</p>
        {desc && <p style={{ margin: '3px 0 0', fontSize: 10, color: MUTED }}>{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          position: 'relative', flexShrink: 0, width: 44, height: 24, borderRadius: 99,
          background: value ? RED : SURFACE, border: `1px solid ${value ? RED : BORDER}`,
          cursor: 'pointer', transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: 3, width: 16, height: 16, borderRadius: '50%',
          background: '#fff', transition: 'transform 0.2s',
          transform: value ? 'translateX(20px)' : 'translateX(0)',
        }} />
      </button>
    </div>
  );
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<Settings>('/admin/settings')
      .then(d => setSettings(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    const body: Partial<Settings> = {
      matchingEnabled: settings.matchingEnabled,
      botSystemActive: settings.botSystemActive,
      maintenanceMode: settings.maintenanceMode,
    };
    await api.patch('/admin/settings', body).catch(() => {});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ padding: 24, maxWidth: 520, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>Sistem Ayarları</h1>
      </div>

      {loading ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ height: 48, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />)}
        </div>
      ) : !settings ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 40, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}>Ayarlar yüklenemedi.</p>
        </div>
      ) : (
        <>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Toggle'lar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Toggle
                label="Eşleştirme Aktif"
                desc="Perşembe döngüsü çalışsın mı"
                value={settings.matchingEnabled}
                onChange={v => setSettings(s => s ? { ...s, matchingEnabled: v } : s)}
              />
              <Toggle
                label="Bot Sistemi Aktif"
                desc="Eksik masalara bot ekleme"
                value={settings.botSystemActive}
                onChange={v => setSettings(s => s ? { ...s, botSystemActive: v } : s)}
              />
              <Toggle
                label="Bakım Modu"
                desc="Platform geçici olarak kapalı"
                value={settings.maintenanceMode}
                onChange={v => setSettings(s => s ? { ...s, maintenanceMode: v } : s)}
              />
            </div>
          </div>

          <button
            onClick={save} disabled={saving}
            style={{
              marginTop: 12, width: '100%', padding: '10px', borderRadius: 8,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: SANS,
              background: saved ? 'rgba(34,197,94,0.15)' : 'rgba(34,211,238,0.1)',
              border: `1px solid ${saved ? 'rgba(34,197,94,0.3)' : 'rgba(34,211,238,0.3)'}`,
              color: saved ? GREEN : '#22d3ee',
              fontSize: 13, fontWeight: 700,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Kaydediliyor…' : saved ? 'Kaydedildi ✓' : 'Kaydet'}
          </button>
        </>
      )}
    </div>
  );
}
