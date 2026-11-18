'use client';

// Mobil genişlikte (md altı) alt ikon menü: mobil uygulamanın alt menüsüyle aynı (apps/mobile/app/(tabs)/_layout.tsx, TabIcons.tsx,
// theme.ts tabBar / tabIcon / tabNavIcon / tabCenter / tabPill). Sıra: Ana Sayfa · Takvim · Profil (ortada büyük) · Paketler · Bildirimler.
// Yazı yok (mobil tabBarShowLabel false). Web'de bildirim sayfası olmadığından Bildirimler bağlı değil.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { buildInitials } from '@ahenk/ui';

const BAR_BG = '#0a0a0a';
const BAR_BORDER = 'rgba(255,255,255,0.12)';
const BAR_H = 44;
const ICON = 28;
const ACTIVE = '#FF3B30';
const INACTIVE = '#FFFFFF';
const PILL = { w: 64, h: 36, r: 18, bg: 'rgba(192,57,43,0.20)', fadeMs: 150 };
const CENTER = { d: 64, rise: 22, ring: 4, frame: 2, frameOff: '#FFFFFF', frameOn: '#FF3B30' };
const G_BG = { male: 'rgba(79,195,247,0.12)', female: 'rgba(244,143,177,0.12)' };

interface Me { firstName: string; lastName: string; profilePhotoUrl?: string | null; profile?: { gender?: string | null } }

function TabIcon({ src, active }: { src: string; active: boolean }) {
  return (
    <span style={{ position: 'relative', width: ICON, height: ICON, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span aria-hidden style={{ position: 'absolute', left: (ICON - PILL.w) / 2, top: (ICON - PILL.h) / 2, width: PILL.w, height: PILL.h, borderRadius: PILL.r,
        background: PILL.bg, opacity: active ? 1 : 0, transition: active ? `opacity ${PILL.fadeMs}ms` : 'none' }} />
      {/* Tek renk ikon: mobildeki tintColor karşılığı maske + zemin rengi */}
      <span aria-hidden style={{ position: 'relative', width: ICON, height: ICON, background: active ? ACTIVE : INACTIVE,
        WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskSize: 'contain', maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' }} />
    </span>
  );
}

export function BottomTabBar({ activeKey }: { activeKey?: string }) {
  const t = useTranslations();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { api.get<Me>('/auth/me').then(u => { if (u) setMe(u); }).catch(() => {}); }, []);

  const isActive = (key: string) => {
    if (key === 'dashboard') return pathname === '/dashboard';
    if (pathname !== '/profil') return false;
    if (!activeKey || activeKey === 'profil') return key === 'profil';
    return key === activeKey;
  };
  const cell = { flex: 1, height: BAR_H, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' } as const;
  const profileOn = isActive('profil');
  const inner = CENTER.d - CENTER.ring * 2;
  const photo = me?.profilePhotoUrl ? me.profilePhotoUrl.replace(/\.webp$/, '.s.webp') : null;

  return (
    <nav className="md:hidden" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40, background: BAR_BG, borderTop: `1px solid ${BAR_BORDER}`,
      paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div style={{ display: 'flex', alignItems: 'center', height: BAR_H }}>
        <Link href="/dashboard" aria-label={t('kankaInv.home')} aria-current={isActive('dashboard') ? 'page' : undefined} style={cell}>
          <TabIcon src="/tabs/ahenk.webp" active={isActive('dashboard')} />
        </Link>
        <Link href="/profil?tab=masalar" aria-label={t('tabs.calendar')} aria-current={isActive('masalar') ? 'page' : undefined} style={cell}>
          <TabIcon src="/tabs/takvim.webp" active={isActive('masalar')} />
        </Link>
        <div style={{ ...cell, position: 'relative' }}>
          <Link href="/profil?tab=profil" aria-label={t('tabs.profil')} aria-current={profileOn ? 'page' : undefined}
            style={{ position: 'absolute', top: -CENTER.rise, width: CENTER.d, height: CENTER.d, borderRadius: '50%', border: `${CENTER.ring}px solid ${BAR_BG}`,
              background: BAR_BG, boxShadow: '0 2px 6px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
            <span style={{ width: inner, height: inner, borderRadius: '50%', border: `${CENTER.frame}px solid ${profileOn ? CENTER.frameOn : CENTER.frameOff}`, overflow: 'hidden',
              background: me?.profile?.gender === 'FEMALE' ? G_BG.female : G_BG.male, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {photo
                ? <img src={photo} alt={t('photo.alt')} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }} />
                : <span style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>{me ? buildInitials(me.firstName, me.lastName) : '?'}</span>}
            </span>
          </Link>
        </div>
        <Link href="/profil?tab=paket" aria-label={t('tabs.packages')} aria-current={isActive('paket') ? 'page' : undefined} style={cell}>
          <TabIcon src="/tabs/paketlerim.webp" active={isActive('paket')} />
        </Link>
        <span aria-label={t('tabs.notifications')} aria-disabled="true" style={cell}>
          <TabIcon src="/tabs/bildirimlerim.webp" active={false} />
        </span>
      </div>
    </nav>
  );
}
