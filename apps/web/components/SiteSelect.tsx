'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Sitenin koyu paletinde seçim kutusu: telefonun kendi seçicisi yerine sayfa içinde açılır.
// Liste body'ye taşınır; böylece kart/animasyon kapsayıcıları içinde kesilmez.
export interface SiteSelectOption { value: string; label: string }

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: (SiteSelectOption | string)[];
  placeholder?: string;
  required?: boolean;
  ariaLabel?: string;
  searchable?: boolean; // Uzun listelerde üstte arama kutusu
  searchPlaceholder?: string;
}

const LIST_MAX_HEIGHT = 280;

export default function SiteSelect({ value, onChange, options, placeholder = 'Seçin...', required, ariaLabel, searchable, searchPlaceholder = 'Ara...' }: Props) {
  const allItems: SiteSelectOption[] = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const [search, setSearch] = useState('');
  const needle = search.trim().toLocaleLowerCase('tr-TR');
  const items = needle ? allItems.filter((o) => o.label.toLocaleLowerCase('tr-TR').includes(needle)) : allItems;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number }>({ left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const id = useId();
  const selected = allItems.find((o) => o.value === value);

  const place = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    // Altta yer yoksa ve üstte daha çok varsa yukarı açılır
    if (below < Math.min(LIST_MAX_HEIGHT, allItems.length * 46) && r.top > below) {
      setPos({ left: r.left, width: r.width, bottom: window.innerHeight - r.top + 6 });
    } else {
      setPos({ left: r.left, width: r.width, top: r.bottom + 6 });
    }
  }, [allItems.length]);

  function show() {
    place();
    setSearch('');
    setActive(Math.max(0, allItems.findIndex((o) => o.value === value)));
    setOpen(true);
    if (searchable) requestAnimationFrame(() => searchRef.current?.focus());
  }

  function choose(i: number) {
    onChange(items[i].value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function outside(e: PointerEvent) {
      const t = e.target as Node;
      if (!buttonRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(items.length - 1); }
    else if (e.key === 'Enter' || (e.key === ' ' && !searchable)) { e.preventDefault(); if (items[active]) choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); buttonRef.current?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
    else if (e.key.length === 1 && !searchable) {
      // Harfle arama
      const now = Date.now();
      const text = (now - typed.current.at > 700 ? '' : typed.current.text) + e.key.toLocaleLowerCase('tr-TR');
      typed.current = { text, at: now };
      const hit = items.findIndex((o) => o.label.toLocaleLowerCase('tr-TR').startsWith(text));
      if (hit >= 0) setActive(hit);
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        style={{
          width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.08)', border: `1px solid ${open ? '#c0392b' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 10, padding: '0.7rem 1rem', color: selected ? '#f5f5f5' : '#666',
          fontSize: '0.9rem', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', outline: 'none',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <span aria-hidden style={{ color: '#ff6b6b', fontSize: '0.7rem', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
      </button>

      {/* Tarayıcının zorunlu alan uyarısı için; görünmez ve odak almaz */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => undefined}
          onFocus={() => buttonRef.current?.focus()}
          style={{ position: 'absolute', bottom: 0, left: '50%', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
      )}

      {open && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed', zIndex: 200, left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom,
            boxSizing: 'border-box', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.6)', fontFamily: 'var(--font-sans, system-ui)', overflow: 'hidden',
          }}
        >
          {searchable && (
            <div style={{ padding: 6, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setActive(0); }}
                onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                style={{ width: '100%', minHeight: 40, boxSizing: 'border-box', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0 0.75rem', color: '#f5f5f5', fontSize: 16, outline: 'none' }}
              />
            </div>
          )}
        <ul
          ref={listRef}
          id={id}
          role="listbox"
          style={{ maxHeight: searchable ? LIST_MAX_HEIGHT - 54 : LIST_MAX_HEIGHT, overflowY: 'auto', margin: 0, padding: 6, listStyle: 'none', boxSizing: 'border-box' }}
        >
          {items.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li
                key={o.value || '__empty'}
                id={`${id}-${i}`}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                style={{
                  minHeight: 44, display: 'flex', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: 8,
                  cursor: 'pointer', fontSize: '0.9rem', boxSizing: 'border-box',
                  color: isSelected ? '#ff6b6b' : '#f5f5f5',
                  background: i === active ? 'rgba(192,57,43,0.18)' : 'transparent',
                }}
              >
                {o.label}
              </li>
            );
          })}
        </ul>
          {items.length === 0 && <p style={{ margin: 0, padding: '0.75rem', fontSize: '0.85rem', color: '#888' }}>Sonuç yok</p>}
        </div>,
        document.body,
      )}
    </div>
  );
}
