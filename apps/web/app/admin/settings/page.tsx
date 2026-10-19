'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Settings {
  weeklyTableLimit: number;
  matchingEnabled: boolean;
  botSystemActive: boolean;
  maintenanceMode: boolean;
}

function Toggle({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-[#f5f5f5] font-medium">{label}</p>
        {desc && <p className="text-xs text-[#555] mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative flex-shrink-0 w-11 h-6 rounded-full transition-all"
        style={{ background: value ? '#c0392b' : 'rgba(255,255,255,0.1)' }}>
        <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform"
          style={{ transform: value ? 'translateX(20px)' : 'translateX(0)' }} />
      </button>
    </div>
  );
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [limitInput, setLimitInput] = useState('');

  useEffect(() => {
    api.get<Settings>('/admin/settings')
      .then(d => { setSettings(d); setLimitInput(String(d.weeklyTableLimit ?? 0)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    const body: Partial<Settings> & { weeklyTableLimit?: number } = {
      matchingEnabled: settings.matchingEnabled,
      botSystemActive: settings.botSystemActive,
      maintenanceMode: settings.maintenanceMode,
      weeklyTableLimit: parseInt(limitInput, 10) || 0,
    };
    await api.patch('/admin/settings', body).catch(() => {});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="h-8 w-40 rounded-xl animate-pulse mb-6" style={{ background: 'rgba(255,255,255,0.08)' }} />
        {[0,1,2,3].map(i => <div key={i} className="h-14 rounded-xl animate-pulse mb-3" style={{ background: 'rgba(255,255,255,0.08)' }} />)}
      </div>
    );
  }

  if (!settings) return <p className="p-6 text-sm text-[#555]">Ayarlar yüklenemedi.</p>;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="font-serif text-2xl text-[#f5f5f5] mb-6">Sistem Ayarları</h1>

      <div className="glass-card p-5 flex flex-col gap-5">
        <div>
          <p className="text-sm text-[#f5f5f5] font-medium mb-1">Haftalık Masa Limiti</p>
          <p className="text-xs text-[#555] mb-2">Tüm şehirler için global limit (0 = limitsiz)</p>
          <input
            type="number" min={0} max={10000} value={limitInput}
            onChange={e => setLimitInput(e.target.value)}
            className="w-32 bg-transparent border rounded-xl px-3 py-2 text-sm text-[#f5f5f5] outline-none"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          />
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: 16 }} className="flex flex-col gap-4">
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

      <button onClick={save} disabled={saving}
        className="mt-5 w-full py-2.5 rounded-xl text-sm font-medium transition-all"
        style={{ background: saved ? 'rgba(74,222,128,0.15)' : 'linear-gradient(135deg,#c0392b,#922b21)', color: saved ? '#4ade80' : '#fff', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Kaydediliyor…' : saved ? 'Kaydedildi ✓' : 'Kaydet'}
      </button>
    </div>
  );
}
