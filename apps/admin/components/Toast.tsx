'use client';

import { createContext, useCallback, useContext, useState } from 'react';

interface Toast { id: number; msg: string; type: 'ok' | 'err'; }
interface ToastCtx { success: (msg: string) => void; error: (msg: string) => void; }

const Ctx = createContext<ToastCtx>({ success: () => {}, error: () => {} });

export function useToast() { return useContext(Ctx); }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let next = 0;

  const push = useCallback((msg: string, type: Toast['type']) => {
    const id = ++next;
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <Ctx.Provider value={{ success: (m) => push(m, 'ok'), error: (m) => push(m, 'err') }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-xl text-sm shadow-lg border ${
              t.type === 'ok'
                ? 'bg-green-900/80 border-green-700 text-green-200'
                : 'bg-red-900/80 border-red-700 text-accent'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
