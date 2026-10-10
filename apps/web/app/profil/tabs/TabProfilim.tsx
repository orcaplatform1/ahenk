'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';

const TOPICS_LIST = [
  'Teknoloji', 'Sanat', 'Spor', 'Seyahat', 'Müzik',
  'Sinema', 'Edebiyat', 'Gastronomi', 'Girişimcilik', 'Bilim',
];

const KYC_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING:    { label: 'Doğrulama Bekleniyor', cls: 'bg-surface text-muted border-border' },
  APPROVED:   { label: 'Doğrulandı ✓',        cls: 'bg-green-900/40 text-green-400 border-green-800' },
  REJECTED:   { label: 'Reddedildi',           cls: 'bg-red-900/40 text-accent border-red-800' },
  SUSPICIOUS: { label: 'İnceleniyor',          cls: 'bg-orange-900/40 text-orange-400 border-orange-800' },
};

interface City { id: string; name: string; }

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  profile?: {
    gender?: string;
    birthDate?: string;
    primaryCity?: City;
    secondaryCity?: City;
    topics?: string[];
  };
  kyc?: { status: string };
}

interface Props {
  user: UserData;
  onGoKyc: () => void;
  cities: City[];
}

export function TabProfilim({ user, onGoKyc, cities }: Props) {
  const [editingCities, setEditingCities] = useState(false);
  const [editingTopics, setEditingTopics] = useState(false);
  const [primaryCityId, setPrimaryCityId] = useState(user.profile?.primaryCity?.id ?? '');
  const [secondaryCityId, setSecondaryCityId] = useState(user.profile?.secondaryCity?.id ?? '');
  const [topics, setTopics] = useState<string[]>(user.profile?.topics ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const kycStatus = user.kyc?.status ?? 'PENDING';
  const badge = KYC_BADGE[kycStatus] ?? KYC_BADGE.PENDING;

  async function saveCities() {
    if (!primaryCityId) { setSaveError('Ana şehir zorunlu.'); return; }
    setSaving(true); setSaveError('');
    try {
      await api.patch('/users/me', { primaryCityId, secondaryCityId: secondaryCityId || null });
      setEditingCities(false);
    } catch (e) { setSaveError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function saveTopics() {
    if (topics.length === 0) { setSaveError('En az bir konu seç.'); return; }
    setSaving(true); setSaveError('');
    try {
      await api.put('/users/topics', { topics });
      setEditingTopics(false);
    } catch (e) { setSaveError((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KYC banner */}
      {kycStatus !== 'APPROVED' && (
        <div className="flex items-center justify-between gap-4 bg-yellow-900/20 border border-yellow-800/40 rounded-2xl px-5 py-4">
          <p className="text-sm text-yellow-300">Masaya katılmak için kimlik doğrulaması gereklidir.</p>
          <button onClick={onGoKyc} className="text-sm text-yellow-300 hover:text-yellow-100 font-medium whitespace-nowrap">
            Doğrula →
          </button>
        </div>
      )}

      {/* Temel bilgiler */}
      <Card title="Hesap Bilgileri">
        <Row label="Ad Soyad" value={`${user.firstName} ${user.lastName}`} />
        <Row label="E-posta" value={user.email} />
        {user.phone && <Row label="Telefon" value={user.phone} />}
        {user.profile?.birthDate && (
          <Row label="Doğum Tarihi" value={new Date(user.profile.birthDate).toLocaleDateString('tr-TR')} />
        )}
        {user.profile?.gender && (
          <Row label="Cinsiyet" value={user.profile.gender === 'MALE' ? 'Erkek' : 'Kadın'} />
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-muted">KYC Durumu</span>
          <span className={`text-xs px-3 py-1 rounded-full border ${badge.cls}`}>{badge.label}</span>
        </div>
      </Card>

      {/* Şehir tercihleri */}
      <Card title="Şehir Tercihleri" action={!editingCities ? { label: 'Düzenle', onClick: () => setEditingCities(true) } : undefined}>
        {editingCities ? (
          <div className="flex flex-col gap-3">
            <Select label="Ana Şehir *" value={primaryCityId} onChange={setPrimaryCityId} cities={cities} />
            <Select
              label="İkinci Şehir (opsiyonel)"
              value={secondaryCityId}
              onChange={setSecondaryCityId}
              cities={cities.filter((c) => c.id !== primaryCityId)}
              optional
            />
            {saveError && <p className="text-accent text-sm">{saveError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setEditingCities(false)} className="flex-1 py-2 rounded-xl border border-border text-sm text-muted hover:text-text">İptal</button>
              <button onClick={saveCities} disabled={saving} className="flex-1 py-2 rounded-xl bg-primary hover:bg-primary-hover text-sm disabled:opacity-50">
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <Row label="Ana Şehir" value={user.profile?.primaryCity?.name ?? '—'} />
            <Row label="İkinci Şehir" value={user.profile?.secondaryCity?.name ?? 'Seçilmedi'} />
          </>
        )}
      </Card>

      {/* Konu tercihleri */}
      <Card title="Konu Tercihleri" action={!editingTopics ? { label: 'Düzenle', onClick: () => setEditingTopics(true) } : undefined}>
        {editingTopics ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {TOPICS_LIST.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopics((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${topics.includes(t) ? 'bg-primary border-primary text-white' : 'bg-bg border-border text-muted hover:border-accent hover:text-accent'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {saveError && <p className="text-accent text-sm">{saveError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setEditingTopics(false)} className="flex-1 py-2 rounded-xl border border-border text-sm text-muted hover:text-text">İptal</button>
              <button onClick={saveTopics} disabled={saving} className="flex-1 py-2 rounded-xl bg-primary hover:bg-primary-hover text-sm disabled:opacity-50">
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(user.profile?.topics ?? []).length > 0
              ? (user.profile?.topics ?? []).map((t) => (
                  <span key={t} className="px-3 py-1 rounded-full bg-surface border border-border text-sm text-muted">{t}</span>
                ))
              : <span className="text-sm text-muted">Henüz konu seçilmedi.</span>
            }
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Yardımcı alt bileşenler ──────────────────────────────────────────────

export function TabProfilimSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-16 bg-surface rounded-2xl animate-pulse" />
      <div className="bg-surface border border-border rounded-2xl p-6"><SkeletonBlock lines={4} /></div>
      <div className="bg-surface border border-border rounded-2xl p-6"><SkeletonBlock lines={2} /></div>
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: { label: string; onClick: () => void }; }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-sm text-muted uppercase tracking-wide">{title}</h3>
        {action && (
          <button onClick={action.onClick} className="text-xs text-muted hover:text-text border border-border rounded-lg px-3 py-1">
            {action.label}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm text-text">{value}</span>
    </div>
  );
}

function Select({ label, value, onChange, cities, optional }: {
  label: string; value: string; onChange: (v: string) => void; cities: City[]; optional?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary">
        {optional && <option value="">Seçmek istemiyorum</option>}
        {!optional && <option value="">Şehir seç</option>}
        {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  );
}
