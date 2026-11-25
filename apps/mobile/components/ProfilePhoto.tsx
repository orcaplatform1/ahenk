// Profil fotoğrafı: yuvarlak avatar (fotoğraf yoksa ad soyad kısaltması, çerçeve cinsiyet rengi), tam ekran görünüm
// (Instagram profil fotoğrafı gibi) ve galeriden yükleme. Yükleme yalnız KYC onaylıysa; fotoğraf admin onayına düşer.
import { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, useWindowDimensions, View } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { BlurView } from 'expo-blur';
import { addScreenCaptureListener, isScreenCaptured } from '@/modules/screen-recording';
import { PhotoCropper } from './PhotoCropper';
import { showAlert } from '@/components/AppAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { File as FsFile } from 'expo-file-system';
import { api } from '@/lib/api';
import { BASE } from '@/lib/config';
import { gColor } from '@/lib/masa';
import { pickFromLibrary } from '@/lib/imagePick';
import { StdButton, T } from './ui';
import { ll, sheet, tw } from '@/theme/theme';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';

export const absPhoto = (u: string) => (u.startsWith('/') ? `${BASE}${u}` : u);

function PencilIcon({ size = 16, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20h9" /><Path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </Svg>
  );
}

// Palet renginde kalem ikonlu yuvarlak düzenleme butonu (en az 44 pt dokunma alanı)
function EditBadge({ size, onPress }: { size: number; onPress: () => void }) {
  const pad = Math.max(0, (44 - size) / 2);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={i18n.t('photo.edit')} hitSlop={pad}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, backgroundColor: tw.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0a0a0a', opacity: pressed ? 0.8 : 1 })}>
      <PencilIcon size={Math.round(size * 0.45)} />
    </Pressable>
  );
}

export function Avatar({ photoUrl, initials, gender, size, borderWidth = 2 }: { photoUrl?: string | null; initials: string; gender?: string | null; size: number; borderWidth?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth, borderColor: gColor(gender), alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)' }}>
      {photoUrl
        ? <Image source={{ uri: absPhoto(photoUrl) }} style={{ width: '100%', height: '100%' }} accessibilityLabel={i18n.t('photo.alt')} />
        : <T w={700} style={{ fontSize: Math.round(size * 0.3), color: tw.text }}>{initials}</T>}
    </View>
  );
}

// Galeriden seç (kamera yok) → kırpma ekranı. Sonuç: seçilen görselin uri'si; null vazgeçildi / izin yok / KYC onaysız
async function pickProfilePhoto(kycApproved: boolean): Promise<string | null> {
  if (!kycApproved) { showAlert(i18n.t('photo.title'), i18n.t('photo.kycFirst')); return null; }
  const picked = await pickFromLibrary(1);
  if (picked === 'blocked') return null;
  if (picked === 'denied') { showAlert(i18n.t('photo.title'), i18n.t('photo.galleryDenied')); return null; }
  return picked.length ? picked[0].uri : null;
}

// Kırpılmış görseli yükle (mevcut yükleme akışı). Sonuç: true yüklendi; hata mesajı Ahenk uyarı penceresiyle (showAlert)
async function uploadProfilePhoto(uri: string): Promise<boolean> {
  const form = new FormData();
  // Global fetch (expo/fetch) RN'nin { uri, name, type } parçasını desteklemiyor ("Unsupported FormDataPart implementation");
  // expo-file-system File nesnesi dosya içeriğini sağladığı için gövdeye yazılır (ProblemReport / admin mekân fotoğrafı ile aynı yöntem)
  form.append('photo', new FsFile(uri) as unknown as Blob);
  try { await api.form('/users/me/profile-photo', form); showAlert(i18n.t('photo.title'), i18n.t('photo.pending')); return true; }
  catch (e) { showAlert(i18n.t('photo.title'), (e as Error).message); return false; }
}

// Büyütülmüş görünüm koruması (yalnız görünüm açıkken; kapanınca kalkar). Android: ekran görüntüsü ve kaydı FLAG_SECURE ile engellenir.
// iOS: ekran kaydı / yansıtma sürerken fotoğraf yerine koyu bulanık alan + uyarı yazısı; ekran görüntüsü alınınca uyarı penceresi ve
// POST /users/me/screenshot-log (ScreenshotLog + admin uyarısı)
const CAPTURE_KEY = 'ahenk-photo-viewer';
function useViewerProtection(active: boolean, url: string | null) {
  const [captured, setCaptured] = useState(false);
  const [shot, setShot] = useState(false);
  useEffect(() => {
    if (!active || !url) return;
    if (Platform.OS === 'android') {
      ScreenCapture.preventScreenCaptureAsync(CAPTURE_KEY).catch(() => undefined);
      return () => { ScreenCapture.allowScreenCaptureAsync(CAPTURE_KEY).catch(() => undefined); };
    }
    if (Platform.OS !== 'ios') return;
    setCaptured(isScreenCaptured());
    const rec = addScreenCaptureListener(setCaptured);
    const sub = ScreenCapture.addScreenshotListener(() => {
      setShot(true);
      api.post('/users/me/screenshot-log', { photoUrl: url, platform: 'ios' }).catch(() => undefined);
    });
    return () => { rec.remove(); sub.remove(); setCaptured(false); };
  }, [active, url]);
  return { captured, shot, dismissShot: () => setShot(false) };
}

// Tam ekran büyük görünüm (Instagram profil fotoğrafı gibi); ekrana (fotoğraf dahil) basınca ya da geri tuşuyla kapanır.
// onEdit verilirse fotoğrafın sağ altında düzenleme butonu (yalnız ona basmak yükleme akışını açar)
export function PhotoViewer({ url, visible, onClose, onEdit }: { url: string | null; visible: boolean; onClose: () => void; onEdit?: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const size = Math.min(width - 48, height - insets.top - insets.bottom - 96);
  const { captured, shot, dismissShot } = useViewerProtection(visible && !!url, url);
  return (
    <Modal visible={visible && !!url} transparent animationType="fade" onRequestClose={() => { if (shot) dismissShot(); else onClose(); }} statusBarTranslucent>
      <Pressable onPress={onClose} accessibilityLabel={i18n.t('common.close')} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
        {!!url && (
          <View style={{ width: size, height: size }}>
            {captured ? (
              // Ekran kaydı / yansıtma sürerken fotoğraf çizilmez: koyu bulanık alan + uyarı
              <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
                <BlurView intensity={80} tint="dark" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
                <T w={600} style={{ fontSize: 15, lineHeight: 21, color: ll.text, textAlign: 'center', paddingHorizontal: size * 0.15 }}>{i18n.t('photo.recordingHidden')}</T>
              </View>
            ) : (
              <Image source={{ uri: absPhoto(url) }} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" accessibilityLabel={i18n.t('photo.alt')} />
            )}
            {onEdit && <View style={{ position: 'absolute', right: size * 0.08, bottom: size * 0.08 }}><EditBadge size={48} onPress={onEdit} /></View>}
          </View>
        )}
        {shot && (
          // Ekran görüntüsü uyarısı (Ahenk uyarı penceresi görünümü; görünüm Modal içinde olduğu için burada çizilir). Tek buton: Anladım
          <Pressable onPress={() => undefined} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: sheet.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <View accessibilityRole="alert" style={{ width: '100%', maxWidth: 400, backgroundColor: sheet.bg, borderWidth: 1, borderColor: sheet.border, borderRadius: sheet.radius, padding: 24, gap: 12 }}>
              <T style={{ fontSize: 15, lineHeight: 21, color: ll.text, textAlign: 'center' }}>{i18n.t('photo.screenshotWarn')}</T>
              <StdButton variant="primary" label={i18n.t('photo.screenshotGotIt')} onPress={dismissShot} style={{ width: '100%', marginTop: 8 }} />
            </View>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

// Profilim ekranının en üstündeki büyük yuvarlak profil alanı; sağ altta kalem ikonlu düzenleme butonu.
// Onay bekleyen fotoğraf varsa dairenin altında küçük punto "Fotoğrafın onay sürecinde." (onay / retle /auth/me'den kalkar)
export function ProfilePhotoHeader({ photoUrl, initials, gender, kycApproved, pending }: { photoUrl?: string | null; initials: string; gender?: string | null; kycApproved: boolean; pending?: boolean }) {
  const SIZE = 112;
  const { t } = useTranslation();
  const [isPending, setPending] = useState(!!pending);
  useEffect(() => { setPending(!!pending); }, [pending]);
  // Fotoğrafa basınca tam ekran büyük görünüm; kalem (dairedeki ya da büyük görünümdeki) mevcut yükleme akışını açar
  const [viewer, setViewer] = useState(false);
  // Galeriden seç → kırpma ekranı (İptal / Bitti) → kırpılmış kare görsel mevcut yükleme akışıyla gider
  const [cropUri, setCropUri] = useState<string | null>(null);
  const upload = () => { pickProfilePhoto(kycApproved).then((u) => { if (u) setCropUri(u); }).catch(() => undefined); };
  const cropped = (u: string) => { setCropUri(null); uploadProfilePhoto(u).then((ok) => { if (ok) setPending(true); }).catch(() => undefined); };
  return (
    <View style={{ alignItems: 'center', marginBottom: 24 }}>
      <View style={{ width: SIZE, height: SIZE }}>
        <Pressable disabled={!photoUrl} onPress={() => setViewer(true)} accessibilityRole="imagebutton" accessibilityLabel={t('masa.enlargePhoto')}>
          <Avatar photoUrl={photoUrl} initials={initials} gender={gender} size={SIZE} borderWidth={3} />
        </Pressable>
        <View style={{ position: 'absolute', right: 0, bottom: 0 }}><EditBadge size={36} onPress={upload} /></View>
      </View>
      <PhotoViewer url={photoUrl ?? null} visible={viewer} onClose={() => setViewer(false)} onEdit={() => { setViewer(false); upload(); }} />
      <PhotoCropper uri={cropUri} onCancel={() => setCropUri(null)} onDone={cropped} />
      {isPending && <T style={{ marginTop: 10, fontSize: 12, color: ll.label }}>{t('photo.pending')}</T>}
    </View>
  );
}
