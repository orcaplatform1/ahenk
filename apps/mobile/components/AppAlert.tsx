// Sistem uyarı penceresi (Alert.alert) yerine Ahenk paletinde özel pencere. Arka plan, başlık ve yazı paletten (sheet / ll);
// butonlar mevcut stiller: tek buton "Tamam" (StdButton primary), vazgeç (StdButton ghost), onay (StdButton primary), silme / ban gibi geri alınamaz işlem
// (BtnTone danger). HIG: kısa başlık, iptal seçeneği, en az 44 pt dokunma alanı; geri tuşu / dışarı dokunma vazgeç sayılır.
// Kullanım: showAlert(başlık, mesaj?, butonlar?) — Alert.alert ile aynı imza; pencere kök yerleşimdeki <AppAlertHost /> ile çizilir.
import i18n from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { StdButton, BtnTone, Serif, T } from './ui';
import { ll, sheet } from '@/theme/theme';

interface AlertButton { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }
// large: büyük başlık; stacked: butonlar ortada alt alta (seçim iptal / değiştir uyarısı)
interface AlertOptions { large?: boolean; stacked?: boolean }
interface AlertState { title: string; message?: string; buttons: AlertButton[]; opts?: AlertOptions }

let push: ((a: AlertState) => void) | null = null;
const queue: AlertState[] = [];

export function showAlert(title: string, message?: string, buttons?: AlertButton[], opts?: AlertOptions) {
  const a: AlertState = { title, message, buttons: buttons?.length ? buttons : [{ text: i18n.t('kanka.ok') }], opts };
  if (push) push(a); else queue.push(a);
}

export function AppAlertHost() {
  const [list, setList] = useState<AlertState[]>([]);
  useEffect(() => {
    push = (a) => setList((l) => [...l, a]);
    if (queue.length) setList((l) => [...l, ...queue.splice(0)]);
    return () => { push = null; };
  }, []);
  const cur = list[0];
  const close = (b?: AlertButton) => { setList((l) => l.slice(1)); b?.onPress?.(); };
  const cancel = cur?.buttons.find((b) => b.style === 'cancel');
  const stacked = !!cur?.opts?.stacked;
  const row = !!cur && cur.buttons.length === 2 && !stacked;
  return (
    <Modal visible={!!cur} transparent animationType="fade" onRequestClose={() => close(cancel)} statusBarTranslucent>
      <Pressable onPress={() => { if (cancel) close(cancel); }} style={{ flex: 1, backgroundColor: sheet.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {!!cur && (
          <Pressable onPress={() => undefined} accessibilityRole="alert"
            style={{ width: '100%', maxWidth: 400, backgroundColor: sheet.bg, borderWidth: 1, borderColor: sheet.border, borderRadius: sheet.radius, padding: 24, gap: 12 }}>
            {cur.opts?.large
              ? <Serif style={{ fontSize: 26, lineHeight: 32, color: ll.text, textAlign: 'center' }}>{cur.title}</Serif>
              : <T w={700} style={{ fontSize: 17, lineHeight: 23, color: ll.text, textAlign: 'center' }}>{cur.title}</T>}
            {!!cur.message && <T style={{ fontSize: 14, lineHeight: 20, color: ll.text2, textAlign: 'center' }}>{cur.message}</T>}
            <View style={{ flexDirection: row ? 'row' : 'column', flexWrap: row ? 'wrap' : undefined, alignItems: stacked ? 'center' : undefined, gap: 12, marginTop: 8 }}>
              {(row ? [...cur.buttons].sort((a, b) => (a.style === 'cancel' ? -1 : b.style === 'cancel' ? 1 : 0)) : cur.buttons).map((b) => {
                const props = { label: b.text, onPress: () => close(b), style: row ? { flex: 1 } : stacked ? { width: '100%' as const, maxWidth: 280 } : { width: '100%' as const } };
                if (b.style === 'cancel') return <StdButton variant="ghost" key={b.text} {...props} />;
                if (b.style === 'destructive') return <BtnTone key={b.text} tone="danger" {...props} />;
                return <StdButton variant="primary" key={b.text} {...props} />;
              })}
            </View>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}
