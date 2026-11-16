// Haftalık buluşma seçimi — web components/live/WeeklySelectionModal.tsx karşılığı.
// Pazar 23:59'dan sonra paketi olan kullanıcıya Eşleşme Paneli / Masalarım'da açılır; 1, 2 ya da 3 tür seçilir,
// yalnız seçilen türlerin taramasına girilir, seçim değiştirilemez. HIG: iptal seçeneği ("Sonra"), en az 44 pt dokunma alanı.
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { MasaTuru } from '@/lib/masa';
import type { WeeklySelection } from '@/lib/useMasaTabs';
import { BtnGhost, BtnPrimary, ModalBox, T } from './ui';
import { Rings } from './LiveTabs';
import { ll } from '@/theme/theme';
import { useTranslation } from 'react-i18next';

// Kart: solda eşleşme alanındaki tür ikonu (halkalar), sağda kalın başlık ve küçük alt metin
const CARD: Record<MasaTuru, { title: string; text: string }> = {
  GROUP: { title: 'live.wsGroupTitle', text: 'live.wsGroupText' },
  ONE_ON_ONE: { title: 'live.wsOneTitle', text: 'live.wsOneText' },
  KANKA: { title: 'live.wsKankaTitle', text: 'live.wsKankaText' },
};

export function WeeklySelectionModal({ selection, onSubmit }: { selection: WeeklySelection | null; onSubmit: (types: MasaTuru[]) => Promise<void> }) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<MasaTuru[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [closed, setClosed] = useState(false);
  const visible = !!selection?.showModal && !closed;

  const toggle = (m: MasaTuru) => setPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));
  async function submit() {
    setSending(true); setError('');
    try { await onSubmit(picked); } catch (e) { setError((e as Error).message); } finally { setSending(false); }
  }

  return (
    <ModalBox visible={visible} onClose={() => setClosed(true)} title={t('live.wsTitle')} opaque>
      <View style={{ gap: 8 }}>
        {(selection?.options ?? []).map((o) => {
          const on = picked.includes(o.type);
          return (
            <Pressable
              key={o.type}
              disabled={!o.open}
              onPress={() => toggle(o.type)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: !o.open }}
              style={{
                minHeight: 52, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
                borderWidth: on ? 2 : 1, borderColor: on ? ll.red : 'rgba(255,255,255,0.12)', backgroundColor: on ? 'rgba(214,69,58,0.12)' : 'rgba(255,255,255,0.03)',
                opacity: o.open ? 1 : 0.4,
              }}
            >
              <Rings type={o.type} on still />
              <View style={{ flex: 1, gap: 4 }}>
                <T w={700} style={{ fontSize: 14, color: ll.text }}>{t(CARD[o.type].title)}</T>
                <T style={{ fontSize: 12, lineHeight: 17.4, color: ll.label }}>{t(CARD[o.type].text)}</T>
              </View>
            </Pressable>
          );
        })}
      </View>
      <T style={{ fontSize: 12, color: ll.label, marginTop: 12, lineHeight: 18 }}>{t('live.wsNote')}</T>
      {!!error && <T style={{ fontSize: 12, color: ll.red2, marginTop: 8 }}>{error}</T>}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        <BtnGhost label={t('live.wsLater')} style={{ flex: 1, minHeight: 44 }} onPress={() => setClosed(true)} />
        <BtnPrimary label={sending ? '…' : t('live.wsConfirm')} disabled={picked.length === 0 || sending} style={[{ flex: 1, minHeight: 44 }, (picked.length === 0 || sending) && { opacity: 0.5 }]} onPress={submit} />
      </View>
    </ModalBox>
  );
}
