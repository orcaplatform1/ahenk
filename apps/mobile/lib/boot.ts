// Açılış yüklemesi: 3 sn'lik açılış ekranı sürerken yazı tipleri ve görseller yüklenir (kök yerleşim ve açılış ekranı ortak kullanır)
import * as Font from 'expo-font';
import { Asset } from 'expo-asset';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_600SemiBold, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';

export const FONTS = {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
  DMSerifDisplay_400Regular, JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_600SemiBold, JetBrainsMono_700Bold,
};

const IMAGES = [
  require('@/assets/logo.png'), require('@/assets/start_logo.jpg'), require('@/assets/lock-icon.webp'),
  require('@/assets/maskot/jantihaydar_run.webp'), require('@/assets/maskot/jantihaydar_stop.webp'),
  require('@/assets/plan-masada.webp'), require('@/assets/plan-karsimda.webp'), require('@/assets/plan-icerde.webp'),
  require('@/assets/kyc-liveness-demo.png'),
];

let fontsPromise: Promise<void> | null = null;
export function loadFonts() { return (fontsPromise ??= Font.loadAsync(FONTS)); }
export function loadImages() { return Asset.loadAsync(IMAGES).then(() => undefined); }
