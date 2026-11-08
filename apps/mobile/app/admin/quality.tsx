// apps/web/app/admin/quality/page.tsx karşılığı (Şikayetler)
import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { api } from '@/lib/api';
import { Btn } from '@/components/ui';
import { ACard, AError, ALabel, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { AdminSelect } from '@/components/admin/AdminControls';
import { adm } from '@/theme/theme';

interface Report { id: string; userId: string; userName: string; reason: string; detail?: string; createdAt: string; riskLevel: 'CRITICAL' | 'MEDIUM' }
const RC: Record<string, string> = { CRITICAL: adm.red, MEDIUM: adm.amber };
const RB: Record<string, string> = { CRITICAL: 'rgba(239,68,68,0.12)', MEDIUM: 'rgba(245,158,11,0.12)' };
const RBo: Record<string, string> = { CRITICAL: 'rgba(239,68,68,0.3)', MEDIUM: 'rgba(245,158,11,0.35)' };

export default function AdminQuality() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const load = () => { api.get<Report[]>('/admin/reports/pending').then(setReports).catch((e: Error) => setError(`Şikayetler yüklenemedi: ${e.message}`)).finally(() => setLoading(false)); };
  useEffect(() => { load(); api.get<string[]>('/admin/sanction-reasons').then(setReasons).catch(() => {}); }, []);
  async function quarantine(userId: string) {
    setBusy(userId + '_q'); setError('');
    try { await api.post(`/admin/users/${userId}/quarantine`, reason ? { reason } : {}); load(); } catch (e) { setError(`Askıya alınamadı: ${(e as Error).message}`); } finally { setBusy(null); }
  }
  function ban(userId: string) {
    Alert.alert('Kullanıcıyı ban et?', undefined, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Tamam', style: 'destructive', onPress: async () => {
      setBusy(userId + '_b'); setError('');
      try { await api.post(`/admin/users/${userId}/ban`, reason ? { reason } : {}); load(); } catch (e) { setError(`Banlanamadı: ${(e as Error).message}`); } finally { setBusy(null); }
    } }]);
  }
  return (
    <APage maxWidth={760}>
      <View style={{ marginBottom: 24 }}><ATitle>Şikayetler</ATitle></View>
      <AError>{error}</AError>
      <ACard style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ATitle>Şikayetler</ATitle>
          {!loading && <AMono style={{ fontSize: 10, marginLeft: 'auto' }}>{reports.length} kayıt</AMono>}
        </View>
        {loading ? <View style={{ gap: 6, padding: 16 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 48, backgroundColor: adm.surface, borderRadius: 8, opacity: 0.5 }} />)}</View>
          : reports.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}><AT style={{ fontSize: 32, marginBottom: 10 }}>✅</AT><AT w={600} style={{ fontSize: 13, color: adm.muted }}>Bekleyen şikayet yok</AT></View>
          ) : reports.map((r, i) => (
            <View key={r.id} style={{ borderBottomWidth: i < reports.length - 1 ? 1 : 0, borderBottomColor: 'rgba(26,58,92,0.5)' }}>
              <View style={{ paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <AT w={600} style={{ fontSize: 13 }}>{r.userName}</AT>
                    <ALabel style={{ paddingVertical: 2, paddingHorizontal: 7, borderRadius: 99, overflow: 'hidden', borderWidth: 1, backgroundColor: RB[r.riskLevel], borderColor: RBo[r.riskLevel], color: RC[r.riskLevel] }}>{r.riskLevel}</ALabel>
                  </View>
                  <AT style={{ fontSize: 11, color: adm.muted }}>{r.reason}</AT>
                  <AMono style={{ marginTop: 2, fontSize: 10 }}>{new Date(r.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</AMono>
                </View>
                <Btn variant="admReview" selected={expanded === r.id} label={expanded === r.id ? '▲' : '▼'} onPress={() => setExpanded(e => (e === r.id ? null : r.id))} />
              </View>
              {expanded === r.id && (
                <View style={{ marginHorizontal: 18, marginBottom: 14, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: adm.surface, borderWidth: 1, borderColor: adm.border, gap: 10 }}>
                  {!!r.detail && <AT style={{ fontSize: 11, color: adm.muted, fontStyle: 'italic' }}>&quot;{r.detail}&quot;</AT>}
                  <AdminSelect value={reason} onChange={setReason} placeholder="Sebep seçin (boşsa: Yönetici kararı)" title="Sebep seç" options={[{ value: '', label: 'Yönetici kararı' }, ...reasons.map(x => ({ value: x, label: x }))]} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Btn variant="admAmberSm" disabled={busy !== null} label={busy === r.userId + '_q' ? '…' : 'Askıya Al (1 ay)'} onPress={() => quarantine(r.userId)} />
                    <Btn variant="admNoSm" disabled={busy !== null} label={busy === r.userId + '_b' ? '…' : 'Ban Et (süresiz)'} onPress={() => ban(r.userId)} />
                  </View>
                </View>
              )}
            </View>
          ))}
      </ACard>
    </APage>
  );
}
