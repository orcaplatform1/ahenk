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

// Kart: solda eşleşme alanındaki tür ikonu (halkalar), sağda kalın başlık ve küçük alt metin
const CARD: Record<MasaTuru, { title: string; text: string }> = {
  GROUP: { title: 'Grup Masası', text: '4-6 kişilik erkek ve kadınların eşit atandığı masa türüdür. Buluşma her cuma 20:00\'da gerçekleşir.' },
  ONE_ON_ONE: { title: 'Baş Başa Masası', text: 'Karşı cinsinizin atandığı masa türüdür. Buluşma her cumartesi 20:00\'da gerçekleşir.' },
  KANKA: { title: 'Kankamla Masası', text: 'Kankanız ile katılım sağlayıp, karşı cins kankaların atandığı masa türüdür. Buluşma her pazar 20:00\'da gerçekleşir.' },
};

export function WeeklySelectionModal({ selection, onSubmit }: { selection: WeeklySelection | null; onSubmit: (types: MasaTuru[]) => Promise<void> }) {
  const [picked, setPicked] = useState<MasaTuru[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [closed, setClosed] = useState(false);
  const visible = !!selection?.showModal && !closed;

  const toggle = (t: MasaTuru) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  async function submit() {
    setSending(true); setError('');
    try { await onSubmit(picked); } catch (e) { setError((e as Error).message); } finally { setSending(false); }
  }

  return (
    <ModalBox visible={visible} onClose={() => setClosed(true)} title="Bu hafta hangi masaya katılmak için eşleşme taramasına girmek istiyorsunuz?" opaque>
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
                <T w={700} style={{ fontSize: 14, color: ll.text }}>{CARD[o.type].title}</T>
                <T style={{ fontSize: 12, lineHeight: 17.4, color: ll.label }}>{CARD[o.type].text}</T>
              </View>
            </Pressable>
          );
        })}
      </View>
      <T style={{ fontSize: 12, color: ll.label, marginTop: 12, lineHeight: 18 }}>Seçimini sonradan değiştiremezsin. Seçmediğin türün taramasına girmezsin, hakkın düşmez.</T>
      {!!error && <T style={{ fontSize: 12, color: ll.red2, marginTop: 8 }}>{error}</T>}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        <BtnGhost label="Sonra" style={{ flex: 1, minHeight: 44 }} onPress={() => setClosed(true)} />
        <BtnPrimary label={sending ? '…' : 'Seçimi Onayla'} disabled={picked.length === 0 || sending} style={[{ flex: 1, minHeight: 44 }, (picked.length === 0 || sending) && { opacity: 0.5 }]} onPress={submit} />
      </View>
    </ModalBox>
  );
}
