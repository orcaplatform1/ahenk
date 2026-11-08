// Galeri / kamera görsel seçimi (expo-image-picker). KYC bu yardımcıyı kullanmaz (yalnız kamera, components/profil/KycTab.tsx).
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface PickedImage { uri: string; name: string; type: string; size?: number }

const toPicked = (a: ImagePicker.ImagePickerAsset, i: number): PickedImage => ({
  uri: a.uri,
  name: a.fileName ?? `image-${Date.now()}-${i}.jpg`,
  type: a.mimeType ?? 'image/jpeg',
  size: a.fileSize,
});

export async function pickFromLibrary(limit: number): Promise<PickedImage[] | 'denied'> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return 'denied';
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: limit > 1, selectionLimit: limit, quality: 0.85 });
  return r.canceled ? [] : r.assets.slice(0, limit).map(toPicked);
}

export async function pickFromCamera(): Promise<PickedImage[] | 'denied'> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return 'denied';
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
  return r.canceled ? [] : r.assets.map(toPicked);
}

// Galeriden seç / Kamerayla çek seçimi
export function chooseSource(onPick: (src: 'library' | 'camera') => void) {
  const options = ['Galeriden Seç', 'Kamerayla Çek', 'Vazgeç'];
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, (i) => { if (i === 0) onPick('library'); else if (i === 1) onPick('camera'); });
  } else {
    Alert.alert('Fotoğraf ekle', undefined, [
      { text: options[0], onPress: () => onPick('library') },
      { text: options[1], onPress: () => onPick('camera') },
      { text: options[2], style: 'cancel' },
    ]);
  }
}
