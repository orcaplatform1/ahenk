'use client';

import { useEffect } from 'react';

interface Props { open: boolean; onClose: () => void; title: string; children: React.ReactNode; }

export function Modal({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-medium">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-text text-2xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
