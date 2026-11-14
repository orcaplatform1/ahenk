// Sistem uyarı penceresi (Alert.alert) yerine Ahenk paletinde özel pencere. Arka plan, başlık ve yazı paletten (sheet / ll);
// butonlar mevcut stiller: tek buton "Tamam" (BtnPrimary), vazgeç (BtnGhost), onay (BtnPrimary), silme / ban gibi geri alınamaz işlem
// (BtnTone danger). HIG: kısa başlık, iptal seçeneği, en az 44 pt dokunma alanı; geri tuşu / dışarı dokunma vazgeç sayılır.
// Kullanım: showAlert(başlık, mesaj?, butonlar?) — Alert.alert ile aynı imza; pencere kök yerleşimdeki <AppAlertHost /> ile çizilir.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { BtnGhost, BtnPrimary, BtnTone, T } from './ui';
import { ll, sheet } from '@/theme/theme';

export interface AlertButton { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }
interface AlertState { title: string; message?: string; buttons: AlertButton[] }

let push: ((a: AlertState) => void) | null = null;
const queue: AlertState[] = [];

export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const a: AlertState = { title, message, buttons: buttons?.length ? buttons : [{ text: 'Tamam' }] };
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
  const row = !!cur && cur.buttons.length === 2;
  return (
    <Modal visible={!!cur} transparent animationType="fade" onRequestClose={() => close(cancel)} statusBarTranslucent>
      <Pressable onPress={() => { if (cancel) close(cancel); }} style={{ flex: 1, backgroundColor: sheet.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {!!cur && (
          <Pressable onPress={() => undefined} accessibilityRole="alert"
            style={{ width: '100%', maxWidth: 400, backgroundColor: sheet.bg, borderWidth: 1, borderColor: sheet.border, borderRadius: sheet.radius, padding: 24, gap: 12 }}>
            <T w={700} style={{ fontSize: 17, lineHeight: 23, color: ll.text, textAlign: 'center' }}>{cur.title}</T>
            {!!cur.message && <T style={{ fontSize: 14, lineHeight: 20, color: ll.text2, textAlign: 'center' }}>{cur.message}</T>}
            <View style={{ flexDirection: row ? 'row' : 'column', gap: 12, marginTop: 8 }}>
              {(row ? [...cur.buttons].sort((a, b) => (a.style === 'cancel' ? -1 : b.style === 'cancel' ? 1 : 0)) : cur.buttons).map((b) => {
                const props = { label: b.text, onPress: () => close(b), style: row ? { flex: 1 } : { width: '100%' as const } };
                if (b.style === 'cancel') return <BtnGhost key={b.text} {...props} />;
                if (b.style === 'destructive') return <BtnTone key={b.text} tone="danger" {...props} />;
                return <BtnPrimary key={b.text} {...props} />;
              })}
            </View>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}
