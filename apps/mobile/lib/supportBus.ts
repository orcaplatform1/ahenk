// Canlı Destek baloncuğu (components/SupportBubble.tsx) için olay: sohbet başlatılınca / küçültülünce durum yeniden okunur
type Fn = () => void;
const subs = new Set<Fn>();
export function onSupportChange(fn: Fn) { subs.add(fn); return () => { subs.delete(fn); }; }
export function emitSupportChange() { subs.forEach((f) => f()); }
