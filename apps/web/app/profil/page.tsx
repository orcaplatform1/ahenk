'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { TabProfilim, TabProfilimSkeleton } from './tabs/TabProfilim';
import { TabTest } from './tabs/TabTest';
import { TabMasalar } from './tabs/TabMasalar';
import { TabPaket } from './tabs/TabPaket';
import { TabKyc } from './tabs/TabKyc';
import { TabRehber } from './tabs/TabRehber';

interface City { id: string; name: string; }

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: string;
  activeCity?: string | null;
  activePlan?: 'MASADA' | 'KARSIMDA' | 'ICERDE' | null;
  profile?: {
    gender?: string;
    birthDate?: string;
    primaryCity?: City;
    secondaryCity?: City;
    venuePreference?: 'ALCOHOLIC' | 'NON_ALCOHOLIC' | 'NO_PREFERENCE';
  };
  kyc?: { status: string };
}

const TABS = [
  { key: 'profil',   label: 'Profilim' },
  { key: 'test',     label: 'Kişilik Testim' },
  { key: 'masalar',  label: 'Masalarım' },
  { key: 'paket',    label: 'Paketim' },
  { key: 'kyc',      label: 'Kimlik Doğrulama' },
  { key: 'rehber',   label: 'Numara Engelleme' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function readTabFromUrl(): TabKey {
  if (typeof window === 'undefined') return 'profil';
  const p = new URLSearchParams(window.location.search).get('tab');
  return (TABS.find(t => t.key === p)?.key) ?? 'profil';
}

export default function ProfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('profil');

  // URL'den sekmeyi oku (client-only)
  useEffect(() => { setActiveTab(readTabFromUrl()); }, []);

  function changeTab(key: TabKey) {
    setActiveTab(key);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', key);
    window.history.replaceState({}, '', url.toString());
  }

  useEffect(() => {
    // Token kontrolü yapmıyoruz — apiFetch 401 alınca refresh token ile yeniliyor.
    // localStorage token yoksa bile refresh cookie varsa oturum devam eder.
    Promise.all([
      api.get<UserData>('/auth/me'),
      api.get<City[]>('/auth/cities').catch(() => [] as City[]),
    ])
      .then(([u, c]) => { setUser(u); setCities(c); })
      .catch(() => {
        // apiFetch 401 → refresh dener → başarısızsa window.location.href='/giris'
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-bg text-text pt-[52px]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <TabProfilimSkeleton />
        </div>
      </main>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/giris';
    return null;
  }

  const kycApproved = user.kyc?.status === 'APPROVED';

  return (
    <main className="min-h-screen bg-bg text-text pt-[52px]">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Başlık */}
        <div className="mb-6">
          <h1 className="font-serif text-2xl text-[#f5f5f5]">
            {user.firstName} {user.lastName}
          </h1>
        </div>

        {/* KYC banner */}
        {user.kyc?.status && user.kyc.status !== 'APPROVED' && (
          <div
            className="flex items-center justify-between gap-4 mb-6 px-5 py-4 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(12,8,4,0.85) 0%, rgba(20,12,6,0.9) 100%)',
              border: '1px solid rgba(232,133,12,0.25)',
              borderLeft: '3px solid #e8850c',
              boxShadow: '0 2px 24px rgba(232,133,12,0.10), inset 0 1px 0 rgba(255,255,255,0.04)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <p className="text-sm leading-snug" style={{ color: '#e8850c' }}>
              Masalara katılabilmeniz için kimliğinizi doğrulamalısınız.
            </p>
            <button
              onClick={() => changeTab('kyc')}
              className="text-sm font-semibold whitespace-nowrap flex-shrink-0 px-4 py-2 rounded-xl transition-all"
              style={{
                background: 'linear-gradient(135deg,#1a5c2a,#27ae60)',
                color: '#fff',
                boxShadow: '0 0 14px rgba(39,174,96,0.35)',
                border: 'none',
              }}
            >
              Doğrula
            </button>
          </div>
        )}

        {/* Sekme butonları */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => changeTab(tab.key)}
              className="text-xs font-medium whitespace-nowrap px-3 py-2 rounded-lg transition-all flex-shrink-0"
              style={activeTab === tab.key
                ? { background: 'rgba(192,57,43,0.18)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.35)' }
                : { background: 'rgba(255,255,255,0.04)', color: '#888', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sekme içeriği */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {activeTab === 'profil'  && <TabProfilim user={user} cities={cities} onGoKyc={() => changeTab('kyc')} activePlan={user.activePlan ?? null} />}
            {activeTab === 'test'    && <TabTest />}
            {activeTab === 'masalar' && <TabMasalar activePlan={user.activePlan ?? null} />}
            {activeTab === 'paket'   && <TabPaket kycApproved={kycApproved} onGoKyc={() => changeTab('kyc')} />}
            {activeTab === 'kyc'     && <TabKyc />}
            {activeTab === 'rehber'  && <TabRehber />}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
