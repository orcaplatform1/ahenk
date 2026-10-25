'use client';

import { useState } from 'react';

// Admin paneli renklerinde seçim kutusu: telefonun kendi seçim listesi yerine panel içinde açılan liste
const BG      = '#020c1b';
const CARD    = '#0d1f3c';
const BORDER  = '#1a3a5c';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const BLUE    = '#3b82f6';
const SANS    = 'Inter, system-ui, sans-serif';

export interface AdminSelectOption { value: string; label: string; group?: string }

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: AdminSelectOption[];
  placeholder: string;
  title?: string;
  style?: React.CSSProperties;
}

export function AdminSelect({ value, onChange, options, placeholder, title, style }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
          padding: '7px 12px', fontSize: 12, color: selected ? TEXT : MUTED, textAlign: 'left',
          fontFamily: SANS, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          boxSizing: 'border-box', ...style,
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{ color: MUTED, fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, width: '100%', maxWidth: 360, maxHeight: '75vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', fontFamily: SANS }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{title ?? placeholder}</span>
              <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: MUTED, padding: 2 }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: 6 }}>
              {options.map((o, i) => {
                const active = o.value === value;
                const showGroup = o.group && o.group !== options[i - 1]?.group;
                return (
                  <div key={o.value || '__empty'}>
                    {showGroup && (
                      <p style={{ margin: '10px 10px 4px', fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>
                        {o.group!.toLocaleUpperCase('tr-TR')}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => { onChange(o.value); setOpen(false); }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                        background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                        border: `1px solid ${active ? 'rgba(59,130,246,0.35)' : 'transparent'}`,
                        fontSize: 13, color: active ? BLUE : TEXT, fontFamily: SANS,
                      }}
                    >
                      {o.label}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
