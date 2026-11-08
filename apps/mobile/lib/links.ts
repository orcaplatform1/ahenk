import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SITE } from './config';

// S-16: yasal sayfalar uygulama içi tarayıcıda
export function openLegal(path: string) {
  return WebBrowser.openBrowserAsync(`${SITE}${path}`);
}

// S-28: HARİTADA GÖR → Apple Haritalar / Google Maps seçimi
export function openMaps(mapsUrl?: string | null, address?: string | null, label?: string | null) {
  const q = encodeURIComponent(address || label || '');
  const google = mapsUrl || `https://maps.google.com/?q=${q}`;
  const apple = `http://maps.apple.com/?q=${q}`;
  const options = ['Apple Haritalar', 'Google Maps', 'Vazgeç'];
  const pick = (i: number) => { if (i === 0) Linking.openURL(apple); else if (i === 1) Linking.openURL(google); };
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, pick);
  } else {
    Alert.alert('Haritada Gör', undefined, [
      { text: options[0], onPress: () => pick(0) },
      { text: options[1], onPress: () => pick(1) },
      { text: options[2], style: 'cancel' },
    ]);
  }
}
