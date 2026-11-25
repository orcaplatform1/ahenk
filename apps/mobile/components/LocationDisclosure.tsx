// Acil Yardım konumu için belirgin açıklama ekranı (Google Play "prominent disclosure" / Apple izin öncesi açıklama).
// Konum izni (ön plan ya da arka plan) istenmeden ÖNCE tam ekran gösterilir. "Devam Et" izin isteğini başlatır,
// "Şimdi Değil" izin istemeden geri döner. Metin gerçek kullanıma göre: lib/sosLive.ts (10 sn'de bir gönderim, arka plan /
// kapalı uygulama, talep çözülünce durur), backend/src/sos (admin takibi, OpenStreetMap Nominatim adres çözümleme).
// HIG: güvenli alan içinde, butonlar en az 44 pt, Android geri tuşu "Şimdi Değil" gibi davranır.
import { Modal, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StdButton, Serif, T } from './ui';
import { ll } from '@/theme/theme';
import { useTranslation } from 'react-i18next';

const SECTIONS: { title: string; body: string }[] = [
  { title: 'locd.s1t', body: 'locd.s1b' },
  { title: 'locd.s2t', body: 'locd.s2b' },
  { title: 'locd.s3t', body: 'locd.s3b' },
];

export function LocationDisclosure({ visible, onContinue, onCancel }: { visible: boolean; onContinue: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: ll.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16, paddingHorizontal: 24 }}>
        <ScrollView contentContainerStyle={{ gap: 20, paddingBottom: 16 }}>
          <T w={700} style={{ fontSize: 13, color: ll.red, letterSpacing: 1.2 }}>Ahenk</T>
          <Serif style={{ fontSize: 30, lineHeight: 36, color: ll.text }}>{t('locd.title')}</Serif>
          {SECTIONS.map(s => (
            <View key={s.title} style={{ gap: 6 }}>
              <T w={600} style={{ fontSize: 15, color: ll.text }}>{t(s.title)}</T>
              <T style={{ fontSize: 14, lineHeight: 21, color: ll.text2 }}>{t(s.body)}</T>
            </View>
          ))}
        </ScrollView>
        <View style={{ gap: 12 }}>
          <StdButton variant="primary" label={t('common.continue')} full onPress={onContinue} />
          <StdButton variant="ghost" label={t('locd.notNow')} full onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}
