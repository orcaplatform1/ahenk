// packages/ui/src/components/tables/ShareCard.tsx karşılığı: "Ahenk Masa Dinamiği (Yapay Zekâ Raporu)" paylaşım kartı.
// Dikey kart: masa türü, Genel Uyum (büyük), masa DNA'sının kısa özeti, mekân, tarih ve saat, teaser + "Değiştir", alt satır.
// Diğer katılımcılara ait hiçbir bilgi gösterilmez. Paylaşım metnindeki link kullanıcının kişisel davet linkidir.
// HIG: modal sayfa, alt kısımda "Kapat", güvenli alan, en az 44 pt dokunma alanı.
import React, { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { formatCardDate } from '@ahenk/shared';
import { api } from '@/lib/api';
import { currentLang } from '@/lib/i18n';
import { BtnGhost, Serif, T } from './ui';
import { tw } from '@/theme/theme';

type MeetingKind = 'GROUP' | 'ONE_ON_ONE' | 'KANKA';
interface CardData { type: MeetingKind; uyumSkoru: number; dnaShort: string | null; venueName: string | null; scheduledAt: string; teaser: number; inviteLink: string }

// Masa türü renkleri (paket kartı paletinden: Grup mavi, Baş Başa kırmızı, Kankamla mor; web ShareCard ile aynı)
const TYPE_COLORS: Record<MeetingKind, { accent: string; from: string; to: string }> = {
  GROUP: { accent: '#3b7dd8', from: '#071a3a', to: '#1d4f9c' },
  ONE_ON_ONE: { accent: '#d6453a', from: '#3d0907', to: '#a3231b' },
  KANKA: { accent: '#8b5cf6', from: '#1f0a3a', to: '#5b2a9c' },
};

function ActionBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, minHeight: 44, borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 })}>
      <T w={600} style={{ fontSize: 13, color: '#f4f1ec' }}>{label}</T>
    </Pressable>
  );
}

export function ShareCardModal({ meetingId, onClose }: { meetingId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<CardData | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<CardData>(`/meetings/${meetingId}/share-card`).then(setData).catch((e: Error) => setErr(e.message));
  }, [meetingId]);

  const teaserText = data ? t(`share.teasers.${data.type}.t${data.teaser}`) : '';
  const shareText = data ? t('share.shareText', { teaser: teaserText, link: data.inviteLink }) : '';

  async function changeTeaser() {
    if (!data || busy) return;
    setBusy(true);
    try {
      const r = await api.post<{ teaser: number }>(`/meetings/${meetingId}/share-card/teaser`, {});
      setData({ ...data, teaser: r.teaser });
    } catch { /* kart aynen kalır */ } finally { setBusy(false); }
  }

  const whatsapp = () => { Linking.openURL(`whatsapp://send?text=${encodeURIComponent(shareText)}`).catch(() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(shareText)}`).catch(() => {})); };
  const message = () => { Linking.openURL(`sms:${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(shareText)}`).catch(() => {}); };
  const more = () => { Share.share({ message: shareText }).catch(() => {}); };

  const col = data ? TYPE_COLORS[data.type] : TYPE_COLORS.GROUP;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('share.close')} />
        <View style={{ maxHeight: '94%', backgroundColor: '#121212', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16, gap: 12 }}>
            {!!err && <T style={{ fontSize: 13, color: tw.accent, textAlign: 'center' }}>{err}</T>}
            {data && (
              <LinearGradient colors={['#0b0b0b', col.from, col.to]} locations={[0, 0.45, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ width: '100%', aspectRatio: 9 / 16, borderRadius: 14, padding: 22, justifyContent: 'space-between', overflow: 'hidden' }}>
                <View style={{ gap: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Serif style={{ fontSize: 26, color: '#fff' }}>Ahenk</Serif>
                    <View style={{ backgroundColor: col.accent, borderRadius: 9999, paddingVertical: 4, paddingHorizontal: 10, flexShrink: 1 }}>
                      <T w={700} numberOfLines={1} style={{ fontSize: 10, color: '#fff', letterSpacing: 0.6 }}>{t(`share.type${data.type}`).toLocaleUpperCase(currentLang() === 'en' ? 'en' : 'tr-TR')}</T>
                    </View>
                  </View>
                  <T w={600} style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 19 }}>{t('share.title')}</T>
                </View>
                <View>
                  <T w={800} style={{ fontSize: 84, lineHeight: 92, color: '#fff' }}>%{Math.max(0, Math.min(100, data.uyumSkoru))}</T>
                  <T w={700} style={{ fontSize: 16, color: '#4ade80' }}>{t('masa.aiOverall')}</T>
                  <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 14 }} />
                  {!!data.dnaShort && <Serif numberOfLines={3} style={{ fontSize: 18, lineHeight: 24, color: '#fff' }}>{data.dnaShort}</Serif>}
                </View>
                <View style={{ gap: 4 }}>
                  {!!data.venueName && <T w={700} numberOfLines={2} style={{ fontSize: 15, color: '#fff' }}>{data.venueName}</T>}
                  <T w={500} style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{formatCardDate(data.scheduledAt, currentLang())}</T>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1, flexDirection: 'row', gap: 10 }}>
                    <View style={{ width: 3, backgroundColor: col.accent, borderRadius: 2 }} />
                    <Serif style={{ flex: 1, fontSize: 15, lineHeight: 21, color: '#fff', fontStyle: 'italic' }}>“{teaserText}”</Serif>
                  </View>
                  <Pressable onPress={changeTeaser} disabled={busy} accessibilityRole="button" accessibilityLabel={t('share.change')} hitSlop={8}
                    style={{ minHeight: 44, minWidth: 44, borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
                    <T w={600} style={{ fontSize: 12, color: '#fff' }}>{t('share.change')}</T>
                  </Pressable>
                </View>
                <View>
                  <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 10 }} />
                  <T w={600} style={{ fontSize: 12, color: '#fff', textAlign: 'center' }}>{t('share.footer')}</T>
                </View>
              </LinearGradient>
            )}
            {data && (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <ActionBtn label={t('share.whatsapp')} onPress={whatsapp} />
                  <ActionBtn label={t('share.message')} onPress={message} />
                </View>
                <ActionBtn label={t('share.more')} onPress={more} />
              </View>
            )}
            <BtnGhost label={t('share.close')} full style={{ minHeight: 44 }} onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
