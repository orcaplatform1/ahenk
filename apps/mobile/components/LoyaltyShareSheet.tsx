// Sadakat Programı "Paylaş" alt paneli (web apps/web/components/LoyaltyShareSheet.tsx karşılığı): Instagram, WhatsApp, Telegram,
// Facebook, Diğer. Sistem paylaşım penceresi yalnız "Diğer"de ve Instagram yedeğinde açılır.
// HIG: alt panel (sheet), sağ üstte 44×44 kapatma, satırlar en az 52 pt, güvenli alan Sheet bileşeninde.
// Instagram: Sadakat paylaşım kartı (1080×1920, web drawLoyaltyCard düzeni) ekran dışında çizilir, Skia makeImageFromView ile PNG'ye
// çevrilip önbelleğe yazılır. Android'de Instagram yüklüyse görsel doğrudan com.instagram.android'e gider; iOS'ta ve Instagram yoksa
// sistem paylaşımı açılır. Meta / Facebook App ID kullanılmaz.
import { useRef, useState } from 'react';
import { Image, Linking, PixelRatio, Platform, Pressable, Share, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import RNShare, { Social } from 'react-native-share';
import { makeImageFromView } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { SHARE_BRAND_COLORS, SHARE_BRAND_PATHS } from '@ahenk/shared';
import { currentLang } from '@/lib/i18n';
import { mediaUrl } from '@/lib/venueApi';
import { HIT, Serif, Sheet, T } from './ui';
import { showAlert } from './AppAlert';
import { ll, loyaltyCard, tw } from '@/theme/theme';

export interface LoyaltySharer { firstName: string; lastName: string; photoUrl: string | null }
type Target = 'instagram' | 'whatsapp' | 'telegram' | 'facebook' | 'more';

function BrandIcon({ target }: { target: Target }) {
  if (target === 'instagram') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={SHARE_BRAND_COLORS.instagram} strokeWidth={2}>
        <Rect x={3} y={3} width={18} height={18} rx={5} />
        <Circle cx={12} cy={12} r={4} />
        <Circle cx={17.5} cy={6.5} r={1} fill={SHARE_BRAND_COLORS.instagram} stroke="none" />
      </Svg>
    );
  }
  if (target === 'more') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill={ll.text}>
        <Circle cx={5} cy={12} r={2} /><Circle cx={12} cy={12} r={2} /><Circle cx={19} cy={12} r={2} />
      </Svg>
    );
  }
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill={SHARE_BRAND_COLORS[target]}>
      <Path d={SHARE_BRAND_PATHS[target]} />
    </Svg>
  );
}

const upper = (x: string) => x.toLocaleUpperCase('tr-TR');
// Kart görünümü 1080×1920 piksel çıksın diye nokta ölçüsü cihaz piksel oranına bölünür; bütün ölçüler 1080 tabanından k ile ölçeklenir
const CARD_W = 1080 / PixelRatio.get();
const k = CARD_W / 1080;

export function LoyaltyShareSheet({ visible, link, text, sharer, onClose }: { visible: boolean; link: string; text: string; sharer: LoyaltySharer | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<any>(null);
  const pending = useRef(0);
  const loaded = useRef<() => void>(() => undefined);
  const textNoLink = text.replace(link, '').trim();

  const first = (sharer?.firstName ?? '').trim();
  const last = (sharer?.lastName ?? '').trim();
  const sharerName = last ? `${first} ${upper(last[0])}.` : first;
  const initials = `${upper(first[0] ?? '')}${upper(last[0] ?? '')}`;
  const lang = currentLang();

  const imageDone = () => { pending.current -= 1; if (pending.current <= 0) loaded.current(); };

  // Kartı ekran dışında çizer, görseller yüklenince (en fazla 4 sn) PNG dosyasına çevirir
  async function captureCard(): Promise<string | null> {
    pending.current = sharer?.photoUrl ? 2 : 1;
    const ready = new Promise<void>((resolve) => { loaded.current = resolve; setTimeout(resolve, 4000); });
    setCapturing(true);
    try {
      await ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const img = await makeImageFromView(cardRef);
      if (!img) return null;
      const file = new File(Paths.cache, `ahenk-davet-${Date.now()}.png`);
      file.write(img.encodeToBase64(), { encoding: 'base64' });
      return file.uri;
    } catch {
      return null;
    } finally {
      setCapturing(false);
    }
  }

  async function instagram() {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await captureCard();
      if (!uri) { showAlert(t('share.saveFailed')); return; }
      try {
        if (Platform.OS === 'android' && (await RNShare.isPackageInstalled('com.instagram.android')).isInstalled) {
          await RNShare.shareSingle({ social: Social.Instagram, url: uri, type: 'image/png' });
          return;
        }
        await RNShare.open({ url: uri, type: 'image/png', failOnCancel: false });
      } catch { /* kullanıcı paylaşımı kapattı */ }
    } finally { setBusy(false); }
  }

  const whatsapp = () => { Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`).catch(() => {})); };
  const telegram = () => { Linking.openURL(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(textNoLink)}`).catch(() => {}); };
  const facebook = () => { Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`).catch(() => {}); };
  const more = () => { Share.share({ message: text }).catch(() => {}); };

  const actions: [Target, string, () => void][] = [
    ['instagram', t('loyalty.shareInstagram'), instagram],
    ['whatsapp', t('loyalty.shareWhatsapp'), whatsapp],
    ['telegram', t('loyalty.shareTelegram'), telegram],
    ['facebook', t('loyalty.shareFacebook'), facebook],
    ['more', t('loyalty.shareMore'), more],
  ];

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <T w={700} style={{ fontSize: 16, color: ll.text }} accessibilityRole="header">{t('loyalty.share')}</T>
        <Pressable onPress={onClose} hitSlop={HIT} accessibilityRole="button" accessibilityLabel={t('share.close')}
          style={{ width: 44, height: 44, marginRight: -10, alignItems: 'center', justifyContent: 'center' }}>
          <T style={{ fontSize: 24, lineHeight: 26, color: tw.muted }}>×</T>
        </Pressable>
      </View>
      <View style={{ gap: 8 }}>
        {actions.map(([target, label, onPress]) => {
          const disabled = target === 'instagram' && busy;
          return (
            <Pressable key={target} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
              style={({ pressed }) => ({ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)', opacity: disabled ? 0.5 : 1 })}>
              <BrandIcon target={target} />
              <T w={600} style={{ fontSize: 15, color: ll.text }}>{label}</T>
            </Pressable>
          );
        })}
      </View>

      {/* Ekran dışında çizilen paylaşım kartı (yalnız görsel hazırlanırken); düzen web drawLoyaltyCard ile aynı */}
      {capturing && (
        <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: 0 }}>
          <View ref={cardRef} collapsable={false} style={{ width: CARD_W, height: CARD_W * (1920 / 1080) }}>
            <LinearGradient colors={[loyaltyCard.bgFrom, loyaltyCard.bgTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ flex: 1, padding: 96 * k }}>
              <Image source={{ uri: loyaltyCard.bgUrl }} resizeMode="cover" onLoad={imageDone} onError={imageDone} accessible={false}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              {/* Üst: logo, hemen sağında "Ahenk", sağa yaslı etiket */}
              <View style={{ flexDirection: 'row', alignItems: 'center', height: 120 * k }}>
                <Image source={require('@/assets/logo-white.webp')} style={{ width: 120 * k, height: 120 * k }} accessible={false} />
                <Serif allowFontScaling={false} style={{ marginLeft: 24 * k, fontSize: 84 * k, lineHeight: 100 * k, color: '#fff' }}>Ahenk</Serif>
                <View style={{ flex: 1 }} />
                <View style={{ height: 72 * k, borderRadius: 36 * k, paddingHorizontal: 28 * k, justifyContent: 'center', backgroundColor: loyaltyCard.accent }}>
                  <T w={700} allowFontScaling={false} style={{ fontSize: 34 * k, lineHeight: 42 * k, color: '#fff' }}>{t('loyalty.cardTag').toLocaleUpperCase(lang === 'en' ? 'en' : 'tr-TR')}</T>
                </View>
              </View>
              {/* Orta blok: iki satır başlık, iki alt metin (dikeyde ortalı) */}
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Serif allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 96 * k, lineHeight: 110 * k, color: '#fff' }}>{t('loyalty.cardTitle1')}</Serif>
                <Serif allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 96 * k, lineHeight: 110 * k, color: '#fff' }}>{t('loyalty.cardTitle2')}</Serif>
                <T w={700} allowFontScaling={false} style={{ marginTop: 60 * k, fontSize: 50 * k, lineHeight: 64 * k, color: '#fff' }}>{t('loyalty.cardSub1')}</T>
                <T w={500} allowFontScaling={false} style={{ marginTop: 10 * k, fontSize: 42 * k, lineHeight: 56 * k, color: 'rgba(255,255,255,0.75)' }}>{t('loyalty.cardSub2')}</T>
              </View>
              {/* Davet linki, ayraç, en altta paylaşan kullanıcı */}
              <T w={600} allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 40 * k, lineHeight: 50 * k, color: '#fff', marginBottom: 40 * k }}>{link}</T>
              <View style={{ height: 2 * k, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 40 * k }} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 96 * k, height: 96 * k, borderRadius: 48 * k, borderWidth: 3 * k, borderColor: loyaltyCard.accent, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
                  {sharer?.photoUrl
                    ? <Image source={{ uri: mediaUrl(sharer.photoUrl) }} onLoad={imageDone} onError={imageDone} style={{ width: '100%', height: '100%' }} accessible={false} />
                    : <T w={700} allowFontScaling={false} style={{ fontSize: 36 * k, color: '#fff' }}>{initials}</T>}
                </View>
                <View style={{ marginLeft: 28 * k }}>
                  <T w={600} allowFontScaling={false} style={{ fontSize: 40 * k, lineHeight: 50 * k, color: '#fff' }}>{sharerName}</T>
                  <T allowFontScaling={false} style={{ fontSize: 30 * k, lineHeight: 38 * k, color: 'rgba(255,255,255,0.55)' }}>{t('loyalty.cardInvites')}</T>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>
      )}
    </Sheet>
  );
}
