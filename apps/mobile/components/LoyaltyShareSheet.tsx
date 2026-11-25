// Sadakat Programı "Paylaş" alt paneli (web apps/web/components/LoyaltyShareSheet.tsx karşılığı). 1. satır: WhatsApp, Telegram,
// Facebook kare kartlar (yalnız renkli marka logosu, erişilebilirlik etiketi uygulama adı); 2. satır: "Galeriye Kaydet" ve "Diğer".
// HIG: alt panel (sheet), sağ üstte 44×44 kapatma, dokunma alanları en az 44×44 pt, güvenli alan Sheet bileşeninde; galeri izni
// yalnız "Galeriye Kaydet"e basınca istenir (kalıcı reddedilmişse "Ayarlara Git").
// Sadakat paylaşım kartı (1080×1920, web drawLoyaltyCard düzeni) ekran dışında çizilir, Skia makeImageFromView ile PNG'ye çevrilip
// önbelleğe yazılır; "Galeriye Kaydet" bu dosyayı galeriye kaydeder.
// Instagram butonu INSTAGRAM_SHARE_ENABLED false iken gizli (kod duruyor; true olunca 1. satırın başına gelir): Android'de Instagram
// yüklüyse görsel doğrudan com.instagram.android'e gider; iOS'ta ve Instagram yoksa sistem paylaşımı açılır. Meta / Facebook App ID kullanılmaz.
import { useRef, useState } from 'react';
import { Image, Linking, PixelRatio, Platform, Pressable, Share, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import RNShare, { Social } from 'react-native-share';
import { makeImageFromView } from '@shopify/react-native-skia';
import * as MediaLibrary from 'expo-media-library/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { INSTAGRAM_SHARE_ENABLED, SHARE_BRAND_COLORS, SHARE_BRAND_PATHS } from '@ahenk/shared';
import { currentLang } from '@/lib/i18n';
import { mediaUrl } from '@/lib/venueApi';
import { HIT, Serif, Sheet, T } from './ui';
import { showAlert } from './AppAlert';
import { ensurePermission } from '@/lib/permissions';
import { ll, loyaltyCard, loyaltyCardLayout as LL, tw } from '@/theme/theme';

export interface LoyaltySharer { firstName: string; lastName: string; photoUrl: string | null }
type Target = 'instagram' | 'whatsapp' | 'telegram' | 'facebook';

// Resmî renkli marka logoları (web ile aynı): WhatsApp yeşil daire üzerinde beyaz logo; Telegram ve Facebook marka renginde daire, beyaz uçak / f
function BrandLogo({ target, size }: { target: Target; size: number }) {
  if (target === 'instagram') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={SHARE_BRAND_COLORS.instagram} strokeWidth={2}>
        <Rect x={3} y={3} width={18} height={18} rx={5} />
        <Circle cx={12} cy={12} r={4} />
        <Circle cx={17.5} cy={6.5} r={1} fill={SHARE_BRAND_COLORS.instagram} stroke="none" />
      </Svg>
    );
  }
  if (target === 'whatsapp') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={12} fill={SHARE_BRAND_COLORS.whatsapp} />
        <Path d={SHARE_BRAND_PATHS.whatsapp} fill="#ffffff" transform="translate(4.8 4.8) scale(0.6)" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10.5} fill="#ffffff" />
      <Path d={SHARE_BRAND_PATHS[target]} fill={SHARE_BRAND_COLORS[target]} />
    </Svg>
  );
}

const PANEL_BTN = { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' } as const;
const btnBg = (pressed: boolean) => (pressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)');

// Metin kutusunun üstü: taban çizgisi (1080 tabanında) − yazı tipi ascent'i − satır yüksekliğindeki boşluğun yarısı
const lineTop = (base: number, size: number, line: number, asc: number, desc: number) => base - asc * size - (line - (asc + desc) * size) / 2;
const TITLE_TOP = lineTop(LL.titleFirstBase, LL.titleSize, LL.titleLine, LL.serifAscent, LL.serifDescent);
const SUB1_BASE_IN_BOX = -lineTop(0, LL.sub1Size, LL.sub1Line, LL.interAscent, LL.interDescent);
const TITLE_BASE_IN_BOX = LL.titleFirstBase - TITLE_TOP;
// Son başlık satırının kutusu ile alt metin 1 kutusu arası (taban çizgileri arası titleSubGap)
const SUB1_GAP = LL.titleSubGap - SUB1_BASE_IN_BOX - (LL.titleLine - TITLE_BASE_IN_BOX);
// Alt metin 2 kutusu ile davet linki kutusu arası (link 40 / 50 satır; görünür boşluk sub2LinkGap)
const LINK_BASE_IN_BOX = -lineTop(0, 40, 50, LL.interAscent, LL.interDescent);
const SUB2_BASE_IN_BOX = -lineTop(0, LL.sub2Size, LL.sub2Line, LL.interAscent, LL.interDescent);
const SUB2_GAP = (Math.round(40 * LL.interAscent) + LL.sub2LinkGap + Math.round(LL.sub2Size * LL.interDescent)) - LINK_BASE_IN_BOX - (LL.sub2Line - SUB2_BASE_IN_BOX);
// "Ahenk" (84 / 116 satır) taban çizgisi 298: kutu üstü logonun (96 + 120) altına göre
const BRAND_TOP = lineTop(298, 84, 116, LL.serifAscent, LL.serifDescent);

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

  async function saveToGallery() {
    if (busy) return;
    const ok = await ensurePermission(() => MediaLibrary.getPermissionsAsync(true), () => MediaLibrary.requestPermissionsAsync(true), t('perm.saveImage'));
    if (ok !== true) return;
    setBusy(true);
    try {
      const uri = await captureCard();
      if (!uri) { showAlert(t('share.saveFailed')); return; }
      try { await MediaLibrary.saveToLibraryAsync(uri); showAlert(t('loyalty.cardSaved')); } catch { showAlert(t('share.saveFailed')); }
    } finally { setBusy(false); }
  }

  const whatsapp = () => { Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`).catch(() => {})); };
  const telegram = () => { Linking.openURL(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(textNoLink)}`).catch(() => {}); };
  const facebook = () => { Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`).catch(() => {}); };
  const more = () => { Share.share({ message: text }).catch(() => {}); };

  const brands: [Target, string, () => void][] = [
    ...(INSTAGRAM_SHARE_ENABLED ? [['instagram', t('loyalty.shareInstagram'), instagram] as [Target, string, () => void]] : []),
    ['whatsapp', t('loyalty.shareWhatsapp'), whatsapp],
    ['telegram', t('loyalty.shareTelegram'), telegram],
    ['facebook', t('loyalty.shareFacebook'), facebook],
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
      {/* 1. satır: eşit genişlikte kare kartlar, yalnız renkli marka logosu */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {brands.map(([target, label, onPress]) => {
          const disabled = target === 'instagram' && busy;
          return (
            <Pressable key={target} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
              style={({ pressed }) => ({ ...PANEL_BTN, flex: 1, aspectRatio: 1, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: btnBg(pressed), opacity: disabled ? 0.5 : 1 })}>
              <BrandLogo target={target} size={40} />
            </Pressable>
          );
        })}
      </View>
      {/* 2. satır: Galeriye Kaydet ve Diğer, eşit genişlikte */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Pressable onPress={saveToGallery} disabled={busy} accessibilityRole="button" accessibilityLabel={t('loyalty.saveGallery')} accessibilityState={{ disabled: busy }}
          style={({ pressed }) => ({ ...PANEL_BTN, flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 12, backgroundColor: btnBg(pressed), opacity: busy ? 0.5 : 1 })}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={ll.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 3v12" /><Path d="m7 10 5 5 5-5" /><Path d="M5 21h14" />
          </Svg>
          <T w={600} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 15, color: ll.text, flexShrink: 1 }}>{t('loyalty.saveGallery')}</T>
        </Pressable>
        <Pressable onPress={more} accessibilityRole="button" accessibilityLabel={t('loyalty.shareMore')}
          style={({ pressed }) => ({ ...PANEL_BTN, flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 12, backgroundColor: btnBg(pressed) })}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill={ll.text}>
            <Circle cx={5} cy={12} r={2} /><Circle cx={12} cy={12} r={2} /><Circle cx={19} cy={12} r={2} />
          </Svg>
          <T w={600} numberOfLines={1} style={{ fontSize: 15, color: ll.text, flexShrink: 1 }}>{t('loyalty.shareMore')}</T>
        </Pressable>
      </View>

      {/* Ekran dışında çizilen paylaşım kartı (yalnız görsel hazırlanırken); düzen web drawLoyaltyCard ile aynı */}
      {capturing && (
        <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: 0 }}>
          <View ref={cardRef} collapsable={false} style={{ width: CARD_W, height: CARD_W * (1920 / 1080) }}>
            <LinearGradient colors={[loyaltyCard.bgFrom, loyaltyCard.bgTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ flex: 1, padding: 96 * k }}>
              <Image source={{ uri: loyaltyCard.bgUrl }} resizeMode="cover" onLoad={imageDone} onError={imageDone} accessible={false}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              {/* Üst (masa kartıyla aynı): logo "Ahenk" yazısının üstünde yatayda ortalı; etiket sağa yaslı, "Ahenk" yazısıyla aynı hizada */}
              <View style={{ position: 'absolute', left: 96 * k, top: 96 * k, alignItems: 'center' }}>
                <Image source={require('@/assets/logo-white.webp')} style={{ width: 120 * k, height: 120 * k }} accessible={false} />
                <Serif allowFontScaling={false} style={{ marginTop: (BRAND_TOP - 216) * k, fontSize: 84 * k, lineHeight: 116 * k, color: '#fff' }}>Ahenk</Serif>
              </View>
              <View style={{ position: 'absolute', right: 96 * k, top: 232 * k, height: 72 * k, borderRadius: 36 * k, paddingHorizontal: 28 * k, justifyContent: 'center', backgroundColor: loyaltyCard.accent }}>
                <T w={700} allowFontScaling={false} style={{ fontSize: 34 * k, lineHeight: 42 * k, color: '#fff' }}>{t('loyalty.cardTag').toLocaleUpperCase(lang === 'en' ? 'en' : 'tr-TR')}</T>
              </View>
              {/* Başlık (ilk taban çizgisi 839) ve hemen altında alt metin 1; sığmayan metin alt satıra geçer */}
              <View style={{ position: 'absolute', left: 96 * k, right: 96 * k, top: TITLE_TOP * k }}>
                <Serif allowFontScaling={false} style={{ fontSize: LL.titleSize * k, lineHeight: LL.titleLine * k, color: '#fff' }}>{t('loyalty.cardTitle1')}</Serif>
                <Serif allowFontScaling={false} style={{ fontSize: LL.titleSize * k, lineHeight: LL.titleLine * k, color: '#fff' }}>{t('loyalty.cardTitle2')}</Serif>
                <T allowFontScaling={false} style={{ marginTop: SUB1_GAP * k, fontSize: LL.sub1Size * k, lineHeight: LL.sub1Line * k, color: '#fff' }}>{t('loyalty.cardSub1')}</T>
              </View>
              <View style={{ flex: 1 }} />
              {/* Alt metin 2: davet linkinin hemen üstünde (görünür boşluk 16) */}
              <T w={500} allowFontScaling={false} style={{ marginBottom: SUB2_GAP * k, fontSize: LL.sub2Size * k, lineHeight: LL.sub2Line * k, color: 'rgba(255,255,255,0.75)' }}>{t('loyalty.cardSub2')}</T>
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
