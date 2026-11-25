// Dünya ikonu (dil seçici): solunda seçili dilin kısaltması (TR / EN; 13 pt, #FFFFFF, opaklık 0.7, 6 pt boşluk), görünen ikon 24×24,
// dokunma alanı 44×44. Basınca altında kart (köşe 12): Türkçe / English, seçilide ✓. Kart zemini, yazı ve ✓ rengi tema paletinden
// (ll.bg zemin + llCard çerçeve, ll.text yazı, seçili satır tabBar.activeBg, ✓ ll.red); sistem grisi yok. ENGLISH_ENABLED = false iken görünmez.
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { ENGLISH_ENABLED, type Lang } from '@ahenk/shared';
import { chooseLanguage, currentLang } from '@/lib/i18n';
import { api } from '@/lib/api';
import { ll, llCard, tabBar } from '@/theme/theme';

export function GlobeIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="9.5" /><Ellipse cx="12" cy="12" rx="4" ry="9.5" /><Path d="M2.5 12 H21.5" /><Path d="M3.8 7.5 Q12 10 20.2 7.5" /><Path d="M3.8 16.5 Q12 14 20.2 16.5" />
    </Svg>
  );
}

// top: dokunma alanının (44 pt) üst kenarı; sağdan 20 pt. Menü kartı dokunma alanının 4 pt altında açılır
export function LanguageSwitcher({ top }: { top: number }) {
  useTranslation(); // dil değişince yeniden çizilir
  const [open, setOpen] = useState(false);
  if (!ENGLISH_ENABLED) return null;
  const lang = currentLang();

  async function choose(l: Lang) {
    setOpen(false);
    if (l === lang) return;
    await chooseLanguage(l);
    if (await api.hasSession()) api.patch('/users/me/language', { language: l }).catch(() => undefined);
  }

  return (
    <View style={{ position: 'absolute', top, right: 20, zIndex: 20 }}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button" accessibilityLabel="Dil / Language"
        style={{ minWidth: 44, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
        <Text style={{ fontSize: 13, color: '#FFFFFF', opacity: 0.7 }}>{lang === 'en' ? 'EN' : 'TR'}</Text>
        <GlobeIcon />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)}>
          {(
            <View style={{ position: 'absolute', top: top + 48, right: 20, backgroundColor: ll.bg, borderWidth: llCard.borderWidth, borderColor: llCard.borderColor, borderRadius: 12, padding: 4, minWidth: 140 }}>
              {([['tr', 'Türkçe'], ['en', 'English']] as const).map(([l, label]) => (
                <Pressable key={l} onPress={() => choose(l)} accessibilityRole="button" accessibilityState={{ selected: lang === l }}
                  style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 12, borderRadius: 8, backgroundColor: lang === l ? tabBar.activeBg : 'transparent' }}>
                  <Text style={{ color: ll.text, fontSize: 14 }}>{label}</Text>
                  {lang === l && <Text style={{ color: ll.red, fontSize: 14 }}>✓</Text>}
                </Pressable>
              ))}
            </View>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}
