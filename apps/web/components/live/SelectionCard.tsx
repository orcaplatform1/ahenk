'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MasaTuru } from '@ahenk/ui';
import type { MeetingMode, WeeklySelection } from './useMasaTabs';
import { Rings } from './LiveTabs';

const TITLE: Record<MasaTuru, string> = { GROUP: 'live.wsGroupTitle', ONE_ON_ONE: 'live.wsOneTitle', KANKA: 'live.wsKankaTitle' };
const MODE_LABEL: Record<MeetingMode, string> = { TOMORROW: 'live.modeTomorrow', PLANNED: 'live.modeWeekend' };

// Eşleşme Paneli kartı: seçim ekranını açar; seçim değiştirme (buluşma türü) ve iptal yalnız buradan yapılır.
// Kilitten önce değiştirme / iptal serbest, hak yanmaz; kilitlenmiş masada butonlar kapalı.
export default function SelectionCard({ selection, onOpen, onChange, onCancel }: {
  selection: WeeklySelection | null;
  onOpen: () => void;
  onChange: (type: MasaTuru, mode: MeetingMode) => Promise<void>;
  onCancel: (type: MasaTuru) => Promise<void>;
}) {
  const tr = useTranslations();
  const [busy, setBusy] = useState<MasaTuru | null>(null);
  const [error, setError] = useState('');
  if (!selection) return null;
  const rows = selection.options.filter((o) => o.selection || o.seated);
  const canPick = selection.options.some((o) => o.hasRight && !o.selection && !o.seated);
  if (rows.length === 0 && !canPick) return null;

  async function run(type: MasaTuru, fn: () => Promise<void>) {
    setBusy(type); setError('');
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 mb-4 relative z-10">
      <div className="ll-card flex flex-col gap-3">
        <h3 className="ll-title">{tr('live.selCardTitle')}</h3>
        {rows.map((o) => {
          const sel = o.selection;
          const note = o.locked ? 'live.selLocked' : sel?.kankaWaiting ? 'live.selKankaWaiting' : sel?.nextWeek ? 'live.selNextWeek' : null;
          return (
            <div key={o.type} className="flex items-center gap-3 rounded-xl px-3 py-3" style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}>
              <span className="ll-ws-icon" style={{ flexShrink: 0, display: 'flex' }}><Rings type={o.type} /></span>
              <span className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="text-sm font-bold text-[#f4f1ec]">{tr(TITLE[o.type])}</span>
                <span className="text-xs text-[#a39c93]">
                  {[sel ? tr(MODE_LABEL[sel.mode]) : null, note ? tr(note) : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              {sel && !o.locked && (
                <span className="flex gap-2 shrink-0">
                  <button
                    onClick={() => run(o.type, () => onChange(o.type, sel.mode === 'TOMORROW' ? 'PLANNED' : 'TOMORROW'))}
                    disabled={busy !== null}
                    className="btn-ghost justify-center disabled:opacity-50 text-xs"
                    style={{ minHeight: 44 }}
                  >
                    {tr('live.selChange')}
                  </button>
                  <button
                    onClick={() => run(o.type, () => onCancel(o.type))}
                    disabled={busy !== null}
                    className="btn-ghost justify-center disabled:opacity-50 text-xs"
                    style={{ minHeight: 44 }}
                  >
                    {tr('live.selCancel')}
                  </button>
                </span>
              )}
            </div>
          );
        })}
        {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}
        {canPick && (
          <button onClick={onOpen} className="btn-primary justify-center" style={{ minHeight: 44 }}>{tr('live.selOpen')}</button>
        )}
      </div>
    </div>
  );
}
