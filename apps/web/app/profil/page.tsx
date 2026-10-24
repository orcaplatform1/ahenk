'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { TabProfilim, TabProfilimSkeleton } from './tabs/TabProfilim';
import { TabTest } from './tabs/TabTest';
import { TabMasalar } from './tabs/TabMasalar';
import { TabPaket } from './tabs/TabPaket';
import { TabKyc } from './tabs/TabKyc';
import { TabRehber } from './tabs/TabRehber';
import { AccountTabBar } from '@/components/AccountTabBar';

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
  maintenanceMode?: boolean;
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

function ProfilPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserData | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const activeTab: TabKey = useMemo(() => {
    const p = searchParams.get('tab');
    return (TABS.find(t => t.key === p)?.key) ?? 'profil';
  }, [searchParams]);

  function changeTab(key: TabKey) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    router.replace(`/profil?tab=${key}`, { scroll: false });
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    api.get<UserData>('/auth/me')
      .then(u => {
        setUser(u);
        setFetchError(false);
        api.get<City[]>('/auth/cities').then(c => setCities(c)).catch(() => {});
      })
      .catch((e: Error) => {
        if (e.message === '__rate_limit__') {
          setTimeout(() => {
            api.get<UserData>('/auth/me')
              .then(u => { setUser(u); setFetchError(false); })
              .catch(() => setFetchError(true))
              .finally(() => setLoading(false));
          }, 1500);
          return;
        }
        setFetchError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      // sadece oturum gerçekten yoksa yönlendir (sunucu hatalarında yanlış logout olmasın)
      if (!api.hasSession()) {
        window.location.href = '/giris';
      }
    }
  }, [loading, user]);

  if (loading) {
    return (
      <main className="min-h-screen bg-bg text-text pt-[52px]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <TabProfilimSkeleton />
        </div>
      </main>
    );
  }

  if (fetchError && !user) {
    return (
      <main className="min-h-screen bg-bg text-text pt-[52px] flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-[#888] text-sm mb-4">Profil yüklenemedi. Lütfen tekrar deneyin.</p>
          <button
            onClick={() => { setFetchError(false); setLoading(true); api.get<UserData>('/auth/me').then(u => setUser(u)).catch(() => setFetchError(true)).finally(() => setLoading(false)); }}
            className="btn-ghost"
          >
            Yeniden Dene
          </button>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const kycApproved = user.kyc?.status === 'APPROVED';

  return (
    <main className="min-h-screen bg-bg text-text pt-[52px]">
      <AccountTabBar activeKey={activeTab} kycApproved={kycApproved} role={user.role} />
      <div className="max-w-4xl mx-auto px-4 py-8">

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
            {activeTab === 'masalar' && <TabMasalar activePlan={user.activePlan ?? null} userInfo={{ firstName: user.firstName, lastName: user.lastName, gender: user.profile?.gender }} kycApproved={kycApproved} onGoKyc={() => changeTab('kyc')} />}
            {activeTab === 'paket'   && <TabPaket kycApproved={kycApproved} onGoKyc={() => changeTab('kyc')} maintenanceMode={!!user.maintenanceMode} />}
            {activeTab === 'kyc'     && <TabKyc />}
            {activeTab === 'rehber'  && <TabRehber />}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

export default function ProfilPageWrapper() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-bg text-text pt-[52px]"><div className="max-w-4xl mx-auto px-4 py-8"><TabProfilimSkeleton /></div></main>}>
      <ProfilPage />
    </Suspense>
  );
}
