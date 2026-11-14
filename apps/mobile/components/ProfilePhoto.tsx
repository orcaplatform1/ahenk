// Profil fotoğrafı: yuvarlak avatar (fotoğraf yoksa ad soyad kısaltması, çerçeve cinsiyet rengi), tam ekran görünüm
// (Instagram profil fotoğrafı gibi) ve galeriden yükleme. Yükleme yalnız KYC onaylıysa; fotoğraf admin onayına düşer.
import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { showAlert } from '@/components/AppAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { File as FsFile } from 'expo-file-system';
import { api } from '@/lib/api';
import { BASE } from '@/lib/config';
import { gColor } from '@/lib/masa';
import { pickFromLibrary } from '@/lib/imagePick';
import { T } from './ui';
import { ll, tw } from '@/theme/theme';

export const KYC_PHOTO_MESSAGE = 'Profil fotoğrafı kimlik doğrulamasından sonra yüklenebilir.';
export const PENDING_PHOTO_MESSAGE = 'Fotoğrafın onay sürecinde.';
export const absPhoto = (u: string) => (u.startsWith('/') ? `${BASE}${u}` : u);

export function PencilIcon({ size = 16, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20h9" /><Path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </Svg>
  );
}

// Palet renginde kalem ikonlu yuvarlak düzenleme butonu (en az 44 pt dokunma alanı)
export function EditBadge({ size, onPress }: { size: number; onPress: () => void }) {
  const pad = Math.max(0, (44 - size) / 2);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Profil fotoğrafını düzenle" hitSlop={pad}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, backgroundColor: tw.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0a0a0a', opacity: pressed ? 0.8 : 1 })}>
      <PencilIcon size={Math.round(size * 0.45)} />
    </Pressable>
  );
}

export function Avatar({ photoUrl, initials, gender, size, borderWidth = 2 }: { photoUrl?: string | null; initials: string; gender?: string | null; size: number; borderWidth?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth, borderColor: gColor(gender), alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)' }}>
      {photoUrl
        ? <Image source={{ uri: absPhoto(photoUrl) }} style={{ width: '100%', height: '100%' }} accessibilityLabel="Profil fotoğrafı" />
        : <T w={700} style={{ fontSize: Math.round(size * 0.3), color: tw.text }}>{initials}</T>}
    </View>
  );
}

// Galeriden seç (kamera yok) → yükle. Sonuç: true yüklendi, false vazgeçildi; hata mesajı Ahenk uyarı penceresiyle (showAlert)
export async function pickAndUploadProfilePhoto(kycApproved: boolean): Promise<boolean> {
  if (!kycApproved) { showAlert('Profil Fotoğrafı', KYC_PHOTO_MESSAGE); return false; }
  const picked = await pickFromLibrary(1);
  if (picked === 'denied') { showAlert('Profil Fotoğrafı', 'Galeri izni verilmedi.'); return false; }
  if (!picked.length) return false;
  const p = picked[0];
  const form = new FormData();
  // Global fetch (expo/fetch) RN'nin { uri, name, type } parçasını desteklemiyor ("Unsupported FormDataPart implementation");
  // expo-file-system File nesnesi dosya içeriğini sağladığı için gövdeye yazılır (ProblemReport / admin mekân fotoğrafı ile aynı yöntem)
  form.append('photo', new FsFile(p.uri) as unknown as Blob);
  try { await api.form('/users/me/profile-photo', form); showAlert('Profil Fotoğrafı', PENDING_PHOTO_MESSAGE); return true; }
  catch (e) { showAlert('Profil Fotoğrafı', (e as Error).message); return false; }
}

// Tam ekran büyük görünüm (Instagram profil fotoğrafı gibi); ekrana (fotoğraf dahil) basınca ya da geri tuşuyla kapanır.
// onEdit verilirse fotoğrafın sağ altında düzenleme butonu (yalnız ona basmak yükleme akışını açar)
export function PhotoViewer({ url, visible, onClose, onEdit }: { url: string | null; visible: boolean; onClose: () => void; onEdit?: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const size = Math.min(width - 48, height - insets.top - insets.bottom - 96);
  return (
    <Modal visible={visible && !!url} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} accessibilityLabel="Kapat" style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
        {!!url && (
          <View style={{ width: size, height: size }}>
            <Image source={{ uri: absPhoto(url) }} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" accessibilityLabel="Profil fotoğrafı" />
            {onEdit && <View style={{ position: 'absolute', right: size * 0.08, bottom: size * 0.08 }}><EditBadge size={48} onPress={onEdit} /></View>}
          </View>
        )}
      </Pressable>
    </Modal>
  );
}

// Profilim ekranının en üstündeki büyük yuvarlak profil alanı; sağ altta kalem ikonlu düzenleme butonu.
// Onay bekleyen fotoğraf varsa dairenin altında küçük punto "Fotoğrafın onay sürecinde." (onay / retle /auth/me'den kalkar)
export function ProfilePhotoHeader({ photoUrl, initials, gender, kycApproved, pending }: { photoUrl?: string | null; initials: string; gender?: string | null; kycApproved: boolean; pending?: boolean }) {
  const SIZE = 112;
  const [isPending, setPending] = useState(!!pending);
  useEffect(() => { setPending(!!pending); }, [pending]);
  // Fotoğrafa basınca tam ekran büyük görünüm; kalem (dairedeki ya da büyük görünümdeki) mevcut yükleme akışını açar
  const [viewer, setViewer] = useState(false);
  const upload = () => { pickAndUploadProfilePhoto(kycApproved).then((ok) => { if (ok) setPending(true); }).catch(() => undefined); };
  return (
    <View style={{ alignItems: 'center', marginBottom: 24 }}>
      <View style={{ width: SIZE, height: SIZE }}>
        <Pressable disabled={!photoUrl} onPress={() => setViewer(true)} accessibilityRole="imagebutton" accessibilityLabel="Profil fotoğrafını büyüt">
          <Avatar photoUrl={photoUrl} initials={initials} gender={gender} size={SIZE} borderWidth={3} />
        </Pressable>
        <View style={{ position: 'absolute', right: 0, bottom: 0 }}><EditBadge size={36} onPress={upload} /></View>
      </View>
      <PhotoViewer url={photoUrl ?? null} visible={viewer} onClose={() => setViewer(false)} onEdit={() => { setViewer(false); upload(); }} />
      {isPending && <T style={{ marginTop: 10, fontSize: 12, color: ll.label }}>{PENDING_PHOTO_MESSAGE}</T>}
    </View>
  );
}
