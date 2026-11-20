// Eşleşme Paneli seçim kartı — web components/live/SelectionCard.tsx karşılığı.
// Seçim ekranını açar; seçim değiştirme (buluşma türü) ve iptal yalnız buradan yapılır. Seçim Yap, Değiştir ve İptal Et yalnız
// masa kilitli değilken aktif; kilitli masada üçü de kapalı. Değiştir seçimden 24 saat (Yarın Buluşma'da 3 saat) sonra açılır;
// iptal eden 24 saat hiçbir türde Seçim Yap'ı kullanamaz; iptalde hak yanmaz. HIG: en az 44 pt dokunma alanı.
import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MasaTuru } from '@/lib/masa';
import type { MeetingMode, WeeklySelection } from '@/lib/useMasaTabs';
import { BtnGhost, BtnPrimary, Card, T, Title } from './ui';
import { Rings } from './LiveTabs';
import { showAlert } from './AppAlert';
import { ll } from '@/theme/theme';

const TITLE: Record<MasaTuru, string> = { GROUP: 'live.wsGroupTitle', ONE_ON_ONE: 'live.wsOneTitle', KANKA: 'live.wsKankaTitle' };
const MODE_LABEL: Record<MeetingMode, string> = { TOMORROW: 'live.modeTomorrow', PLANNED: 'live.modeWeekend' };

export function SelectionCard({ selection, onOpen, onChange, onCancel }: {
  selection: WeeklySelection | null;
  onOpen: () => void;
  onChange: (type: MasaTuru, mode: MeetingMode) => Promise<void>;
  onCancel: (type: MasaTuru) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<MasaTuru | null>(null);
  const [error, setError] = useState('');
  if (!selection) return null;
  const rows = selection.options.filter((o) => o.selection || o.seated);
  const canPick = selection.options.some((o) => o.hasRight && !o.selection && !o.seated);
  if (rows.length === 0 && !canPick) return null;
  const now = Date.now();
  const cooling = !!selection.cancelCooldownUntil && Date.parse(selection.cancelCooldownUntil) > now;

  async function run(type: MasaTuru, fn: () => Promise<void>) {
    setBusy(type); setError('');
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  return (
    <Card style={{ gap: 12 }}>
      <Title>{t('live.selCardTitle')}</Title>
      {rows.map((o) => {
        const sel = o.selection;
        const note = o.locked ? 'live.selLocked' : sel?.kankaWaiting ? 'live.selKankaWaiting' : sel?.nextWeek ? 'live.selNextWeek' : null;
        const sub = [sel ? t(MODE_LABEL[sel.mode]) : null, note ? t(note) : null].filter(Boolean).join(' · ');
        return (
          <View key={o.type} style={{ borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.03)', gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Rings type={o.type} on still />
              <View style={{ flex: 1, gap: 4 }}>
                <T w={700} style={{ fontSize: 14, color: ll.text }}>{t(TITLE[o.type])}</T>
                {!!sub && <T style={{ fontSize: 12, color: ll.label }}>{sub}</T>}
              </View>
            </View>
            {sel && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <BtnGhost
                  label={t('live.selChange')}
                  disabled={busy !== null || o.locked || Date.parse(sel.changeAvailableAt) > now}
                  style={{ flex: 1, minHeight: 44 }}
                  onPress={() => showAlert(t('live.selChangeConfirm'), t('live.selChangeRule'), [
                    { text: t('live.selConfirmChangeYes'), onPress: () => { void run(o.type, () => onChange(o.type, sel.mode === 'TOMORROW' ? 'PLANNED' : 'TOMORROW')); } },
                    { text: t('live.selConfirmNo'), style: 'cancel' },
                  ], { large: true, stacked: true })}
                />
                <BtnGhost
                  label={t('live.selCancel')}
                  disabled={busy !== null || o.locked}
                  style={{ flex: 1, minHeight: 44 }}
                  onPress={() => showAlert(t('live.selCancelConfirm'), t('live.selCancelRule'), [
                    { text: t('live.selConfirmCancelYes'), onPress: () => { void run(o.type, () => onCancel(o.type)); } },
                    { text: t('live.selConfirmNo'), style: 'cancel' },
                  ], { large: true, stacked: true })}
                />
              </View>
            )}
            {/* Pasif buton nedeni */}
            {sel && (o.locked || Date.parse(sel.changeAvailableAt) > now) && (
              <T style={{ fontSize: 12, color: ll.label }}>{t(o.locked ? 'live.selReasonLocked' : sel.mode === 'TOMORROW' ? 'live.selReasonChange3' : 'live.selReasonChange24')}</T>
            )}
          </View>
        );
      })}
      {!!error && <T style={{ fontSize: 12, color: ll.red2 }}>{error}</T>}
      {canPick && <BtnPrimary label={t('live.selOpen')} style={{ minHeight: 44 }} disabled={cooling} onPress={onOpen} />}
      {canPick && cooling && <T style={{ fontSize: 12, color: ll.label, textAlign: 'center' }}>{t('live.selReasonCooldown')}</T>}
    </Card>
  );
}
