// apps/web/app/admin/quality/page.tsx karşılığı (Şikayetler): masa sohbeti mesaj şikâyetleri ve "Otomatik engel" kayıtları.
// Detayda şikâyet edilen mesaj işaretli olarak sohbetin tamamı, gönderenin önceki uyarıları ve karar butonları
// (Uyar / Masadan çıkar / Askıya al 3 gün / 15 gün / 1 ay). Daha önce uyarı almış kullanıcıda yalnız Masadan çıkar ve Askıya al aktif.
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { showAlert } from '@/components/AppAlert';
import { api } from '@/lib/api';
import { ACard, AError, ALabel, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { AdminUserPhoto } from '@/components/admin/AdminUserPhoto';
import { adm } from '@/theme/theme';

interface ReportRow {
  id: string; createdAt: string; auto: boolean; reasonLabel: string | null; note: string | null;
  decision: string | null; decisionDays: number | null; meetingId: string; messageContent: string; blocked: boolean;
  senderId: string; senderName: string; reporterName: string | null;
}
interface ReportDetail {
  id: string; auto: boolean; reasonLabel: string | null; note: string | null; decision: string | null; decisionDays: number | null;
  senderId: string; senderName: string; senderPhotoUrl: string | null; hasWarning: boolean;
  warnings: { id: string; reason: string; createdAt: string }[];
  messages: { id: string; content: string; createdAt: string; senderId: string; senderName: string; senderGender: string | null; blocked: boolean; reportCount: number; highlighted: boolean }[];
}

const DECISION_TR: Record<string, string> = { WARN: 'Uyarıldı', REMOVE: 'Masadan çıkarıldı', SUSPEND: 'Askıya alındı' };
const fmt = (iso: string) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const initialsOf = (name: string) => name.split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toLocaleUpperCase('tr-TR') || '?';

function DecisionBtn({ label, color, disabled, onPress }: { label: string; color: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
      style={{ flex: 1, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: color, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1, paddingHorizontal: 6 }}>
      <AT w={600} style={{ fontSize: 12, color, textAlign: 'center' }}>{label}</AT>
    </Pressable>
  );
}

export default function AdminQuality() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);

  const load = () => { api.get<ReportRow[]>('/admin/chat-reports').then(setRows).catch((e: Error) => setError(`Şikayetler yüklenemedi: ${e.message}`)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  async function toggle(id: string) {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id); setDetail(null); setSuspendOpen(false); setError('');
    try { setDetail(await api.get<ReportDetail>(`/admin/chat-reports/${id}`)); } catch (e) { setError((e as Error).message); }
  }
  function decide(action: 'WARN' | 'REMOVE' | 'SUSPEND', days?: number) {
    if (!detail) return;
    const label = action === 'WARN' ? 'uyarılsın' : action === 'REMOVE' ? 'masadan çıkarılsın' : `${days === 30 ? '1 ay' : `${days} gün`} askıya alınsın`;
    showAlert(`Kullanıcı ${label} mı?`, 'Kullanıcıya hazır şablon bildirim gönderilir.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Onayla', style: 'destructive', onPress: async () => {
        setBusy(true); setError('');
        try {
          await api.post(`/admin/chat-reports/${detail.id}/decision`, { action, ...(days ? { days } : {}) });
          setDetail(await api.get<ReportDetail>(`/admin/chat-reports/${detail.id}`)); setSuspendOpen(false); load();
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
      } },
    ]);
  }

  return (
    <APage maxWidth={760}>
      <View style={{ marginBottom: 24 }}><ATitle>Şikayetler</ATitle></View>
      <AError>{error}</AError>
      <ACard style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <ATitle>Masa Sohbeti Şikayetleri</ATitle>
          {!loading && <AMono style={{ fontSize: 10, marginLeft: 'auto' }}>{rows.length} kayıt</AMono>}
        </View>
        {loading ? <View style={{ gap: 6, padding: 16 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 48, backgroundColor: adm.surface, borderRadius: 8, opacity: 0.5 }} />)}</View>
          : rows.length === 0 ? <View style={{ paddingVertical: 40, alignItems: 'center' }}><AT w={600} style={{ fontSize: 13, color: adm.muted }}>Şikayet yok</AT></View>
          : rows.map((r, i) => (
            <View key={r.id} style={{ borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: 'rgba(26,58,92,0.5)' }}>
              <Pressable onPress={() => { void toggle(r.id); }} accessibilityRole="button" accessibilityState={{ expanded: openId === r.id }}
                style={{ paddingVertical: 12, paddingHorizontal: 18, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <AT w={600} style={{ fontSize: 13 }}>{r.senderName}</AT>
                    <ALabel style={{ paddingVertical: 2, paddingHorizontal: 7, borderRadius: 99, overflow: 'hidden', borderWidth: 1, borderColor: r.auto ? adm.amber : adm.red, color: r.auto ? adm.amber : adm.red }}>{r.auto ? 'Otomatik engel' : 'Şikayet'}</ALabel>
                    {!!r.decision && <ALabel style={{ paddingVertical: 2, paddingHorizontal: 7, borderRadius: 99, overflow: 'hidden', borderWidth: 1, borderColor: adm.green, color: adm.green }}>{`${DECISION_TR[r.decision]}${r.decisionDays ? ` (${r.decisionDays === 30 ? '1 ay' : `${r.decisionDays} gün`})` : ''}`}</ALabel>}
                  </View>
                  <AT numberOfLines={1} style={{ fontSize: 12 }}>"{r.messageContent}"</AT>
                  <AT style={{ marginTop: 2, fontSize: 11, color: adm.muted }}>{[r.reasonLabel, r.note, r.reporterName ? `Şikayet eden: ${r.reporterName}` : null].filter(Boolean).join(' · ')}</AT>
                  <AMono style={{ marginTop: 2, fontSize: 10 }}>{fmt(r.createdAt)}</AMono>
                </View>
                <AT style={{ color: adm.muted, fontSize: 12 }}>{openId === r.id ? '▲' : '▼'}</AT>
              </Pressable>
              {openId === r.id && detail && (
                <View style={{ marginHorizontal: 18, marginBottom: 14, padding: 14, borderRadius: 8, backgroundColor: adm.surface, borderWidth: 1, borderColor: adm.border, gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <AdminUserPhoto userId={detail.senderId} photoUrl={detail.senderPhotoUrl} initials={initialsOf(detail.senderName)} size={48}
                      onDeleted={() => setDetail(d => (d ? { ...d, senderPhotoUrl: null } : d))} />
                    <View style={{ flexShrink: 1 }}>
                      <AT w={600} style={{ fontSize: 13 }}>{detail.senderName}</AT>
                      <AT style={{ marginTop: 2, fontSize: 11, color: adm.muted }}>{detail.warnings.length ? `Önceki uyarılar: ${detail.warnings.length}` : 'Önceki uyarı yok'}</AT>
                    </View>
                  </View>
                  {detail.warnings.map(w => <AT key={w.id} style={{ fontSize: 11, color: adm.muted }}>• {fmt(w.createdAt)} — {w.reason}</AT>)}
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 360, borderRadius: 8, borderWidth: 1, borderColor: adm.border }} contentContainerStyle={{ padding: 8, gap: 6 }}>
                    {detail.messages.map(m => (
                      <View key={m.id} style={{ paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: m.highlighted ? adm.red : 'transparent', backgroundColor: m.highlighted ? 'rgba(239,68,68,0.12)' : 'transparent' }}>
                        <AT w={600} style={{ fontSize: 11, color: m.senderGender === 'FEMALE' ? '#f48fb1' : '#4fc3f7' }}>
                          {m.senderName}  <AT style={{ fontSize: 10, color: adm.muted }}>{fmt(m.createdAt)}</AT>
                          {m.blocked && <AT style={{ fontSize: 10, color: adm.amber }}>  Otomatik engel (iletilmedi)</AT>}
                          {m.reportCount > 0 && <AT style={{ fontSize: 10, color: adm.red }}>  Şikayet: {m.reportCount}</AT>}
                        </AT>
                        <AT style={{ marginTop: 2, fontSize: 12 }}>{m.content}</AT>
                      </View>
                    ))}
                  </ScrollView>
                  {detail.decision ? (
                    <AT style={{ fontSize: 12, color: adm.green }}>{`Karar: ${DECISION_TR[detail.decision]}${detail.decisionDays ? ` (${detail.decisionDays === 30 ? '1 ay' : `${detail.decisionDays} gün`})` : ''}`}</AT>
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <DecisionBtn label="Uyar" color={adm.amber} disabled={busy || detail.hasWarning} onPress={() => decide('WARN')} />
                        <DecisionBtn label="Masadan çıkar" color={adm.red} disabled={busy} onPress={() => decide('REMOVE')} />
                        <DecisionBtn label="Askıya al" color={adm.red} disabled={busy} onPress={() => setSuspendOpen(v => !v)} />
                      </View>
                      {detail.hasWarning && <AT style={{ fontSize: 11, color: adm.muted }}>Kullanıcı daha önce uyarı aldı: yalnız Masadan çıkar ve Askıya al kullanılabilir.</AT>}
                      {suspendOpen && (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {[3, 15, 30].map(d => <DecisionBtn key={d} label={`${d === 30 ? '1 ay' : `${d} gün`}`} color={adm.red} disabled={busy} onPress={() => decide('SUSPEND', d)} />)}
                        </View>
                      )}
                    </>
                  )}
                </View>
              )}
            </View>
          ))}
      </ACard>
    </APage>
  );
}
