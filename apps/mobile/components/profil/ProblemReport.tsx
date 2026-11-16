// apps/web/components/ProblemReportModal.tsx karşılığı: açıklama + yalnız galeriden en fazla 3 görsel (JPG/PNG/WebP, her biri 5 MB).
// Butonla ve sallayarak açılışta aynı; ekran görüntüsü eklenmez. Gönderim: POST /problem-reports (platform IOS/ANDROID).
import React, { useEffect, useState } from 'react';
import { Image, Platform, TextInput, View } from 'react-native';
import { File as FsFile } from 'expo-file-system';
import { api } from '@/lib/api';
import { pickFromLibrary, type PickedImage } from '@/lib/imagePick';
import { Btn, BtnGhost, BtnPrimary, ModalBox, T } from '../ui';
import { ll, sans, tw } from '@/theme/theme';
import { useTranslation } from 'react-i18next';

// Web ile aynı: en fazla 3 görsel (backend PROBLEM_REPORT_MAX_IMAGES_MOBILE = 3)
const MAX_IMAGES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

// Aynı anda tek Sorun Bildir penceresi: Salla-Bildir açık pencere varken yenisini açmaz
let openCount = 0;
export const isProblemReportOpen = () => openCount > 0;

export function ProblemReport({ open, onClose, screen }: { open: boolean; onClose: () => void; screen: string }) {
  const { t } = useTranslation();
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<PickedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    openCount += 1;
    return () => { openCount -= 1; };
  }, [open]);

  useEffect(() => {
    if (open) return;
    setDescription(''); setFiles([]); setError(''); setDone(false);
  }, [open]);

  async function addFiles() {
    setError('');
    const picked = await pickFromLibrary(MAX_IMAGES - files.length);
    if (picked === 'blocked') return;
    if (picked === 'denied') { setError(t('report.libraryDenied')); return; }
    if (picked.some((f) => !ACCEPT.includes(f.type))) { setError(t('report.badType')); return; }
    if (picked.some((f) => (f.size ?? 0) > MAX_BYTES)) { setError(t('report.tooBig')); return; }
    if (files.length + picked.length > MAX_IMAGES) { setError(t('report.maxImages', { max: MAX_IMAGES })); return; }
    setFiles((p) => [...p, ...picked]);
  }

  async function submit() {
    if (!description.trim()) { setError(t('report.descRequired')); return; }
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('platform', Platform.OS === 'ios' ? 'IOS' : 'ANDROID');
      fd.append('screen', screen);
      fd.append('description', description.trim());
      // Global fetch (expo/fetch) RN'nin { uri, name, type } parçasını desteklemiyor ("Unsupported FormDataPart implementation");
      // expo-file-system File nesnesi bytes() sağladığı için dosya içeriği gövdeye yazılır
      files.forEach((f) => fd.append('images', new FsFile(f.uri) as unknown as Blob));
      await api.form('/problem-reports', fd);
      setDone(true);
    } catch (e) { setError((e as Error).message || t('report.sendFailed')); } finally { setBusy(false); }
  }

  return (
    <ModalBox visible={open} onClose={onClose} title={t('report.title')} opaque>
      {done ? (
        <View style={{ gap: 16 }}>
          <T style={{ fontSize: 14, color: ll.text2 }}>{t('report.thanks')}</T>
          <BtnGhost label={t('report.close')} style={{ width: '72%', alignSelf: 'center' }} onPress={onClose} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <T style={{ fontSize: 12, color: ll.text2 }}>{t('report.description')}</T>
          <TextInput value={description} onChangeText={setDescription} maxLength={5000} multiline numberOfLines={5} placeholder={t('report.placeholder')} placeholderTextColor={tw.muted} keyboardAppearance="dark"
            style={{ minHeight: 110, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, fontSize: 14, color: tw.text, fontFamily: sans(400), textAlignVertical: 'top' }} />
          {files.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {files.map((f, i) => (
                <View key={f.uri}>
                  <Image source={{ uri: f.uri }} style={{ width: 72, height: 72, borderRadius: 8 }} accessibilityLabel={t('report.imageAlt', { n: i + 1 })} />
                  <Btn variant="thumbRemove" accessibilityLabel={t('report.removeImage')} hitSlop={12} label="×" onPress={() => setFiles((p) => p.filter((_, j) => j !== i))} />
                </View>
              ))}
            </View>
          )}
          {files.length < MAX_IMAGES && <BtnGhost label={t('report.addImage', { count: files.length, max: MAX_IMAGES })} full onPress={addFiles} />}
          {!!error && <T style={{ color: tw.accent, fontSize: 14 }}>{error}</T>}
          <View style={{ marginTop: 8, gap: 12 }}>
            <BtnPrimary label={busy ? t('report.sending') : t('report.send')} style={{ width: '72%', alignSelf: 'center' }} disabled={busy} onPress={submit} />
            <BtnGhost label={t('report.cancel')} style={{ width: '72%', alignSelf: 'center' }} onPress={onClose} />
          </View>
        </View>
      )}
    </ModalBox>
  );
}
