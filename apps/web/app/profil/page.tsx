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
    const token = api.getToken();
    if (!token) { router.replace('/giris'); return; }

    Promise.all([
      api.get<UserData>('/auth/me'),
      api.get<City[]>('/auth/cities').catch(() => [] as City[]),
    ])
      .then(([u, c]) => { setUser(u); setCities(c); })
      .catch(() => { api.clearToken(); router.replace('/giris'); })
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

  if (!user) return null;

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

        {/* KYC banner — premium koyu stil */}
        {user.kyc?.status && user.kyc.status !== 'APPROVED' && (
          <div
            className="flex items-center justify-between gap-4 mb-6 px-5 py-4 rounded-2xl"
            style={{
              background: 'rgba(15,5,5,0.6)',
              border: '1px solid rgba(192,57,43,0.3)',
              borderLeft: '3px solid #c0392b',
              boxShadow: '0 0 20px rgba(192,57,43,0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div>
              <p className="text-sm font-medium text-[#f5f5f5]">Kimlik Doğrulaması Gerekiyor</p>
              <p className="text-xs text-[#888] mt-0.5">Masaya katılmak için kimlik doğrulamasını tamamla.</p>
            </div>
            <button
              onClick={() => changeTab('kyc')}
              className="text-sm font-medium whitespace-nowrap transition-colors"
              style={{ color: '#c0392b' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ff6b6b')}
              onMouseLeave={e => (e.currentTarget.style.color = '#c0392b')}
            >
              Doğrula →
            </button>
          </div>
        )}

        {/* İçerik: dikey tab listesi + içerik */}
        <div className="flex flex-col md:grid md:grid-cols-[200px_1fr] md:gap-6 md:items-start">

          {/* Sol: dikey sekme listesi */}
          <nav
            className="glass-card mb-6 md:mb-0 md:sticky overflow-hidden"
            style={{ top: '60px', padding: 0 }}
          >
            {(user.role === 'ADMIN' || user.role === 'SUPERADMIN') && (
              <a
                href="/admin"
                className="w-full text-left px-4 py-3.5 text-sm flex items-center gap-2 transition-all"
                style={{
                  borderLeft: '2px solid rgba(192,57,43,0.6)',
                  background: 'rgba(192,57,43,0.08)',
                  color: '#c0392b',
                  fontWeight: 600,
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                Yönetim Paneli
              </a>
            )}
            {TABS.map((tab, i) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => changeTab(tab.key)}
                  className="w-full text-left px-4 py-3.5 text-sm transition-all"
                  style={{
                    borderLeft: active ? '2px solid #c0392b' : '2px solid transparent',
                    background: active ? 'rgba(192,57,43,0.06)' : 'transparent',
                    color: active ? '#f5f5f5' : '#666',
                    fontWeight: active ? 500 : 400,
                    borderBottom: i < TABS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#bbb'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#666'; }}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Sağ: sekme içeriği */}
          <div className="min-w-0">
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
                {activeTab === 'masalar' && <TabMasalar />}
                {activeTab === 'paket'   && <TabPaket kycApproved={kycApproved} onGoKyc={() => changeTab('kyc')} />}
                {activeTab === 'kyc'     && <TabKyc />}
                {activeTab === 'rehber'  && <TabRehber />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}
