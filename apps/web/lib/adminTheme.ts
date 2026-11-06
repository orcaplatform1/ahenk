import type { CSSProperties } from 'react';

// Yönetim Paneli renk ve yazı tipi sabitleri (tek kaynak). Kart/başlık: globals.css .admin-shell + ll-card, ll-title
export const BG = '#020c1b';
export const SURFACE = '#0a1628';
export const CARD = '#0d1f3c';
export const BORDER = '#1a3a5c';
export const TEXT = '#e2e8f0';
export const MUTED = '#64748b';
export const RED = '#ef4444';
export const GREEN = '#22c55e';
export const AMBER = '#f59e0b';
export const BLUE = '#3b82f6';
export const CYAN = '#22d3ee';
export const SANS = 'var(--font-sans), system-ui, sans-serif';
export const MONO = 'var(--font-mono), monospace';

// Küçük etiket: Canlı Akış'taki mono not ile aynı
export const LABEL: CSSProperties = { fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em' };
