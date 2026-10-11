'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
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
  profile?: {
    gender?: string;
    birthDate?: string;
    primaryCity?: City;
    secondaryCity?: City;
    topics?: string[];
  };
  kyc?: { status: string };
}

const TABS = [
  { key: 'profil',   label: 'Profilim' },
  { key: 'test',     label: 'Kişilik Testim' },
  { key: 'masalar',  label: 'Masalarım' },
  { key: 'paket',    label: 'Paketim' },
  { key: 'kyc',      label: 'KYC Doğrulama' },
  { key: 'rehber',   label: 'Numara Engelleme' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function ProfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('profil');

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
      <>
        <Navbar />
        <main className="min-h-screen bg-bg text-text">
          <div className="max-w-3xl mx-auto px-4 py-10">
            <TabProfilimSkeleton />
          </div>
        </main>
      </>
    );
  }

  if (!user) return null;

  const kycApproved = user.kyc?.status === 'APPROVED';

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-bg text-text">
        <div className="max-w-3xl mx-auto px-4 py-10">
          {/* Başlık */}
          <div className="mb-8">
            <h1 className="font-serif text-3xl">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-muted text-sm mt-1">{user.email}</p>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mb-8 overflow-x-auto pb-1 scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-2 text-sm whitespace-nowrap transition-all flex-shrink-0"
                style={
                  activeTab === tab.key
                    ? { background: 'linear-gradient(135deg,#c0392b,#ff6b6b)', borderRadius: 9999, color: '#fff', boxShadow: '0 0 12px rgba(192,57,43,0.35)' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9999, color: '#888' }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab içeriği */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {activeTab === 'profil' && (
                <TabProfilim
                  user={user}
                  cities={cities}
                  onGoKyc={() => setActiveTab('kyc')}
                />
              )}
              {activeTab === 'test'    && <TabTest />}
              {activeTab === 'masalar' && <TabMasalar />}
              {activeTab === 'paket'   && <TabPaket kycApproved={kycApproved} onGoKyc={() => setActiveTab('kyc')} />}
              {activeTab === 'kyc'     && <TabKyc />}
              {activeTab === 'rehber'  && <TabRehber />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </>
  );
}
