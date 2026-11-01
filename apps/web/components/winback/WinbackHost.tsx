'use client';

import { useEffect, useRef, useState } from 'react';
import { clockMS, useWinback } from './useWinback';
import { WinbackScreen } from './WinbackScreen';

// Hakkı olan kullanıcıya ekranı ilk açılışta gösterir; badge açıkken üstte canlı sayaçlı rozet çıkar
export function WinbackHost({ badge = false }: { badge?: boolean }) {
  const { state, live, remaining, markShown } = useWinback();
  const [open, setOpen] = useState(false);
  const [merged, setMerged] = useState(false);
  const autoDone = useRef(false);

  useEffect(() => {
    if (!state?.active || !state.autoOpen || autoDone.current) return;
    autoDone.current = true;
    setOpen(true);
    markShown().catch(() => {});
  }, [state, markShown]);

  if (!state?.active || !live) return null;

  return (
    <>
      {badge && (
        <div className="relative z-10 flex justify-center px-4 mb-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{ padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, color: '#f5f5f5', background: 'rgba(214,69,58,0.14)', border: '1px solid rgba(200,116,60,0.6)', fontVariantNumeric: 'tabular-nums', cursor: 'pointer' }}
          >
            {state.amountTL}₺ indirimin · {clockMS(remaining)}
          </button>
        </div>
      )}
      {open && (
        <WinbackScreen state={state} remaining={remaining} merged={merged} onMerge={() => setMerged(true)} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
