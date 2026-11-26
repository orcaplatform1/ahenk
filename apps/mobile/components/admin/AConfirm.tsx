// Yönetim paneli ortak onay penceresi (admin paleti; web components/AdminConfirm.tsx karşılığı, ADialog kartıyla aynı zemin).
// Canlı destek: "Sonlandır" ve "Kötüye kullanım · {gün} gün" onayı. Evet → onYes, Hayır / dışarı basma / Android geri tuşu → onNo (işlem yok).
// HIG: kısa metin, iptal seçeneği ("Hayır") her zaman var, butonlar en az 44 pt.
import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { AT } from './AdminUi';
import { adm, llCard } from '@/theme/theme';

function ConfirmBtn({ label, color, bg, border, onPress }: { label: string; color: string; bg: string; border: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: border, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <AT w={600} style={{ fontSize: 13, color }}>{label}</AT>
    </Pressable>
  );
}

export function AConfirm({ visible, text, onYes, onNo }: { visible: boolean; text: string; onYes: () => void; onNo: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNo}>
      <Pressable onPress={onNo} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <Pressable onPress={() => undefined} accessibilityViewIsModal
          style={{ width: '100%', maxWidth: 320, borderRadius: llCard.radius, borderWidth: 1, borderColor: adm.border, backgroundColor: adm.card, padding: llCard.padding, gap: 20, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 32, shadowOffset: { width: 0, height: 24 } }}>
          <AT w={700} style={{ fontSize: 14 }}>{text}</AT>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ConfirmBtn label="Hayır" color={adm.muted} bg="transparent" border={adm.border} onPress={onNo} />
            <ConfirmBtn label="Evet" color={adm.red} bg="rgba(239,68,68,0.15)" border="rgba(239,68,68,0.4)" onPress={onYes} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
