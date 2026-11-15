// Acil Yardım konumu için belirgin açıklama ekranı (Google Play "prominent disclosure" / Apple izin öncesi açıklama).
// Konum izni (ön plan ya da arka plan) istenmeden ÖNCE tam ekran gösterilir. "Devam Et" izin isteğini başlatır,
// "Şimdi Değil" izin istemeden geri döner. Metin gerçek kullanıma göre: lib/sosLive.ts (10 sn'de bir gönderim, arka plan /
// kapalı uygulama, talep çözülünce durur), backend/src/sos (admin takibi, OpenStreetMap Nominatim adres çözümleme).
// HIG: güvenli alan içinde, butonlar en az 44 pt, Android geri tuşu "Şimdi Değil" gibi davranır.
import React from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BtnGhost, BtnPrimary, Serif, T } from './ui';
import { ll } from '@/theme/theme';

const SECTIONS: { title: string; body: string }[] = [
  { title: 'Hangi özellik için?', body: 'Konumun yalnızca Acil Yardım özelliği için kullanılır.' },
  {
    title: 'Ne zaman toplanır?',
    body: 'Yalnızca bir masada Acil Yardım talebi gönderdiğinde, talep anında alınır. Talep gönderildikten sonra konumun, talep çözülene kadar yaklaşık 10 saniyede bir toplanmaya devam eder. "Her zaman" iznini verirsen konumun arka planda, uygulama kapalıyken veya kullanılmıyorken de toplanır. Talep çözülünce konum toplama durur. Diğer katılımcıların konumu alınmaz.',
  },
  {
    title: 'Kiminle paylaşılır?',
    body: 'Konumun Ahenk acil yardım ekibine iletilir, ekibimiz tarafından takip edilir ve emniyet birimleriyle paylaşılır. Konumun açık adresini bulmak için koordinatlar OpenStreetMap (Nominatim) adres hizmetine gönderilir.',
  },
];

export function LocationDisclosure({ visible, onContinue, onCancel }: { visible: boolean; onContinue: () => void; onCancel: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: ll.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16, paddingHorizontal: 24 }}>
        <ScrollView contentContainerStyle={{ gap: 20, paddingBottom: 16 }}>
          <T w={700} style={{ fontSize: 13, color: ll.red, letterSpacing: 1.2 }}>AHENK</T>
          <Serif style={{ fontSize: 30, lineHeight: 36, color: ll.text }}>Acil Yardım için konumun kullanılır</Serif>
          {SECTIONS.map(s => (
            <View key={s.title} style={{ gap: 6 }}>
              <T w={600} style={{ fontSize: 15, color: ll.text }}>{s.title}</T>
              <T style={{ fontSize: 14, lineHeight: 21, color: ll.text2 }}>{s.body}</T>
            </View>
          ))}
        </ScrollView>
        <View style={{ gap: 12 }}>
          <BtnPrimary label="Devam Et" full style={{ minHeight: 44 }} onPress={onContinue} />
          <BtnGhost label="Şimdi Değil" full style={{ minHeight: 44 }} onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}
