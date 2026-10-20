'use client';

import { useEffect } from 'react';

const SURFACE = '#0a1628';
const BORDER  = '#1a3a5c';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const SANS    = 'Inter, system-ui, sans-serif';

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
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 448,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 24,
          maxHeight: '90vh',
          overflowY: 'auto',
          fontFamily: SANS,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: MUTED, cursor: 'pointer',
              fontSize: 22, lineHeight: 1, padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
