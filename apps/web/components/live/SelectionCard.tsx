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
  // Değiştir / İptal Et önce onay penceresi açar; "Evet" mevcut akışı çalıştırır
  const [confirm, setConfirm] = useState<{ kind: 'change' | 'cancel'; type: MasaTuru; mode: MeetingMode } | null>(null);
  if (!selection) return null;
  const rows = selection.options.filter((o) => o.selection || o.seated);
  const canPick = selection.options.some((o) => o.hasRight && !o.selection && !o.seated);
  if (rows.length === 0 && !canPick) return null;

  async function run(type: MasaTuru, fn: () => Promise<void>) {
    setBusy(type); setError('');
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  // Görünüm mobil components/SelectionCard.tsx ile aynı: kart (llCard), başlık, satırlar (ikon + başlık + alt metin, altında
  // eşit genişlikte iki buton), en altta tam genişlikte "Seçim Yap"
  return (
    <div className="ll-card flex flex-col" style={{ gap: 12 }}>
      <h3 className="ll-title">{tr('live.selCardTitle')}</h3>
      {rows.map((o) => {
        const sel = o.selection;
        const note = o.locked ? 'live.selLocked' : sel?.kankaWaiting ? 'live.selKankaWaiting' : sel?.nextWeek ? 'live.selNextWeek' : null;
        const sub = [sel ? tr(MODE_LABEL[sel.mode]) : null, note ? tr(note) : null].filter(Boolean).join(' · ');
        return (
          <div key={o.type} className="flex flex-col" style={{ gap: 10, borderRadius: 12, padding: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center" style={{ gap: 12 }}>
              <span className="ll-ws-icon" style={{ flexShrink: 0, display: 'flex' }}><Rings type={o.type} /></span>
              <span className="flex flex-col min-w-0 flex-1" style={{ gap: 4 }}>
                <span className="font-bold text-[#f4f1ec]" style={{ fontSize: 14 }}>{tr(TITLE[o.type])}</span>
                {sub && <span className="text-[#a39c93]" style={{ fontSize: 12 }}>{sub}</span>}
              </span>
            </div>
            {sel && !o.locked && (
              <div className="flex" style={{ gap: 8 }}>
                <button
                  onClick={() => setConfirm({ kind: 'change', type: o.type, mode: sel.mode === 'TOMORROW' ? 'PLANNED' : 'TOMORROW' })}
                  disabled={busy !== null}
                  className="btn-ghost flex-1 justify-center disabled:opacity-50"
                  style={{ minHeight: 44 }}
                >
                  {tr('live.selChange')}
                </button>
                <button
                  onClick={() => setConfirm({ kind: 'cancel', type: o.type, mode: sel.mode })}
                  disabled={busy !== null}
                  className="btn-ghost flex-1 justify-center disabled:opacity-50"
                  style={{ minHeight: 44 }}
                >
                  {tr('live.selCancel')}
                </button>
              </div>
            )}
          </div>
        );
      })}
      {error && <p className="text-[#ff6b6b]" style={{ fontSize: 12, margin: 0 }}>{error}</p>}
      {canPick && (
        <button onClick={onOpen} className="btn-primary w-full justify-center" style={{ minHeight: 44 }}>{tr('live.selOpen')}</button>
      )}
      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }} role="dialog" aria-modal="true" aria-labelledby="sel-confirm-title" onClick={() => setConfirm(null)}>
          <div className="ll-card w-full max-w-md flex flex-col gap-4" style={{ background: '#121212' }} onClick={(e) => e.stopPropagation()}>
            <h3 id="sel-confirm-title" className="ll-title">{tr(confirm.kind === 'change' ? 'live.selChangeConfirm' : 'live.selCancelConfirm')}</h3>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} className="btn-ghost flex-1 justify-center" style={{ minHeight: 44 }}>{tr('live.selConfirmNo')}</button>
              <button
                onClick={() => {
                  const c = confirm;
                  setConfirm(null);
                  void run(c.type, () => (c.kind === 'change' ? onChange(c.type, c.mode) : onCancel(c.type)));
                }}
                className="btn-primary flex-1 justify-center"
                style={{ minHeight: 44 }}
              >
                {tr(confirm.kind === 'change' ? 'live.selConfirmChangeYes' : 'live.selConfirmCancelYes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
