// Eşleşme Paneli seçim kartı — web components/live/SelectionCard.tsx karşılığı.
// Seçim ekranını açar; seçim değiştirme (buluşma türü) ve iptal yalnız buradan yapılır. Seçim Yap, Değiştir ve İptal Et yalnız
// masa kilitli değilken aktif; kilitli masada üçü de kapalı. Değiştir seçimden 24 saat (Yarın Buluşma'da 3 saat) sonra açılır;
// iptal eden 24 saat hiçbir türde Seçim Yap'ı kullanamaz; iptalde hak yanmaz. HIG: en az 44 pt dokunma alanı.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MasaTuru } from '@/lib/masa';
import type { MeetingMode, WeeklySelection } from '@/lib/useMasaTabs';
import { StdButton, Card, T, Title } from './ui';
import { Rings } from './LiveTabs';
import { showAlert } from './AppAlert';
import { ll } from '@/theme/theme';

// Kalan süre: X saat Y dakika (dakika yukarı yuvarlanır)
function changeIn(ms: number): { h: number; m: number } {
  const total = Math.max(1, Math.ceil(ms / 60000));
  return { h: Math.floor(total / 60), m: total % 60 };
}

// İptal kilidi metni: kalan süre (backend cancelCooldownUntil) satır içinde; 1 saat ve üstü "X saat Y dakika", altı yalnız "Y dakika";
// saniye yok, dakika yukarı yuvarlanır (0 dakika gösterilmez). Değer dakika sınırında değişir; süre dolunca metin kalkar, Seçim Yap açılır
function cooldownKey(ms: number): ['live.selReasonCooldownHm' | 'live.selReasonCooldownM', { h: number; m: number }] {
  const r = changeIn(ms);
  return [r.h >= 1 ? 'live.selReasonCooldownHm' : 'live.selReasonCooldownM', r];
}

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
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <StdButton variant="ghost"
                  label={t('live.selChange')}
                  disabled={busy !== null || o.locked || Date.parse(sel.changeAvailableAt) > now}
                  style={{ flex: 1, minHeight: 44 }}
                  onPress={() => showAlert(t('live.selChangeConfirm'), t('live.selChangeRule'), [
                    { text: t('live.selConfirmChangeYes'), onPress: () => { void run(o.type, () => onChange(o.type, sel.mode === 'TOMORROW' ? 'PLANNED' : 'TOMORROW')); } },
                    { text: t('live.selConfirmNo'), style: 'cancel' },
                  ], { large: true, stacked: true })}
                />
                <StdButton variant="ghost"
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
              <T style={{ fontSize: 12, color: ll.label }}>{o.locked ? t('live.selReasonLocked') : t('live.selChangeIn', changeIn(Date.parse(sel.changeAvailableAt) - now))}</T>
            )}
          </View>
        );
      })}
      {!!error && <T style={{ fontSize: 12, color: ll.red2 }}>{error}</T>}
      {canPick && <StdButton variant="primary" label={t('live.selOpen')} disabled={cooling || suspended} onPress={onOpen} />}
      {canPick && (suspended || cooling) && <T style={{ fontSize: 12, color: ll.label, textAlign: 'center' }}>{suspended ? t('live.selReasonSuspended') : t(...cooldownKey(Date.parse(selection.cancelCooldownUntil!) - now))}</T>}
    </Card>
  );
}
