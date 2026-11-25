// web components/AdminNoShowDetail.tsx karşılığı: GELMEDİ detayı. Gelmeyenin fotoğrafı ve adı, bildirenler ve zamanı, önceki gelmedi
// uyarıları, "Uyarı ver" (hazır şablon push). Önceki gelmedi uyarısı varsa "Uyarı ver" pasif; yalnız "Askıya al" (3 gün / 15 gün / 1 ay).
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { api } from '@/lib/api';
import { showAlert } from '@/components/AppAlert';
import { AT } from './AdminUi';
import { AdminUserPhoto } from './AdminUserPhoto';
import { AdminSuspendButtons } from './UserParts';
import { adm } from '@/theme/theme';

export function AdminNoShowDetail({ meetingId, user, reports, onClose }: {
  meetingId: string;
  user: { id: string; name: string; photoUrl: string | null; gender?: string | null };
  reports: { reporterName: string; createdAt: string }[];
  onClose: () => void;
}) {
  const [warnings, setWarnings] = useState<{ count: number; warnedMeetingIds: string[] } | null>(null);
  const [history, setHistory] = useState<{ reason: string; createdAt: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(() => {
    api.get<{ noShowWarnings?: { count: number; warnedMeetingIds: string[] } }>(`/admin/users/${user.id}`).then((u) => setWarnings(u.noShowWarnings ?? { count: 0, warnedMeetingIds: [] })).catch((e: Error) => setError(e.message));
    api.get<{ type: string; reason: string; createdAt: string; meetingId?: string | null }[]>(`/admin/users/${user.id}/sanctions`).then((s) => setHistory(s.filter((x) => x.type === 'WARNING' && x.meetingId))).catch(() => {});
  }, [user.id]);
  useEffect(load, [load]);
  const fmt = (iso: string) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const hasWarning = (warnings?.count ?? 0) > 0;
  const warnedHere = !!warnings?.warnedMeetingIds.includes(meetingId);

  function warn() {
    showAlert('Kullanıcıya gelmedi uyarısı verilsin mi?', 'Hazır şablon bildirim gönderilir.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Uyarı ver', onPress: async () => {
      setBusy(true); setError(''); setMsg('');
      try { await api.post(`/admin/users/${user.id}/no-show-warning`, { meetingId }); setMsg('Uyarı verildi.'); load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    } }]);
  }
  function suspend(days: 3 | 15 | 30) {
    showAlert(`Kullanıcı ${days === 30 ? '1 ay' : `${days} gün`} askıya alınsın mı?`, undefined, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Onayla', style: 'destructive', onPress: async () => {
      setBusy(true); setError(''); setMsg('');
      try { await api.post(`/admin/users/${user.id}/sanction`, { type: 'SUSPENSION', days, reason: 'Masaya katılım sağlamama' }); setMsg('Askıya alındı.'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    } }]);
  }
  const initials = user.name.split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toLocaleUpperCase('tr-TR');

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Pressable onPress={() => undefined} style={{ width: '100%', maxWidth: 420, maxHeight: '90%', backgroundColor: adm.card, borderWidth: 1, borderColor: adm.border, borderRadius: 14, padding: 18 }}>
          <ScrollView contentContainerStyle={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <AdminUserPhoto userId={user.id} photoUrl={user.photoUrl} initials={initials} gender={user.gender} size={56} />
              <View>
                <AT w={700} style={{ fontSize: 14 }}>{user.name}</AT>
                <View style={{ alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 99, backgroundColor: adm.red }}><AT w={800} style={{ fontSize: 10, color: '#fff' }}>GELMEDİ</AT></View>
              </View>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: adm.border, paddingTop: 10 }}>
              <AT style={{ fontSize: 11, color: adm.muted, marginBottom: 4 }}>Bildirenler</AT>
              {reports.map((r, i) => <AT key={i} style={{ fontSize: 12 }}>{r.reporterName} · {fmt(r.createdAt)}</AT>)}
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: adm.border, paddingTop: 10 }}>
              <AT style={{ fontSize: 11, color: adm.muted, marginBottom: 4 }}>Önceki gelmedi uyarıları ({warnings?.count ?? '…'})</AT>
              {history.length === 0 ? <AT style={{ fontSize: 12, color: adm.muted }}>Uyarı yok</AT> : history.map((h, i) => <AT key={i} style={{ fontSize: 11, marginBottom: 4 }}>{fmt(h.createdAt)}: {h.reason}</AT>)}
            </View>
            <Pressable onPress={warn} disabled={busy || hasWarning || warnedHere} accessibilityRole="button"
              style={{ minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: adm.amber, alignItems: 'center', justifyContent: 'center', opacity: busy || hasWarning || warnedHere ? 0.4 : 1 }}>
              <AT w={600} style={{ fontSize: 12, color: adm.amber }}>Uyarı ver</AT>
            </Pressable>
            {hasWarning && (
              <>
                <AT style={{ fontSize: 11, color: adm.muted }}>Kullanıcının önceki gelmedi uyarısı var: yalnız askıya alınabilir.</AT>
                <AdminSuspendButtons busy={busy} color={adm.red} onPick={suspend} />
              </>
            )}
            {!!msg && <AT style={{ fontSize: 12, color: adm.green }}>{msg}</AT>}
            {!!error && <AT style={{ fontSize: 12, color: adm.red }}>{error}</AT>}
            <Pressable onPress={onClose} accessibilityRole="button" style={{ minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: adm.border, alignItems: 'center', justifyContent: 'center' }}>
              <AT w={600} style={{ fontSize: 13 }}>Kapat</AT>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
