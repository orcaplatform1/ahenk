'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MasaTuru } from '@ahenk/ui';
import type { WeeklySelection } from './useMasaTabs';
import { Rings } from './LiveTabs';

// Haftalık buluşma seçimi: Pazar 23:59'dan sonra paketi olan kullanıcıya Eşleşme Paneli / Masalarım'da açılır.
// Paketinde kalan türlerden 1, 2 ya da 3'ünü seçer; yalnız seçtiği türlerin taramasına girer. Seçim değiştirilemez.
// Kart: solda eşleşme alanındaki tür ikonu (halkalar), sağda kalın başlık ve küçük alt metin
// title / text: çeviri anahtarı
const CARD: Record<MasaTuru, { title: string; text: string }> = {
  GROUP: { title: 'live.wsGroupTitle', text: 'live.wsGroupText' },
  ONE_ON_ONE: { title: 'live.wsOneTitle', text: 'live.wsOneText' },
  KANKA: { title: 'live.wsKankaTitle', text: 'live.wsKankaText' },
};

export default function WeeklySelectionModal({ selection, onSubmit }: { selection: WeeklySelection | null; onSubmit: (types: MasaTuru[]) => Promise<void> }) {
  const tr = useTranslations();
  const [picked, setPicked] = useState<MasaTuru[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [closed, setClosed] = useState(false);
  if (!selection?.showModal || closed) return null;

  const toggle = (t: MasaTuru) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  async function submit() {
    setSending(true); setError('');
    try { await onSubmit(picked); }
    catch (e) { setError((e as Error).message); }
    finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }} role="dialog" aria-modal="true" aria-labelledby="ws-title">
      <div className="ll-card w-full max-w-md flex flex-col gap-4" style={{ background: '#121212' }}>
        <h3 id="ws-title" className="ll-title">{tr('live.wsTitle')}</h3>
        <div className="flex flex-col gap-2">
          {selection.options.map((o) => {
            const on = picked.includes(o.type);
            return (
              <button
                key={o.type}
                onClick={() => o.open && toggle(o.type)}
                disabled={!o.open}
                aria-pressed={on}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left disabled:opacity-40"
                style={{ minHeight: 52, border: on ? '2px solid #d6453a' : '1px solid rgba(255,255,255,0.12)', background: on ? 'rgba(214,69,58,0.12)' : 'rgba(255,255,255,0.03)' }}
              >
                <span className="ll-ws-icon" style={{ flexShrink: 0, display: 'flex' }}><Rings type={o.type} /></span>
                <span className="flex flex-col gap-1 min-w-0">
                  <span className="text-sm font-bold text-[#f4f1ec]">{tr(CARD[o.type].title)}</span>
                  <span className="text-xs text-[#a39c93]" style={{ lineHeight: 1.45 }}>{tr(CARD[o.type].text)}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[#a39c93]">{tr('live.wsNote')}</p>
        {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => setClosed(true)} className="btn-ghost flex-1 justify-center" style={{ minHeight: 44 }}>{tr('live.wsLater')}</button>
          <button onClick={submit} disabled={picked.length === 0 || sending} className="btn-primary flex-1 justify-center disabled:opacity-50" style={{ minHeight: 44 }}>
            {sending ? '…' : tr('live.wsConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
