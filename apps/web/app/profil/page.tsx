'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  { key: 'rehber',   label: 'Rehber Engelleme' },
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
      api.get<City[]>('/admin/cities').catch(() => [] as City[]),
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
                className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-colors flex-shrink-0 ${
                  activeTab === tab.key
                    ? 'bg-primary text-white'
                    : 'text-muted hover:text-text hover:bg-surface'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab içeriği */}
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
        </div>
      </main>
    </>
  );
}
