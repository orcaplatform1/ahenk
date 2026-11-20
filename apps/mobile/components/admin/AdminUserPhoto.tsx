// web components/AdminUserPhoto.tsx karşılığı: kullanıcı profil fotoğrafı; basınca tam ekran büyük görünüm, "Sil" → onay penceresi.
// Önceki fotoğraf ihlali yoksa fotoğraf silinir ve kullanıcıya uyarı push'u gider; varsa askı süresi (3 / 15 / 30 gün) seçilir.
// HIG: en az 44 pt dokunma alanı; geri tuşu / dışarı dokunma kapatır.
import React, { useState } from 'react';
import { Image, Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/venueApi';
import { Avatar } from '@/components/ProfilePhoto';
import { AT } from './AdminUi';
import { adm } from '@/theme/theme';

export function AdminUserPhoto({ userId, photoUrl, initials, gender, size = 72, onDeleted }: {
  userId: string; photoUrl?: string | null; initials: string; gender?: string | null; size?: number; onDeleted?: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ prior: number } | null>(null);
  const [days, setDays] = useState<3 | 15 | 30 | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function askDelete() {
    setError(''); setDays(null);
    try { setConfirm({ prior: (await api.get<{ count: number }>(`/admin/users/${userId}/photo-violations`)).count }); }
    catch (e) { setError((e as Error).message); }
  }
  async function doDelete() {
    if (!confirm || (confirm.prior > 0 && !days)) return;
    setBusy(true); setError('');
    try {
      await api.post(`/admin/users/${userId}/profile-photo/delete`, confirm.prior > 0 ? { suspendDays: days } : {});
      setConfirm(null); setOpen(false); onDeleted?.();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const avatar = <Avatar photoUrl={photoUrl} initials={initials} gender={gender} size={size} borderWidth={size >= 48 ? 3 : 2} />;
  if (!photoUrl) return avatar;
  const btn = (color: string, on = false) => ({ minHeight: 44, flex: 1, borderRadius: 8, borderWidth: 1, borderColor: color, backgroundColor: on ? 'rgba(245,158,11,0.15)' : 'transparent', alignItems: 'center' as const, justifyContent: 'center' as const });

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="imagebutton" accessibilityLabel="Fotoğrafı büyüt">{avatar}</Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => (confirm ? setConfirm(null) : setOpen(false))} statusBarTranslucent>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 }}>
          <Image source={{ uri: mediaUrl(photoUrl) }} resizeMode="contain" style={{ width: width - 40, height: height * 0.65, borderRadius: 12 }} />
          <Pressable onPress={() => { void askDelete(); }} accessibilityRole="button"
            style={{ minHeight: 44, paddingHorizontal: 28, borderRadius: 10, borderWidth: 1, borderColor: adm.red, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <AT w={700} style={{ fontSize: 14, color: adm.red }}>Sil</AT>
          </Pressable>
          {!!error && !confirm && <AT style={{ fontSize: 12, color: adm.red }}>{error}</AT>}
          {confirm && (
            <Pressable onPress={() => undefined} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <View style={{ width: '100%', maxWidth: 380, backgroundColor: adm.card, borderWidth: 1, borderColor: adm.border, borderRadius: 14, padding: 18, gap: 12 }}>
                <AT w={700} style={{ fontSize: 15 }}>Fotoğraf silinsin mi?</AT>
                <AT style={{ fontSize: 12, color: adm.muted, lineHeight: 18 }}>
                  {confirm.prior === 0
                    ? 'Fotoğraf sunucudan silinir; kullanıcıya "Topluluk kurallarımıza aykırı olan uygunsuz fotoğrafınız kaldırılmıştır." bildirimi gider ve ihlal uyarı olarak kaydedilir.'
                    : `Kullanıcının önceki fotoğraf ihlali var (${confirm.prior}). Fotoğraf silinir ve hesap seçilen süre boyunca askıya alınır.`}
                </AT>
                {confirm.prior > 0 && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {([3, 15, 30] as const).map((d) => (
                      <Pressable key={d} onPress={() => setDays(d)} accessibilityRole="button" accessibilityState={{ selected: days === d }} style={btn(days === d ? adm.amber : adm.border, days === d)}>
                        <AT w={600} style={{ fontSize: 12, color: days === d ? adm.amber : adm.text }}>{d} gün</AT>
                      </Pressable>
                    ))}
                  </View>
                )}
                {!!error && <AT style={{ fontSize: 12, color: adm.red }}>{error}</AT>}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={() => setConfirm(null)} accessibilityRole="button" style={btn(adm.border)}><AT w={600} style={{ fontSize: 13 }}>Vazgeç</AT></Pressable>
                  <Pressable onPress={() => { void doDelete(); }} disabled={busy || (confirm.prior > 0 && !days)} accessibilityRole="button"
                    style={[btn(adm.red), { backgroundColor: adm.red, opacity: busy || (confirm.prior > 0 && !days) ? 0.5 : 1 }]}>
                    <AT w={700} style={{ fontSize: 13, color: '#fff' }}>{busy ? '…' : 'Onayla'}</AT>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </>
  );
}
