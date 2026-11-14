// Admin pencere (ll-card, max 400, başlık + ✕): admin/cities, venues vb. "Yeni ..." pencereleri
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Btn } from '../ui';
import { ATitle } from './AdminUi';
import { adm, llCard } from '@/theme/theme';
import { useKeyboardFieldScroll } from '@/lib/useKeyboardFieldScroll';

// keyboardScroll: klavye açılınca pencere klavyenin üstüne sığacak şekilde küçülür (Android dahil) ve odaklanılan alan klavyenin
// üstünde görünecek kadar kaydırılır; formun bütün alanlarına kaydırarak ulaşılır (Yeni Bot formu)
export function ADialog({ visible, onClose, title, children, maxWidth = 400, keyboardScroll = false }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: number; keyboardScroll?: boolean }) {
  const kb = useKeyboardFieldScroll();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' || keyboardScroll ? 'padding' : undefined}>
        <Pressable onPress={onClose} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <Pressable onPress={() => undefined} style={{ width: '100%', maxWidth, maxHeight: '90%', borderRadius: llCard.radius, borderWidth: 1, borderColor: adm.border, backgroundColor: adm.card, padding: llCard.padding, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 32, shadowOffset: { width: 0, height: 24 } }}>
            <ScrollView keyboardShouldPersistTaps="handled" {...(keyboardScroll ? kb : null)}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <ATitle>{title}</ATitle>
                <Btn variant="admX" label="✕" accessibilityLabel="Kapat" textStyle={{ fontSize: 16 }} style={{ padding: 4 }} onPress={onClose} />
              </View>
              {children}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
