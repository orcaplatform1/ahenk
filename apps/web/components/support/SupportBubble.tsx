'use client';

// Canlı Destek baloncuğu (üye sayfaları ve mekân paneli; yönetim panelinde yok). Yalnız açık destek sohbeti varken (Canlı Destek'ten
// başlatılmış, kuyrukta ya da temsilcide) sağ altta sabit görünür, sürüklenmez. Kuyruktayken sıra numarası, yeni mesajda okunmamış
// sayı rozeti. Basınca sohbet ekranı açılır. Sohbet herhangi bir şekilde kapanınca kaybolur. Sohbet ekranındayken gizli.
// Yoklama yalnız açık sohbet varken (4 sn); sayfa açılışında ve sohbet başlatılınca / küçültülünce bir kez okunur. Okundu yazmaz.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { venueApi } from '@/lib/venueApi';
import { SUPPORT_EVENT } from './SupportChatScreen';

export interface SupportSummary { chat: { id: string; status: 'QUEUED' | 'ACTIVE'; position: number | null; unread: number } | null }

export function SupportBubble({ mode }: { mode: 'member' | 'venue' }) {
  const t = useTranslations();
  const path = usePathname();
  const [sum, setSum] = useState<SupportSummary['chat']>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatPath = mode === 'member' ? '/canli-destek' : '/mekan/panel/canli-destek';
  // Üye baloncuğu mekân paneli sayfalarında çıkmaz (orada mekân baloncuğu var)
  const hidden = path === chatPath || (mode === 'member' && path.startsWith('/mekan'));

  const load = useCallback(async () => {
    if (mode === 'member' && !api.hasSession()) { setSum(null); return; }
    try {
      const r = mode === 'member' ? await api.silentGet<SupportSummary>('/support/summary') : await venueApi.get<SupportSummary>('/support/summary');
      setSum(r?.chat ?? null);
    } catch { /* oturum yok ya da ağ hatası: ekrandaki durum korunur */ }
  }, [mode]);

  useEffect(() => {
    if (hidden) return;
    load();
    const on = () => load();
    window.addEventListener(SUPPORT_EVENT, on);
    return () => window.removeEventListener(SUPPORT_EVENT, on);
  }, [load, hidden, path]);

  // Açık sohbet varken yoklama; yoksa durur
  useEffect(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (sum && !hidden) timer.current = setInterval(load, 4000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [!!sum, hidden, load]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sum || hidden) return null;
  const label = [t('sup.bubble'), sum.status === 'QUEUED' && sum.position ? t('sup.bubbleQueue', { pos: sum.position }) : '', sum.unread ? t('sup.bubbleUnread', { n: sum.unread }) : ''].filter(Boolean).join(', ');
  return (
    <>
      <style>{`.sup-bubble{position:fixed;right:16px;bottom:calc(env(safe-area-inset-bottom) + 60px);z-index:45}@media(min-width:768px){.sup-bubble{right:24px;bottom:24px}}`}</style>
      <Link href={chatPath} aria-label={label} className="sup-bubble"
        style={{ width: 56, height: 56, borderRadius: 28, background: '#c0392b', boxShadow: '0 6px 20px rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
        {sum.status === 'QUEUED' && sum.position ? (
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{sum.position}</span>
        ) : (
          <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {sum.unread > 0 && (
          <span aria-hidden style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10, background: '#f4f1ec', color: '#c0392b', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #121212' }}>
            {sum.unread > 99 ? '99+' : sum.unread}
          </span>
        )}
      </Link>
    </>
  );
}
