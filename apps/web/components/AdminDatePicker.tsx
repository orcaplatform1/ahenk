'use client';

import { useEffect, useRef, useState } from 'react';

// Admin paneli renklerinde doğum tarihi seçici (kayıt sayfasındaki gün / ay / yıl seçimiyle aynı yapı).
// Yıllar 1965'ten (en eski doğum tarihi 01.01.1965) 18 yaş sınırına kadar.
const BG     = '#020c1b';
const CARD   = '#0d1f3c';
const BORDER = '#1a3a5c';
const TEXT   = '#e2e8f0';
const MUTED  = '#64748b';
const BLUE   = '#3b82f6';
const CYAN   = '#22d3ee';
const SANS   = 'Inter, system-ui, sans-serif';

const MIN_YEAR = 1965;
const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function Column({ title, options, selected, onSelect }: {
  title: string;
  options: { value: number; label: string }[];
  selected: number;
  onSelect: (v: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-sel="1"]') as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [selected]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
      <p style={{ textAlign: 'center', fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED, margin: '0 0 8px' }}>{title}</p>
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
        {options.map(opt => {
          const isSel = opt.value === selected;
          return (
            <div
              key={opt.value}
              data-sel={isSel ? '1' : '0'}
              onClick={() => onSelect(opt.value)}
              style={{
                padding: '10px 4px', textAlign: 'center', fontSize: 14, borderRadius: 8, cursor: 'pointer',
                color: isSel ? BLUE : TEXT, fontWeight: isSel ? 700 : 400,
                background: isSel ? 'rgba(59,130,246,0.15)' : 'transparent',
                border: `1px solid ${isSel ? 'rgba(59,130,246,0.35)' : 'transparent'}`,
              }}
            >
              {opt.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminDatePicker({ value, onChange, placeholder = 'Doğum tarihi' }: {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const maxYear = new Date().getFullYear() - 18;

  const parts = value ? value.split('-').map(Number) : [0, 0, 0];
  const [year, setYear]   = useState(parts[0] || maxYear);
  const [month, setMonth] = useState(parts[1] || 1);
  const [day, setDay]     = useState(parts[2] || 1);

  // Açılışta mevcut değer seçili gelir
  function openPicker() {
    const p = value ? value.split('-').map(Number) : [0, 0, 0];
    setYear(p[0] || maxYear); setMonth(p[1] || 1); setDay(p[2] || 1);
    setOpen(true);
  }

  // Ay / yıl değişince gün sınırını koru
  useEffect(() => {
    const max = new Date(year, month, 0).getDate();
    if (day > max) setDay(max);
  }, [month, year]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayOpts   = Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  const monthOpts = MONTHS_TR.map((m, i) => ({ value: i + 1, label: m }));
  const yearOpts  = Array.from({ length: maxYear - MIN_YEAR + 1 }, (_, i) => ({ value: maxYear - i, label: String(maxYear - i) }));

  function confirm() {
    const safeDay = Math.min(day, new Date(year, month, 0).getDate());
    onChange(`${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`);
    setOpen(false);
  }

  const display = value ? value.split('-').reverse().join('.') : '';

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        style={{
          width: '100%', background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
          padding: '7px 12px', fontSize: 12, color: display ? TEXT : MUTED, textAlign: 'left',
          fontFamily: SANS, cursor: 'pointer', boxSizing: 'border-box',
        }}
      >
        {display || placeholder}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, width: '100%', maxWidth: 360, padding: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', fontFamily: SANS }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Doğum tarihi seç</span>
              <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: MUTED, padding: 2 }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 6, height: 220 }}>
              <Column title="GÜN" options={dayOpts}   selected={day}   onSelect={setDay} />
              <Column title="AY"  options={monthOpts} selected={month} onSelect={setMonth} />
              <Column title="YIL" options={yearOpts}  selected={year}  onSelect={setYear} />
            </div>
            <button
              type="button"
              onClick={confirm}
              style={{
                width: '100%', marginTop: 14, padding: '9px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)',
                fontSize: 12, fontWeight: 700, color: CYAN, fontFamily: SANS,
              }}
            >
              Seç
            </button>
          </div>
        </div>
      )}
    </>
  );
}
