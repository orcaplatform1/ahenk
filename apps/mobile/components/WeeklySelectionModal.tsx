// Seçim ekranı — web components/live/WeeklySelectionModal.tsx karşılığı.
// "Buluşma Türü" (Yarın Buluşma / Hafta Sonu Buluşma, tek seçim) + "Masa Türü" (Grup / Baş Başa / Kankamla, çoklu).
// Paket alınınca ve girişte, taramada ya da masada olmayan kullanılmamış hak varsa kendiliğinden açılır; Eşleşme Paneli'ndeki
// karttan da açılır. Yalnız kullanılmamış hakkı olan (ve henüz kaydı / masası olmayan) türler seçilebilir, diğerleri pasif.
// HIG: iptal seçeneği ("Sonra"), en az 44 pt dokunma alanı, radyo / onay kutusu erişilebilirlik rolleri.
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { MasaTuru } from '@/lib/masa';
import type { MeetingMode, WeeklySelection } from '@/lib/useMasaTabs';
import { StdButton, ModalBox, T } from './ui';
import { Rings } from './LiveTabs';
import { ll } from '@/theme/theme';
import { useTranslation } from 'react-i18next';

// Kart: solda eşleşme alanındaki tür ikonu (halkalar), sağda kalın başlık ve küçük alt metin
const CARD: Record<MasaTuru, { title: string; text: string }> = {
  GROUP: { title: 'live.wsGroupTitle', text: 'live.wsGroupText' },
  ONE_ON_ONE: { title: 'live.wsOneTitle', text: 'live.wsOneText' },
  KANKA: { title: 'live.wsKankaTitle', text: 'live.wsKankaText' },
};
const MODES: { mode: MeetingMode; label: string }[] = [
  { mode: 'TOMORROW', label: 'live.modeTomorrow' },
  { mode: 'PLANNED', label: 'live.modeWeekend' },
];

const boxStyle = (on: boolean) => ({
  minHeight: 52, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12,
  borderWidth: on ? 2 : 1, borderColor: on ? ll.red : 'rgba(255,255,255,0.12)', backgroundColor: on ? 'rgba(214,69,58,0.12)' : 'rgba(255,255,255,0.03)',
});

export function WeeklySelectionModal({ selection, onSubmit, open, onClose }: {
  selection: WeeklySelection | null;
  onSubmit: (mode: MeetingMode, types: MasaTuru[]) => Promise<void>;
  open?: boolean;
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<MeetingMode | null>(null);
  const [picked, setPicked] = useState<MasaTuru[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [closed, setClosed] = useState(false);
  const visible = !!selection && (!!open || (selection.showModal && !closed));

  useEffect(() => {
    if (visible) { setMode(null); setPicked([]); setError(''); }
  }, [visible]);

  const selectable = (o: WeeklySelection['options'][number]) => o.hasRight && !o.selection && !o.seated;
  const toggle = (m: MasaTuru) => setPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));
  const close = () => { setClosed(true); onClose?.(); };
  async function submit() {
    if (!mode) return;
    setSending(true); setError('');
    try { await onSubmit(mode, picked); close(); } catch (e) { setError((e as Error).message); } finally { setSending(false); }
  }
  const disabled = !mode || picked.length === 0 || sending;

  return (
    <ModalBox visible={visible} onClose={close} title={t('live.selModeLabel')} opaque>
      <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
        {MODES.map((m) => {
          const on = mode === m.mode;
          return (
            <Pressable
              key={m.mode}
              onPress={() => setMode(m.mode)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[boxStyle(on), { flex: 1, alignItems: 'center', justifyContent: 'center' }]}
            >
              <T w={700} style={{ fontSize: 14, color: ll.text, textAlign: 'center' }}>{t(m.label)}</T>
            </Pressable>
          );
        })}
      </View>
      <T w={500} style={{ fontSize: 16, marginTop: 20, marginBottom: 12 }}>{t('live.selTypeLabel')}</T>
      <View style={{ gap: 8 }}>
        {(selection?.options ?? []).map((o) => {
          const on = picked.includes(o.type);
          const enabled = selectable(o);
          return (
            <Pressable
              key={o.type}
              disabled={!enabled}
              onPress={() => toggle(o.type)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: !enabled }}
              style={[boxStyle(on), { flexDirection: 'row', alignItems: 'center', gap: 12, opacity: enabled ? 1 : 0.4 }]}
            >
              <Rings type={o.type} on still />
              <View style={{ flex: 1, gap: 4 }}>
                <T w={700} style={{ fontSize: 14, color: ll.text }}>{t(CARD[o.type].title)}</T>
                <T style={{ fontSize: 12, lineHeight: 17.4, color: ll.label }}>{t(mode === 'TOMORROW' ? 'live.selTomorrowText' : CARD[o.type].text)}</T>
              </View>
            </Pressable>
          );
        })}
      </View>
      {!!error && <T style={{ fontSize: 12, color: ll.red2, marginTop: 8 }}>{error}</T>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        <StdButton variant="ghost" label={t('live.wsLater')} style={{ flex: 1 }} onPress={close} />
        <StdButton variant="primary" label={sending ? '…' : t('live.wsConfirm')} disabled={disabled} style={[{ flex: 1 }, disabled && { opacity: 0.5 }]} onPress={submit} />
      </View>
    </ModalBox>
  );
}
