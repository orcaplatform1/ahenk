// apps/web/components/ProblemReportModal.tsx karşılığı. RAPORLANDI: görsel ekleme için galeri paketi (expo-image-picker) kurulu değil;
// bu aşamada yalnız açıklama gönderilir. Platform alanı backend ProblemReportPlatform (IOS/ANDROID).
import React, { useEffect, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { api } from '@/lib/api';
import { BtnGhost, BtnPrimary, ModalBox, T } from '../ui';
import { ll, sans, tw } from '@/theme/theme';

export function ProblemReport({ open, onClose, screen }: { open: boolean; onClose: () => void; screen: string }) {
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => { if (!open) { setDescription(''); setError(''); setDone(false); } }, [open]);
  async function submit() {
    if (!description.trim()) { setError('Açıklama zorunludur.'); return; }
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('platform', Platform.OS === 'ios' ? 'IOS' : 'ANDROID');
      fd.append('screen', screen);
      fd.append('description', description.trim());
      await api.form('/problem-reports', fd);
      setDone(true);
    } catch (e) { setError((e as Error).message || 'Bildirim gönderilemedi.'); } finally { setBusy(false); }
  }
  return (
    <ModalBox visible={open} onClose={onClose} title="Sorun Bildir">
      {done ? (
        <View style={{ gap: 16 }}>
          <T style={{ fontSize: 14, color: ll.text2 }}>Bildirimin alındı, teşekkürler.</T>
          <BtnGhost label="Kapat" style={{ width: '72%', alignSelf: 'center' }} onPress={onClose} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <T style={{ fontSize: 12, color: ll.text2 }}>Açıklama *</T>
          <TextInput value={description} onChangeText={setDescription} maxLength={5000} multiline numberOfLines={5} placeholder="Yaşadığın sorunu anlat" placeholderTextColor={tw.muted} keyboardAppearance="dark"
            style={{ minHeight: 110, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, fontSize: 14, color: tw.text, fontFamily: sans(400), textAlignVertical: 'top' }} />
          {!!error && <T style={{ color: tw.accent, fontSize: 14 }}>{error}</T>}
          <View style={{ marginTop: 8, gap: 12 }}>
            <BtnPrimary label={busy ? 'Gönderiliyor…' : 'Gönder'} style={{ width: '72%', alignSelf: 'center' }} disabled={busy} onPress={submit} />
            <BtnGhost label="Vazgeç" style={{ width: '72%', alignSelf: 'center' }} onPress={onClose} />
          </View>
        </View>
      )}
    </ModalBox>
  );
}
