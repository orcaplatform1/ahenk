// apps/web/app/admin/profil-fotograflari/page.tsx karşılığı: onay bekleyen profil fotoğrafları;
// yüklenen fotoğraf ve KYC kimlik ön yüzü yan yana (Bearer ile yüklenir), altında Onayla / Reddet
import { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { api } from '@/lib/api';
import { BASE } from '@/lib/config';
import { getAccess } from '@/lib/session';
import { Btn } from '@/components/ui';
import { ACard, AError, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { adm } from '@/theme/theme';

interface PendingPhoto { id: string; userId: string; createdAt: string; firstName: string; lastName: string; gender: string | null; photoUrl: string; idFrontUrl: string | null }
const abs = (u: string) => (u.startsWith('/') ? `${BASE}${u}` : u);

// Görsele basınca uygulama içinde tam ekran büyük görünüm (görselin tamamı, "contain"); ekrana basınca ya da geri tuşuyla kapanır
function FullView({ uri, token, label, onClose }: { uri: string | null; token: string | null; label: string; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} accessibilityLabel="Kapat" style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }}>
        {!!uri && !!token && <Image source={{ uri, headers: { Authorization: `Bearer ${token}` } }} resizeMode="contain" style={{ width, height }} accessibilityLabel={label} />}
      </Pressable>
    </Modal>
  );
}

function Preview({ url, label, token }: { url: string | null; label: string; token: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1, minWidth: 0, borderRadius: 8, overflow: 'hidden', backgroundColor: adm.surface, borderWidth: 1, borderColor: adm.border }}>
      <View style={{ aspectRatio: 1 }}>
        {url && token ? (
          <Pressable onPress={() => setOpen(true)} style={{ width: '100%', height: '100%' }} accessibilityRole="imagebutton" accessibilityLabel={`${label} — büyüt`}>
            <Image source={{ uri: abs(url), headers: { Authorization: `Bearer ${token}` } }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
          </Pressable>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><AT style={{ fontSize: 10, color: adm.muted }}>{url ? 'Yükleniyor…' : `${label} yok`}</AT></View>
        )}
      </View>
      <AT style={{ fontSize: 10, color: adm.muted, paddingVertical: 4, paddingHorizontal: 8 }}>{label}</AT>
      <FullView uri={open && url ? abs(url) : null} token={token} label={label} onClose={() => setOpen(false)} />
    </View>
  );
}

export default function AdminProfilePhotos() {
  const [items, setItems] = useState<PendingPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<Record<string, 'approve' | 'reject'>>({});
  const [token, setToken] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<PendingPhoto[]>('/admin/profile-photos').then(setItems).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { getAccess().then(setToken); load(); }, [load]);

  async function act(id: string, kind: 'approve' | 'reject') {
    setBusy(b => ({ ...b, [id]: kind })); setError('');
    try { await api.post(`/admin/profile-photos/${id}/${kind}`, {}); setItems(xs => xs.filter(x => x.id !== id)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(b => { const n = { ...b }; delete n[id]; return n; }); }
  }

  return (
    <APage maxWidth={880}>
      <View style={{ marginBottom: 24 }}><ATitle>Profil Fotoğrafları</ATitle></View>
      {!!error && <AError>{error}</AError>}
      {loading ? <AT style={{ fontSize: 13, color: adm.muted }}>Yükleniyor…</AT> : items.length === 0 ? (
        <ACard><AT style={{ fontSize: 13, color: adm.muted, textAlign: 'center' }}>Onay bekleyen profil fotoğrafı yok</AT></ACard>
      ) : (
        <View style={{ gap: 12 }}>
          {items.map(item => (
            <ACard key={item.id}>
              <AT w={600} style={{ fontSize: 14 }}>{item.firstName} {item.lastName}</AT>
              <AMono style={{ marginTop: 3, marginBottom: 12, fontSize: 10, color: adm.muted }}>{new Date(item.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</AMono>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <Preview url={item.photoUrl} label="Yüklenen Fotoğraf" token={token} />
                <Preview url={item.idFrontUrl} label="Kimlik Ön Yüz" token={token} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Btn variant="admOkMd" disabled={!!busy[item.id]} label={busy[item.id] === 'approve' ? '…' : 'Onayla'} onPress={() => act(item.id, 'approve')} />
                <Btn variant="admRejectMd" disabled={!!busy[item.id]} label={busy[item.id] === 'reject' ? '…' : 'Reddet'} onPress={() => act(item.id, 'reject')} />
              </View>
            </ACard>
          ))}
        </View>
      )}
    </APage>
  );
}
