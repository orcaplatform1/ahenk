import { ActionSheetIOS, Linking, Platform } from 'react-native';
import { showAlert } from '@/components/AppAlert';
import * as WebBrowser from 'expo-web-browser';
import { SITE } from './config';
import { localizedPath } from '@ahenk/shared';
import i18n, { currentLang } from './i18n';

// S-16: yasal sayfalar uygulama içi tarayıcıda, seçili dilde (İngilizce /en önekli)
export function openLegal(path: string) {
  return WebBrowser.openBrowserAsync(`${SITE}${localizedPath(path, currentLang())}`);
}

// S-28: HARİTADA GÖR → Apple Haritalar / Google Maps seçimi
export function openMaps(mapsUrl?: string | null, address?: string | null, label?: string | null) {
  const q = encodeURIComponent(address || label || '');
  const google = mapsUrl || `https://maps.google.com/?q=${q}`;
  const apple = `http://maps.apple.com/?q=${q}`;
  const options = [i18n.t('masa.appleMaps'), 'Google Maps', i18n.t('masa.dismiss')];
  const pick = (i: number) => { if (i === 0) Linking.openURL(apple); else if (i === 1) Linking.openURL(google); };
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, pick);
  } else {
    showAlert(i18n.t('masa.seeOnMap'), undefined, [
      { text: options[0], onPress: () => pick(0) },
      { text: options[1], onPress: () => pick(1) },
      { text: options[2], style: 'cancel' },
    ]);
  }
}
