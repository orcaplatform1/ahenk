'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MasaTuru } from '@ahenk/ui';
import type { MeetingMode, WeeklySelection } from './useMasaTabs';
import { Rings } from './LiveTabs';
import { StdButton } from '@ahenk/ui';

// Kalan süre: X saat Y dakika (dakika yukarı yuvarlanır)
function changeIn(ms: number): { h: number; m: number } {
  const total = Math.max(1, Math.ceil(ms / 60000));
  return { h: Math.floor(total / 60), m: total % 60 };
}

// İptal kilidi metni iki satır: sabit "İptal ettiğin için 24 saat ..." ve geri sayım (backend cancelCooldownUntil) "Yeni katılıma kalan
// süre: X saat Y dakika" (1 saat altı yalnız "Y dakika");
// saniye yok, dakika yukarı yuvarlanır (0 dakika gösterilmez). Değer dakika sınırında değişir; süre dolunca metin kalkar, Seçim Yap açılır
function cooldownKey(ms: number): ['live.selReasonCooldownHm' | 'live.selReasonCooldownM', { h: number; m: number }] {
  const r = changeIn(ms);
  return [r.h >= 1 ? 'live.selReasonCooldownHm' : 'live.selReasonCooldownM', r];
}

const TITLE: Record<MasaTuru, string> = { GROUP: 'live.wsGroupTitle', ONE_ON_ONE: 'live.wsOneTitle', KANKA: 'live.wsKankaTitle' };
const MODE_LABEL: Record<MeetingMode, string> = { TOMORROW: 'live.modeTomorrow', PLANNED: 'live.modeWeekend' };

// Eşleşme Paneli kartı: seçim ekranını açar; seçim değiştirme (buluşma türü) ve iptal yalnız buradan yapılır.
// Seçim Yap, Değiştir ve İptal Et yalnız masa kilitli değilken aktif; kilitli masada üçü de kapalı. Değiştir seçimden 24 saat
// (Yarın Buluşma'da 3 saat) sonra açılır. İptal eden 24 saat hiçbir türde Seçim Yap'ı kullanamaz. İptalde hak yanmaz.
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
  // Değiştir kilidi geri sayımı: her saniye yenilenir; süre dolunca metin kalkar, Değiştir aktif olur (kural backend'de aynen)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!selection) return null;
  const rows = selection.options.filter((o) => o.selection || o.seated);
  const canPick = selection.options.some((o) => o.hasRight && !o.selection && !o.seated);
  if (rows.length === 0 && !canPick) return null;
  const cooling = !!selection.cancelCooldownUntil && Date.parse(selection.cancelCooldownUntil) > now;
  const suspended = !!selection.suspendedUntil && Date.parse(selection.suspendedUntil) > now;

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
            {sel && (
              <div className="flex flex-wrap" style={{ gap: 8 }}>
                <StdButton variant="ghost"
                  onClick={() => setConfirm({ kind: 'change', type: o.type, mode: sel.mode === 'TOMORROW' ? 'PLANNED' : 'TOMORROW' })}
                  disabled={busy !== null || o.locked || Date.parse(sel.changeAvailableAt) > now}
                  className="flex-1 justify-center disabled:opacity-50"
                >
                  {tr('live.selChange')}
                </StdButton>
                <StdButton variant="ghost"
                  onClick={() => setConfirm({ kind: 'cancel', type: o.type, mode: sel.mode })}
                  disabled={busy !== null || o.locked}
                  className="flex-1 justify-center disabled:opacity-50"
                >
                  {tr('live.selCancel')}
                </StdButton>
              </div>
            )}
            {/* Pasif buton nedeni */}
            {sel && (o.locked || Date.parse(sel.changeAvailableAt) > now) && (
              <p className="text-[#a39c93]" style={{ fontSize: 12, margin: 0 }}>
                {o.locked ? tr('live.selReasonLocked') : tr('live.selChangeIn', changeIn(Date.parse(sel.changeAvailableAt) - now))}
              </p>
            )}
          </div>
        );
      })}
      {error && <p className="text-[#ff6b6b]" style={{ fontSize: 12, margin: 0 }}>{error}</p>}
      {canPick && (
        <>
          <StdButton variant="primary" onClick={onOpen} disabled={cooling || suspended} className="w-full justify-center disabled:opacity-50">{tr('live.selOpen')}</StdButton>
          {(suspended || cooling) && <p className="text-[#a39c93] text-center" style={{ fontSize: 12, margin: 0 }}>{suspended ? tr('live.selReasonSuspended') : <>{tr('live.selReasonCooldown')}<br />{tr(...cooldownKey(Date.parse(selection.cancelCooldownUntil!) - now))}</>}</p>}
        </>
      )}
      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }} role="dialog" aria-modal="true" aria-labelledby="sel-confirm-title" onClick={() => setConfirm(null)}>
          <div className="ll-card w-full max-w-md flex flex-col gap-4" style={{ background: '#121212' }} onClick={(e) => e.stopPropagation()}>
            {/* Büyük başlık, kural metni, butonlar ortada alt alta */}
            <h3 id="sel-confirm-title" style={{ margin: 0, textAlign: 'center', fontFamily: 'var(--font-serif, "DM Serif Display", Georgia, serif)', fontSize: 26, lineHeight: 1.25, fontWeight: 400, color: '#f4f1ec' }}>
              {tr(confirm.kind === 'change' ? 'live.selChangeConfirm' : 'live.selCancelConfirm')}
            </h3>
            <p style={{ margin: 0, textAlign: 'center', fontSize: 14, lineHeight: 1.6, color: '#c9c2b8' }}>
              {tr(confirm.kind === 'change' ? 'live.selChangeRule' : 'live.selCancelRule')}
            </p>
            <div className="flex flex-col items-center gap-2">
              <StdButton variant="primary"
                onClick={() => {
                  const c = confirm;
                  setConfirm(null);
                  void run(c.type, () => (c.kind === 'change' ? onChange(c.type, c.mode) : onCancel(c.type)));
                }}
                className="justify-center"
                style={{ width: '100%', maxWidth: 280 }}
              >
                {tr(confirm.kind === 'change' ? 'live.selConfirmChangeYes' : 'live.selConfirmCancelYes')}
              </StdButton>
              <StdButton variant="ghost" onClick={() => setConfirm(null)} className="justify-center" style={{ width: '100%', maxWidth: 280 }}>{tr('live.selConfirmNo')}</StdButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
