// Canlı Destek baloncuğu (mobil; web components/support/SupportBubble.tsx karşılığı). Yalnız açık destek sohbeti varken (Profilim →
// Canlı Destek'ten başlatılmış) her ekranda sağ altta sabit; sürüklenmez; yönetim panelinde, giriş ekranlarında ve sohbet ekranında yok.
// Baloncukta maskotun baloncuk sürümü (assets/destek-baloncuk.webp, 60 pt); kuyruktayken sıra numarası, yeni mesajda okunmamış sayı rozeti
// (ikisi de sağ üstte, maskotun üstünde) + hafif titreşim; temsilci bağlanınca hafif titreşim. Basınca sohbet açılır;
// sohbet herhangi bir şekilde kapanınca kaybolur. Yoklama yalnız açık sohbet varken ve uygulama ön plandayken (4 sn). Okundu yazmaz.
// HIG: 60 pt dokunma alanı, erişilebilirlik etiketi, güvenli alan; sekme çubuğu olan ekranlarda çubuğun üstünde.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Pressable, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api';
import { onSupportChange } from '@/lib/supportBus';
import { T } from './ui';
import { c, ll, tabIcon } from '@/theme/theme';

type Sum = { id: string; status: 'QUEUED' | 'ACTIVE'; position: number | null; unread: number } | null;
const HIDE = ['/admin', '/canli-destek', '/giris', '/kayit', '/tekrar-hosgeldin', '/sifremi', '/test', '/odeme-sonuc', '/kanka', '/davet'];
const TAB_PATHS = ['/', '/masalarim', '/profilim', '/paketim', '/bildirimler'];

export function SupportBubble() {
  const { t } = useTranslation();
  const router = useRouter();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const [sum, setSum] = useState<Sum>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const prev = useRef<Sum>(null);
  const hidden = HIDE.some((p) => path === p || path.startsWith(`${p}/`) || (p === '/sifremi' && path.startsWith(p)));

  useEffect(() => { const s = AppState.addEventListener('change', (st) => setAppActive(st === 'active')); return () => s.remove(); }, []);

  const load = useCallback(async () => {
    if (!(await api.hasSession())) { setSum(null); prev.current = null; return; }
    try {
      const r = await api.get<{ chat: Sum }>('/support/summary');
      const next = r.chat ?? null;
      const p = prev.current;
      // Hafif titreşim: temsilci bağlandığında ve yeni mesaj geldiğinde
      if (p && next && p.id === next.id && ((p.status === 'QUEUED' && next.status === 'ACTIVE') || next.unread > p.unread)) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      prev.current = next;
      setSum(next);
    } catch { /* ağ hatası: ekrandaki durum korunur */ }
  }, []);

  // Sohbet ekranından dönüşte ve sohbet başlatılınca / küçültülünce yeniden okunur (sohbet ekranındaki okumalar titreşim saymaz)
  useEffect(() => { if (hidden) { prev.current = null; return; } load(); }, [hidden, path, load]);
  useEffect(() => onSupportChange(() => { prev.current = null; load(); }), [load]);
  useEffect(() => {
    if (!sum || hidden || !appActive) return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [!!sum, hidden, appActive, load]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sum || hidden) return null;
  const bottom = insets.bottom + (TAB_PATHS.includes(path) ? tabIcon.barHeight + 12 : 16);
  const label = [t('sup.title'), sum.status === 'QUEUED' && sum.position ? t('sup.bubbleQueue', { pos: sum.position }) : '', sum.unread ? t('sup.bubbleUnread', { n: sum.unread }) : ''].filter(Boolean).join(', ');
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', right: 16, bottom }}>
      <Pressable onPress={() => router.push('/canli-destek')} accessibilityRole="button" accessibilityLabel={label}
        style={({ pressed }) => ({ width: 60, height: 60, borderRadius: 30, backgroundColor: c.red, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1,
          shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 8 })}>
        <Image source={require('@/assets/destek-baloncuk.webp')} accessible={false} style={{ width: 60, height: 60, borderRadius: 30 }} />
        {sum.status === 'QUEUED' && !!sum.position && (
          <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: ll.text, borderWidth: 2, borderColor: '#121212', alignItems: 'center', justifyContent: 'center' }}>
            <T w={700} style={{ fontSize: 11, color: c.red }}>{sum.position}</T>
          </View>
        )}
        {sum.unread > 0 && (
          <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: ll.text, borderWidth: 2, borderColor: '#121212', alignItems: 'center', justifyContent: 'center' }}>
            <T w={700} style={{ fontSize: 11, color: c.red }}>{sum.unread > 99 ? '99+' : sum.unread}</T>
          </View>
        )}
      </Pressable>
    </View>
  );
}
