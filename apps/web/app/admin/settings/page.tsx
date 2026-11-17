'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SURFACE, BORDER, TEXT, MUTED, RED, GREEN, SANS } from '@/lib/adminTheme';


interface Settings {
  matchingEnabled: boolean;
  botSystemActive?: boolean; // yalnızca SUPERADMIN'e gelir
  maintenanceMode: boolean;
  liveDistrictSource?: 'static' | 'real';
  // Eşleştirme Kriterleri: Planlı Buluşma'da masa türüne göre OCEAN sıralaması
  oceanGroup?: boolean;
  oceanOneOnOne?: boolean;
  oceanKanka?: boolean;
}

type Tab = 'general' | 'criteria';
const TABS: [Tab, string][] = [['general', 'Genel'], ['criteria', 'Eşleştirme Kriterleri']];
const OCEAN_DESC = "Yalnız Planlı Buluşma. Açık: sıralama OCEAN %100. Kapalı: yaş yakınlığı %50 + mekân kategori %50. Yarın Buluşma'da OCEAN her zaman kapalı."

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
          background: value ? GREEN : SURFACE, border: `1px solid ${value ? GREEN : BORDER}`,
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
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('general');

  useEffect(() => {
    api.get<Settings>('/admin/settings')
      .then(d => setSettings(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    const body: Partial<Settings> = {
      matchingEnabled: settings.matchingEnabled,
      botSystemActive: settings.botSystemActive,
      maintenanceMode: settings.maintenanceMode,
      liveDistrictSource: settings.liveDistrictSource,
      oceanGroup: settings.oceanGroup,
      oceanOneOnOne: settings.oceanOneOnOne,
      oceanKanka: settings.oceanKanka,
    };
    setError('');
    try {
      await api.patch('/admin/settings', body);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(`Kaydedilemedi: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-page" style={{ maxWidth: 520, margin: '0 auto', fontFamily: SANS }}>

      <div style={{ marginBottom: 24 }}>
        <h1 className="ll-title">Sistem Ayarları</h1>
      </div>

      {loading ? (
        <div className="ll-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ height: 48, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />)}
        </div>
      ) : !settings ? (
        <div className="ll-card" style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}>Ayarlar yüklenemedi.{error ? ` ${error}` : ''}</p>
        </div>
      ) : (
        <>
          <div role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {TABS.map(([value, label]) => {
              const on = tab === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(value)}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600, background: on ? 'rgba(34,211,238,0.1)' : 'transparent', border: `1px solid ${on ? 'rgba(34,211,238,0.3)' : BORDER}`, color: on ? '#22d3ee' : MUTED }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {tab === 'criteria' ? (
            <div className="ll-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Toggle label="OCEAN – Grup" desc={OCEAN_DESC} value={settings.oceanGroup ?? true} onChange={v => setSettings(s => s ? { ...s, oceanGroup: v } : s)} />
              <Toggle label="OCEAN – Baş Başa" desc={OCEAN_DESC} value={settings.oceanOneOnOne ?? false} onChange={v => setSettings(s => s ? { ...s, oceanOneOnOne: v } : s)} />
              <Toggle label="OCEAN – Kankamla" desc={OCEAN_DESC} value={settings.oceanKanka ?? false} onChange={v => setSettings(s => s ? { ...s, oceanKanka: v } : s)} />
            </div>
          ) : (
          <div className="ll-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Toggle'lar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Toggle
                label="Eşleştirme Aktif"
                desc="Grup, baş başa ve Kankamla masa ataması yapılsın mı. Kapalıyken hak düşümü, kilit ve eşleştirme bildirimleri de durur."
                value={settings.matchingEnabled}
                onChange={v => setSettings(s => s ? { ...s, matchingEnabled: v } : s)}
              />
              {settings.botSystemActive !== undefined && (
                <Toggle
                  label="Bot Sistemi Aktif"
                  desc="Eksik masalara bot ekleme"
                  value={settings.botSystemActive}
                  onChange={v => setSettings(s => s ? { ...s, botSystemActive: v } : s)}
                />
              )}
              <Toggle
                label="Bakım Modu"
                desc="Platform açık kalır; masa ataması ve paket satın alma durur, üyelere bakım uyarısı gösterilir"
                value={settings.maintenanceMode}
                onChange={v => setSettings(s => s ? { ...s, maintenanceMode: v } : s)}
              />
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>Canlı katman ilçe verisi</p>
                <p style={{ margin: '2px 0 8px', fontSize: 11, color: MUTED }}>Statik: Şehirler sayfasındaki ilçe listeleri. Gerçek: üyelerin ilçe verisinden hesaplanır.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([['static', 'Statik'], ['real', 'Gerçek']] as const).map(([value, label]) => {
                    const on = (settings.liveDistrictSource ?? 'static') === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSettings(s => s ? { ...s, liveDistrictSource: value } : s)}
                        style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600, background: on ? 'rgba(34,211,238,0.1)' : 'transparent', border: `1px solid ${on ? 'rgba(34,211,238,0.3)' : BORDER}`, color: on ? '#22d3ee' : MUTED }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          )}

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
          {error && <p style={{ margin: '8px 0 0', fontSize: 13, color: RED }}>{error}</p>}
        </>
      )}
    </div>
  );
}
