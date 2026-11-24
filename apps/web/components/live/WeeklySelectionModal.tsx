'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MasaTuru } from '@ahenk/ui';
import type { MeetingMode, WeeklySelection } from './useMasaTabs';
import { Rings } from './LiveTabs';
import { StdButton } from '@ahenk/ui';

// Seçim ekranı: "Buluşma Türü" (Yarın Buluşma / Hafta Sonu Buluşma, tek seçim) + "Masa Türü" (Grup / Baş Başa / Kankamla, çoklu).
// Paket alınınca ve girişte, taramada ya da masada olmayan kullanılmamış hak varsa kendiliğinden açılır; Eşleşme Paneli'ndeki
// karttan da açılır. Yalnız kullanılmamış hakkı olan (ve henüz kaydı / masası olmayan) türler seçilebilir, diğerleri pasif.
// Kart: solda eşleşme alanındaki tür ikonu (halkalar), sağda kalın başlık ve küçük alt metin
// title / text: çeviri anahtarı
const CARD: Record<MasaTuru, { title: string; text: string }> = {
  GROUP: { title: 'live.wsGroupTitle', text: 'live.wsGroupText' },
  ONE_ON_ONE: { title: 'live.wsOneTitle', text: 'live.wsOneText' },
  KANKA: { title: 'live.wsKankaTitle', text: 'live.wsKankaText' },
};
const MODES: { mode: MeetingMode; label: string }[] = [
  { mode: 'TOMORROW', label: 'live.modeTomorrow' },
  { mode: 'PLANNED', label: 'live.modeWeekend' },
];

const selectedStyle = (on: boolean) => ({
  minHeight: 52,
  border: on ? '2px solid #d6453a' : '1px solid rgba(255,255,255,0.12)',
  background: on ? 'rgba(214,69,58,0.12)' : 'rgba(255,255,255,0.03)',
});

export default function WeeklySelectionModal({ selection, onSubmit, open, onClose }: {
  selection: WeeklySelection | null;
  onSubmit: (mode: MeetingMode, types: MasaTuru[]) => Promise<void>;
  open?: boolean;
  onClose?: () => void;
}) {
  const tr = useTranslations();
  const [mode, setMode] = useState<MeetingMode | null>(null);
  const [picked, setPicked] = useState<MasaTuru[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [closed, setClosed] = useState(false);
  const visible = !!selection && (open || (selection.showModal && !closed));

  useEffect(() => {
    if (visible) { setMode(null); setPicked([]); setError(''); }
  }, [visible]);
  if (!visible || !selection) return null;

  const selectable = (o: WeeklySelection['options'][number]) => o.hasRight && !o.selection && !o.seated;
  const toggle = (t: MasaTuru) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const close = () => { setClosed(true); onClose?.(); };
  async function submit() {
    if (!mode) return;
    setSending(true); setError('');
    try { await onSubmit(mode, picked); close(); }
    catch (e) { setError((e as Error).message); }
    finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }} role="dialog" aria-modal="true" aria-labelledby="ws-title">
      <div className="ll-card w-full max-w-md flex flex-col gap-4" style={{ background: '#121212' }}>
        <h3 id="ws-title" className="ll-title">{tr('live.selModeLabel')}</h3>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="ws-title">
          {MODES.map((m) => (
            <button
              key={m.mode}
              role="radio"
              aria-checked={mode === m.mode}
              onClick={() => setMode(m.mode)}
              className="rounded-xl px-3 py-3 text-sm font-bold text-[#f4f1ec]"
              style={selectedStyle(mode === m.mode)}
            >
              {tr(m.label)}
            </button>
          ))}
        </div>
        <h3 className="ll-title">{tr('live.selTypeLabel')}</h3>
        <div className="flex flex-col gap-2">
          {selection.options.map((o) => {
            const on = picked.includes(o.type);
            const enabled = selectable(o);
            return (
              <button
                key={o.type}
                onClick={() => enabled && toggle(o.type)}
                disabled={!enabled}
                aria-pressed={on}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left disabled:opacity-40"
                style={selectedStyle(on)}
              >
                <span className="ll-ws-icon" style={{ flexShrink: 0, display: 'flex' }}><Rings type={o.type} /></span>
                <span className="flex flex-col gap-1 min-w-0">
                  <span className="text-sm font-bold text-[#f4f1ec]">{tr(CARD[o.type].title)}</span>
                  <span className="text-xs text-[#a39c93]" style={{ lineHeight: 1.45 }}>
                    {tr(mode === 'TOMORROW' ? 'live.selTomorrowText' : CARD[o.type].text)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}
        <div className="flex gap-2">
          <StdButton variant="ghost" onClick={close} className="flex-1 justify-center">{tr('live.wsLater')}</StdButton>
          <StdButton variant="primary" onClick={submit} disabled={!mode || picked.length === 0 || sending} className="flex-1 justify-center disabled:opacity-50">
            {sending ? '…' : tr('live.wsConfirm')}
          </StdButton>
        </div>
      </div>
    </div>
  );
}
