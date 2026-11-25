// Acil yardım uyarı penceresi (web components/SosOpenReport.tsx ile aynı içerik): başlık, satırlar, son satır kalın, sağ üstte X.
// durationMs dolunca kendiliğinden kapanır; countdown verilirse altta geri sayım çubuğu. HIG: X için en az 44 pt dokunma alanı.
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { T } from './ui';
import { tw } from '@/theme/theme';

export function SosNotice({ visible, title, lines, bold, durationMs, countdown = false, onClose }: {
  visible: boolean; title: string; lines: string[]; bold: string; durationMs: number; countdown?: boolean; onClose: () => void;
}) {
  const { t } = useTranslation();
  const bar = useRef(new Animated.Value(1)).current;
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!visible) return;
    bar.setValue(1);
    const anim = Animated.timing(bar, { toValue: 0, duration: durationMs, easing: Easing.linear, useNativeDriver: false });
    if (countdown) anim.start();
    const id = setTimeout(() => close.current(), durationMs);
    return () => { clearTimeout(id); anim.stop(); };
  }, [visible, durationMs, countdown, bar]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(10,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <View accessibilityRole="alert" style={{ width: '100%', maxWidth: 380, backgroundColor: '#2a0a0a', borderWidth: 1.5, borderColor: 'rgba(192,57,43,0.5)', borderRadius: 12, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16, overflow: 'hidden' }}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('masa.close')}
            style={{ position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
            <T w={700} style={{ fontSize: 20, color: tw.text }}>×</T>
          </Pressable>
          <T w={700} style={{ fontSize: 14, color: tw.accent, textAlign: 'center', marginHorizontal: 28 }}>{title}</T>
          <View style={{ marginTop: 8, gap: 4 }}>
            {lines.map((l) => <T key={l} style={{ fontSize: 13, lineHeight: 19, color: 'rgba(255,107,107,0.8)', textAlign: 'center' }}>{l}</T>)}
            <T w={700} style={{ fontSize: 13, lineHeight: 19, color: tw.accent, textAlign: 'center' }}>{bold}</T>
          </View>
          {countdown && (
            <View style={{ marginTop: 14, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <Animated.View style={{ height: 4, borderRadius: 2, backgroundColor: tw.accent, width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
