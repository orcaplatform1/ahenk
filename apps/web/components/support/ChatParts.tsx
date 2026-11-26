'use client';

// Canlı Destek ortak sohbet parçaları: kullanıcı / mekân ekranı (SupportChatScreen) ve temsilci ekranı (app/admin/canli-destek)
// aynı ikonları, mesaj kutusunu ve durum etiketini kullanır (mobil components/SupportChatParts.tsx karşılığı).
import { useEffect, useRef } from 'react';

const RED = '#c0392b';
const TEXT = '#f4f1ec';

export function AttachIcon({ color }: { color: string }) {
  return <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={3} width={18} height={18} rx={3} /><circle cx={8.5} cy={8.5} r={1.5} /><path d="m21 15-5-5L5 21" /></svg>;
}
export function EmojiIcon({ color }: { color: string }) {
  return <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round"><circle cx={12} cy={12} r={9.5} /><path d="M8 14.5s1.5 2 4 2 4-2 4-2" /><path d="M9 9.5h.01M15 9.5h.01" strokeWidth={2.4} /></svg>;
}
export function SendIcon() {
  return (
    <span style={{ width: 38, height: 38, borderRadius: 19, background: RED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></svg>
    </span>
  );
}
// Yazdıkça en fazla 5 satıra kadar büyür (satır 20 px), sonra kaydırır
const LINE = 20;
export function AutoTextarea({ value, onChange, onEnter, color = TEXT, enterSends = true }: { value: string; onChange: (v: string) => void; onEnter: () => void; color?: string; enterSends?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, LINE * 5 + 20)}px`;
  }, [value]);
  return (
    <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={1}
      onKeyDown={(e) => { if (enterSends && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnter(); } }}
      style={{ flex: 1, minWidth: 0, resize: 'none', minHeight: 44, padding: '12px 6px', lineHeight: `${LINE}px`, border: 'none', background: 'transparent', color, fontSize: 14, outline: 'none', overflowY: 'auto' }} />
  );
}
// Durum etiketi: Çevrimiçi yeşil, Çevrimdışı gri, yazıyor Ahenk kırmızısı
const PILL = {
  online: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.45)' },
  offline: { color: '#a39c93', bg: 'rgba(163,156,147,0.12)', border: 'rgba(163,156,147,0.4)' },
  typing: { color: '#f4f1ec', bg: 'rgba(192,57,43,0.22)', border: 'rgba(192,57,43,0.6)' },
} as const;
export function StatusPill({ status, label }: { status: keyof typeof PILL; label: string }) {
  const p = PILL[status];
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, lineHeight: '16px', whiteSpace: 'nowrap', color: p.color, background: p.bg, border: `1px solid ${p.border}` }}>{label}</span>;
}
