'use client';

import { useEffect, useRef, useState } from 'react';

// Kayıt formundaki doğum tarihi seçici (gün / ay / yıl); kariyer formu da bunu kullanır

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function PickerColumn({ title, options, selected, onSelect }: {
  title: string;
  options: { value: number; label: string }[];
  selected: number;
  onSelect: (v: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // Seçili öğeye scroll et
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-sel="1"]') as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [selected]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <p className="ll-mono" style={{ textAlign: 'center', fontSize: 11, color: '#a39c93', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</p>
      <div
        ref={listRef}
        style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}
      >
        {options.map(opt => {
          const isSel = opt.value === selected;
          return (
            <div
              key={opt.value}
              data-sel={isSel ? '1' : '0'}
              onClick={() => onSelect(opt.value)}
              style={{
                padding: '11px 6px',
                textAlign: 'center',
                fontSize: 15,
                color: isSel ? '#ff6b6b' : '#a39c93',
                fontWeight: isSel ? 600 : 400,
                background: isSel ? 'rgba(192,57,43,0.12)' : 'transparent',
                borderRadius: 8,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                transition: 'color 0.1s, background 0.1s',
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

function DatePickerModal({ value, onChange, onClose }: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const now = new Date();
  const maxYear = now.getFullYear() - 18;
  const minYear = 1965; // en eski doğum tarihi 01.01.1965

  const parts = value ? value.split('-').map(Number) : [0, 0, 0];
  const [tmpYear,  setTmpYear]  = useState(parts[0] || maxYear);
  const [tmpMonth, setTmpMonth] = useState(parts[1] || 1);
  const [tmpDay,   setTmpDay]   = useState(parts[2] || 1);

  const daysInMonth = new Date(tmpYear, tmpMonth, 0).getDate();
  const dayOpts   = Array.from({ length: daysInMonth }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  const monthOpts = MONTHS_TR.map((m, i) => ({ value: i + 1, label: m }));
  const yearOpts  = Array.from({ length: maxYear - minYear + 1 }, (_, i) => ({ value: maxYear - i, label: String(maxYear - i) }));

  // Ay değişince gün sınırını koru
  useEffect(() => {
    const max = new Date(tmpYear, tmpMonth, 0).getDate();
    if (tmpDay > max) setTmpDay(max);
  }, [tmpMonth, tmpYear]);

  function confirm() {
    const safeDay = Math.min(tmpDay, new Date(tmpYear, tmpMonth, 0).getDate());
    onChange(`${tmpYear}-${String(tmpMonth).padStart(2,'0')}-${String(safeDay).padStart(2,'0')}`);
    onClose();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.08)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: '20px 16px 36px',
        }}
      >
        {/* Başlık */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#a39c93' }}>Doğum tarihi seç</p>
          <button
            onClick={onClose}
            style={{ color: '#a39c93', fontSize: 20, lineHeight: 1, background: 'none', outline: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
          >×</button>
        </div>

        {/* Üç kolon */}
        <div style={{ display: 'flex', gap: 8, height: 220 }}>
          <PickerColumn title="Gün"   options={dayOpts}   selected={tmpDay}   onSelect={setTmpDay}   />
          <PickerColumn title="Ay"    options={monthOpts} selected={tmpMonth} onSelect={setTmpMonth} />
          <PickerColumn title="Yıl"   options={yearOpts}  selected={tmpYear}  onSelect={setTmpYear}  />
        </div>

        {/* Onayla */}
        <button
          onClick={confirm}
          className="btn-primary w-full justify-center"
          style={{ marginTop: 20 }}
        >
          Seç
        </button>
      </div>
    </div>
  );
}

/* ── OccupationPickerModal ───────────────────────────────────────────────── */

export function DateField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  let display = 'Doğum tarihi seç';
  if (value) {
    const [y, m, d] = value.split('-').map(Number);
    display = `${d} ${MONTHS_TR[m - 1]} ${y}`;
  }

  return (
    <div>
      <label className="block ll-mono text-[11px] text-[#a39c93] mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: '14px 16px',
          fontSize: 13,
          color: value ? '#f5f5f5' : '#a39c93',
          textAlign: 'left',
          cursor: 'pointer',
          outline: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {display}
      </button>
      {open && <DatePickerModal value={value} onChange={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}
