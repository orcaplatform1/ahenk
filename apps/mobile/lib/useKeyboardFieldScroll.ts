// Klavye açılınca odaklı alan ve altındaki ilk kutucuk klavyenin üstünde görünecek kadar kaydırılır (giriş / kayıt / şifre ekranları).
import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, type NativeScrollEvent, type NativeSyntheticEvent, Platform, type ScrollViewInstance, TextInput } from 'react-native';

// Odaklı alanın altında görünür kalacak pay: bir kutucuk (≈52) + aradaki boşluk (12) + nefes payı
const BELOW = 88;

export function useKeyboardFieldScroll() {
  const ref = useRef<ScrollViewInstance>(null);
  const y = useRef(0);
  const kbTop = useRef<number | null>(null);

  const reveal = useCallback(() => {
    const top = kbTop.current;
    const input = TextInput.State.currentlyFocusedInput();
    if (top == null || !input || !ref.current) return;
    input.measureInWindow((_x, iy, _w, h) => {
      const over = iy + h + BELOW - top;
      if (over > 0) ref.current?.scrollTo({ y: y.current + over, animated: true });
    });
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      kbTop.current = e.endCoordinates.screenY;
      // KeyboardAvoidingView yerleşimi bitince ölç
      setTimeout(reveal, Platform.OS === 'ios' ? 300 : 80);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => { kbTop.current = null; });
    return () => { show.remove(); hide.remove(); };
  }, [reveal]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => { y.current = e.nativeEvent.contentOffset.y; }, []);

  return { ref, onScroll, scrollEventThrottle: 16 } as const;
}
