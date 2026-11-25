// Profil fotoğrafı kırpma ekranı (WhatsApp / Instagram gibi): tam ekran, yuvarlak kırpma çerçevesi; tek parmakla sürükle, iki parmakla
// yakınlaştır. "İptal" / "Bitti" (HIG: üst çubukta solda vazgeç, sağda onay; dokunma alanı en az 44 pt). Bitti → çerçevedeki kare alan
// expo-image-manipulator ile kırpılır, kırpılmış dosyanın uri'si döner (yükleme akışı aynen: çağıran gönderir).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, PanResponder, Pressable, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import { T } from './ui';
import { showAlert } from './AppAlert';
import { ll } from '@/theme/theme';

const MAX_ZOOM = 4;

const dist = (e: GestureResponderEvent) => {
  const [a, b] = e.nativeEvent.touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
};

export function PhotoCropper({ uri, onCancel, onDone }: { uri: string | null; onCancel: () => void; onDone: (croppedUri: string) => void }) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const D = Math.min(width - 32, height * 0.6); // kırpma dairesinin çapı
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSize(null); setZoom(1); setTx(0); setTy(0);
    if (uri) Image.getSize(uri, (w, h) => setSize({ w, h }), () => setSize(null));
  }, [uri]);

  const base = size ? D / Math.min(size.w, size.h) : 1; // zoom 1: kısa kenar daireyi doldurur
  const clamp = (z: number, x: number, y: number) => {
    if (!size) return { x: 0, y: 0 };
    const mx = Math.max(0, (size.w * base * z - D) / 2);
    const my = Math.max(0, (size.h * base * z - D) / 2);
    return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  };

  // Hareket başlangıcı: dokunuş sayısı değişince yeniden alınır (sürükle ↔ yakınlaştır geçişi zıplamasın)
  const st = useRef({ touches: 0, zoom: 1, tx: 0, ty: 0, dist: 1, x: 0, y: 0 });
  const live = useRef({ zoom, tx, ty });
  live.current = { zoom, tx, ty };
  const clampRef = useRef(clamp);
  clampRef.current = clamp;

  const responder = useMemo(() => {
    const begin = (e: GestureResponderEvent) => {
      const n = e.nativeEvent.touches.length;
      st.current = { touches: n, zoom: live.current.zoom, tx: live.current.tx, ty: live.current.ty, dist: n >= 2 ? dist(e) : 1, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: begin,
      onPanResponderMove: (e) => {
        const n = e.nativeEvent.touches.length;
        if (n !== st.current.touches) { begin(e); return; }
        if (n >= 2) {
          const z = Math.max(1, Math.min(MAX_ZOOM, st.current.zoom * (dist(e) / st.current.dist)));
          const c = clampRef.current(z, st.current.tx, st.current.ty);
          setZoom(z); setTx(c.x); setTy(c.y);
        } else {
          const c = clampRef.current(st.current.zoom, st.current.tx + (e.nativeEvent.pageX - st.current.x), st.current.ty + (e.nativeEvent.pageY - st.current.y));
          setTx(c.x); setTy(c.y);
        }
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, []);

  const done = async () => {
    if (!uri || !size || busy) return;
    setBusy(true);
    try {
      const k = base * zoom;
      const side = Math.min(D / k, size.w, size.h);
      const cx = size.w / 2 - tx / k;
      const cy = size.h / 2 - ty / k;
      const originX = Math.max(0, Math.min(size.w - side, cx - side / 2));
      const originY = Math.max(0, Math.min(size.h - side, cy - side / 2));
      const r = await manipulateAsync(uri, [{ crop: { originX: Math.round(originX), originY: Math.round(originY), width: Math.floor(side), height: Math.floor(side) } }], { compress: 0.9, format: SaveFormat.JPEG });
      onDone(r.uri);
    } catch {
      onCancel();
      showAlert(t('photo.title'), t('photo.cropFailed'));
    } finally {
      setBusy(false);
    }
  };

  const cy = height / 2;
  const hole = `M0 0H${width}V${height}H0Z M${width / 2 - D / 2} ${cy}a${D / 2} ${D / 2} 0 1 0 ${D} 0a${D / 2} ${D / 2} 0 1 0 ${-D} 0Z`;
  const k = base * zoom;
  return (
    <Modal visible={!!uri} animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }} {...responder.panHandlers}>
        {size && uri && (
          <Image source={{ uri }} resizeMode="stretch" accessibilityIgnoresInvertColors
            style={{ position: 'absolute', width: size.w * k, height: size.h * k, left: width / 2 - (size.w * k) / 2 + tx, top: cy - (size.h * k) / 2 + ty }} />
        )}
        <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
          <Path d={hole} fill="rgba(0,0,0,0.6)" fillRule="evenodd" />
          <Circle cx={width / 2} cy={cy} r={D / 2} stroke="#fff" strokeWidth={1.5} fill="none" />
        </Svg>
        {!size && <View style={{ position: 'absolute', left: 0, right: 0, top: cy - 12, alignItems: 'center' }}><ActivityIndicator color="#fff" /></View>}
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 4, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 }}>
        <Pressable onPress={onCancel} disabled={busy} accessibilityRole="button" style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }}>
          <T style={{ fontSize: 17, color: ll.text }}>{t('photo.cropCancel')}</T>
        </Pressable>
        <Pressable onPress={done} disabled={busy || !size} accessibilityRole="button" style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', opacity: busy || !size ? 0.5 : 1 }}>
          {busy ? <ActivityIndicator color="#fff" /> : <T w={700} style={{ fontSize: 17, color: ll.text }}>{t('photo.cropDone')}</T>}
        </Pressable>
      </View>
    </Modal>
  );
}
