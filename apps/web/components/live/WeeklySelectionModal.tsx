'use client';

import { useState } from 'react';
import type { MasaTuru } from '@ahenk/ui';
import type { WeeklySelection } from './useMasaTabs';

// Haftalık buluşma seçimi: Pazar 23:59'dan sonra paketi olan kullanıcıya Eşleşme Paneli / Masalarım'da açılır.
// Paketinde kalan türlerden 1, 2 ya da 3'ünü seçer; yalnız seçtiği türlerin taramasına girer. Seçim değiştirilemez.
const LABEL: Record<MasaTuru, string> = { GROUP: 'Grup', ONE_ON_ONE: 'Başbaşa', KANKA: 'Kankamla' };
const DEADLINE_TEXT: Record<MasaTuru, string> = { GROUP: 'Perşembe 18:00', ONE_ON_ONE: 'Cuma 18:00', KANKA: 'Cumartesi 18:00' };

export default function WeeklySelectionModal({ selection, onSubmit }: { selection: WeeklySelection | null; onSubmit: (types: MasaTuru[]) => Promise<void> }) {
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
        <h3 id="ws-title" className="ll-title">Bu hafta hangi buluşmalara katılmak istersin?</h3>
        <div className="flex flex-col gap-2">
          {selection.options.map((o) => {
            const on = picked.includes(o.type);
            return (
              <button
                key={o.type}
                onClick={() => o.open && toggle(o.type)}
                disabled={!o.open}
                aria-pressed={on}
                className="flex items-center justify-between rounded-xl px-4 text-left disabled:opacity-40"
                style={{ minHeight: 52, border: on ? '2px solid #d6453a' : '1px solid rgba(255,255,255,0.12)', background: on ? 'rgba(214,69,58,0.12)' : 'rgba(255,255,255,0.03)' }}
              >
                <span className="text-sm font-semibold text-[#f4f1ec]">{LABEL[o.type]}</span>
                <span className="text-xs text-[#a39c93]">{o.open ? `Son seçim: ${DEADLINE_TEXT[o.type]}` : 'Süre doldu'}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[#a39c93]">Seçimini sonradan değiştiremezsin. Seçmediğin türün taramasına girmezsin, hakkın düşmez.</p>
        {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => setClosed(true)} className="btn-ghost flex-1 justify-center" style={{ minHeight: 44 }}>Sonra</button>
          <button onClick={submit} disabled={picked.length === 0 || sending} className="btn-primary flex-1 justify-center disabled:opacity-50" style={{ minHeight: 44 }}>
            {sending ? '…' : 'Seçimi Onayla'}
          </button>
        </div>
      </div>
    </div>
  );
}
