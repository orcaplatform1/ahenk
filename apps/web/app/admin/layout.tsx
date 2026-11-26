'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { setAdminIdentity } from '@/lib/adminRole';
import { BG, SURFACE, BORDER, TEXT, MUTED, RED, LABEL, SANS } from '@/lib/adminTheme';

const NAV_TOP = [
  { href: '/',       label: 'Anasayfa' },
  { href: '/profil', label: 'Profilim' },
];

// Temsilci (SUPPORT) yönetim panelinde yalnız Canlı Destek'i görür; diğer sekmeler ve sayfalar kapalı (backend uçları da yetkiyle engelli)
const SUPPORT_HOME = '/admin/canli-destek';

const NAV: { href: string; label: string; sos?: boolean; superadminOnly?: boolean }[] = [
  { href: '/admin/acil-yardim',  label: 'Acil Yardım', sos: true },
  { href: '/admin/canli-destek', label: 'Canlı Destek' },
  { href: '/admin/stats',        label: 'İstatistikler' },
  { href: '/admin/matches',      label: 'Masalar' },
  { href: '/admin/kyc',          label: 'KYC Bekleyenler' },
  { href: '/admin/profil-fotograflari', label: 'Profil Fotoğrafları' },
  { href: '/admin/users',        label: 'Kullanıcılar' },
  { href: '/admin/subscriptions', label: 'Abonelikler' },
  { href: '/admin/alerts',       label: 'Uyarılar' },
  { href: '/admin/sonuclandirma', label: 'Ödeme Sonuçlandırma', superadminOnly: true },
  { href: '/admin/venues',       label: 'Mekanlar', superadminOnly: true },
  { href: '/admin/cities',       label: 'Şehirler' },
  { href: '/admin/bolgeler',     label: 'Bölgeler' },
  { href: '/admin/denge',        label: 'Bot Yönetimi', superadminOnly: true },
  { href: '/admin/fiyatlar',     label: 'Paket Fiyatları', superadminOnly: true },
  { href: '/admin/islem-kayitlari', label: 'İşlem Kayıtları', superadminOnly: true },
  { href: '/admin/veri-saklama', label: 'Veri Saklama', superadminOnly: true },
  { href: '/admin/quality',      label: 'Şikayetler' },
  { href: '/admin/ekran-goruntusu', label: 'Ekran Görüntüsü İhlalleri' },
  { href: '/admin/sorun-bildirimleri', label: 'Sorun Bildirimleri' },
  { href: '/admin/partnerships', label: 'İş Ortaklığı', superadminOnly: true },
  { href: '/admin/careers',      label: 'Kariyer', superadminOnly: true },
  { href: '/admin/janti-haydar', label: 'Janti Haydar' },
  { href: '/admin/settings',     label: 'Ayarlar', superadminOnly: true },
];


function NavLinks({ pathname, onClose, onLogout, counts, role }: {
  pathname: string; onClose?: () => void; onLogout: () => void; counts: Record<string, number>; role: string | null;
}) {
  return (
    <nav style={{ display: 'flex', flexDirection: 'column', padding: 12, flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${BORDER}` }}>
        {NAV_TOP.map((n) => (
          <Link key={n.href} href={n.href} onClick={onClose}
            style={{ padding: '8px 12px', borderRadius: 10, fontSize: 13, color: MUTED, border: '1px solid transparent', transition: 'color 0.15s' }}>
            {n.label}
          </Link>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {NAV.filter((n) => (role === 'SUPPORT' ? n.href === SUPPORT_HOME : !n.superadminOnly || role === 'SUPERADMIN')).map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/');
          const style = n.sos
            ? active
              ? { background: 'rgba(239,68,68,0.12)', color: RED, border: `1px solid rgba(239,68,68,0.35)`, fontWeight: 700 }
              : { color: RED, border: '1px solid transparent', fontWeight: 700 }
            : active
              ? { background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }
              : { color: MUTED, border: '1px solid transparent' };
          return (
            <Link key={n.href} href={n.href} onClick={onClose}
              style={{ padding: '8px 12px', borderRadius: 10, fontSize: 13, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...style }}>
              {n.sos ? (
                // Acil Yardım: kırmızı vurgulu, dikkat çeken premium etiket
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 11px', borderRadius: 99,
                  background: 'linear-gradient(135deg, #f87171 0%, #ef4444 45%, #b91c1c 100%)', color: '#fff',
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 1px rgba(239,68,68,0.55), 0 4px 14px rgba(239,68,68,0.45)',
                }}>
                  <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', boxShadow: '0 0 6px rgba(255,255,255,0.9)' }} />
                  {n.label}
                </span>
              ) : n.label}
              {/* Bekleyen / okunmamış iş sayısı (0 ise yok, 99'dan fazlası 99+) */}
              {(counts[n.href] ?? 0) > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: RED, color: '#fff', minWidth: 18, textAlign: 'center' }}>
                  {counts[n.href] > 99 ? '99+' : counts[n.href]}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <div style={{ paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
        <button onClick={onLogout}
          style={{ width: '100%', padding: '8px 12px', fontSize: 13, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 10 }}>
          Çıkış
        </button>
      </div>
    </nav>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const unread = counts['/admin/alerts'] ?? 0;
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!api.hasSession()) { router.replace('/giris'); return; }
    // Rol ve id /auth/me'den (token JS'ten okunamaz); oturum düşerse api.get /giris'e yönlendirir
    let cancelled = false;
    api.get<{ id: string; role: string }>('/auth/me').then(me => {
      if (cancelled) return;
      const r = me?.role;
      if (r !== 'ADMIN' && r !== 'SUPERADMIN' && r !== 'SUPPORT') { router.replace('/dashboard'); return; }
      setAdminIdentity({ id: me.id, role: r });
      setRole(r);
      setReady(true);
    }).catch(() => { if (!cancelled) router.replace('/giris'); });
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Menü bildirim baloncukları: sayfa açılınca ve 60 sn'de bir (GET /admin/menu-counts)
  useEffect(() => {
    if (!ready) return;
    // Temsilci menu-counts ucuna giremez: sıradaki sohbet sayısı canlı destek durumundan
    const load = () => {
      if (role === 'SUPPORT') { api.get<{ queue: unknown[] }>('/admin/live-support/state').then((s) => setCounts({ [SUPPORT_HOME]: s.queue.length })).catch(() => {}); return; }
      api.get<Record<string, number>>('/admin/menu-counts').then(setCounts).catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [ready, pathname, role]);

  // Bot sayfaları yalnızca SUPERADMIN
  const blocked = ready && (role === 'SUPPORT'
    ? !(pathname === SUPPORT_HOME || pathname.startsWith(SUPPORT_HOME + '/'))
    : role !== 'SUPERADMIN' && NAV.some((n) => n.superadminOnly && (pathname === n.href || pathname.startsWith(n.href + '/'))));
  useEffect(() => { if (blocked) router.replace(role === 'SUPPORT' ? SUPPORT_HOME : '/admin/stats'); }, [blocked, router, role]);

  async function handleLogout() { await api.logout(); setAdminIdentity(null); router.push('/'); }

  if (!ready || blocked) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${RED}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="admin-shell" style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: SANS, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 52, flexShrink: 0, position: 'sticky', top: 0, zIndex: 30, background: SURFACE, borderBottom: `1px solid ${BORDER}`, boxShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
        <button className="md:hidden" onClick={() => setDrawerOpen(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexDirection: 'column', gap: 5 }} aria-label="Menü">
          <span style={{ display: 'block', width: 18, height: 1.5, background: MUTED, borderRadius: 2 }} />
          <span style={{ display: 'block', width: 18, height: 1.5, background: MUTED, borderRadius: 2 }} />
          <span style={{ display: 'block', width: 18, height: 1.5, background: MUTED, borderRadius: 2 }} />
        </button>
        <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, textDecoration: 'none' }}>
          <span style={{ ...LABEL, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>AHENK YÖNETİM PANELİ</span>
        </Link>
        {unread > 0 && (
          <Link href="/admin/alerts" className="md:hidden" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: RED, color: '#fff' }}>
              {unread} uyarı
            </span>
          </Link>
        )}
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex" style={{ width: 208, flexShrink: 0, flexDirection: 'column', position: 'sticky', top: 52, height: 'calc(100vh - 52px)', background: SURFACE, borderRight: `1px solid ${BORDER}` }}>
          <NavLinks pathname={pathname} onLogout={handleLogout} counts={counts} role={role} />
        </aside>
        <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden', background: BG }}>{children}</main>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div className="md:hidden" style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }} onClick={() => setDrawerOpen(false)} />
            <motion.div className="md:hidden" style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 210, width: 208, background: SURFACE, borderRight: `1px solid ${BORDER}`, boxShadow: '8px 0 32px rgba(0,0,0,0.7)', paddingTop: 'env(safe-area-inset-top)', display: 'flex', flexDirection: 'column' }}
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}>
              <NavLinks pathname={pathname} onClose={() => setDrawerOpen(false)} onLogout={handleLogout} counts={counts} role={role} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
