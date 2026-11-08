// apps/web/components/AdminDeletionRequests, AdminSanctionHistory, AdminNoShowWarnings, AdminUserEdit karşılıkları
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { api } from '@/lib/api';
import { myRole } from '@/lib/adminRole';
import { OCCUPATION_SECTORS } from '@/lib/occupations';
import { Btn } from '../ui';
import { ACard, ALabel, AMono, AT } from './AdminUi';
import { AdminDatePicker, AdminSelect, AInput } from './AdminControls';
import { adm } from '@/theme/theme';

const when = (d: string) => new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' });
const confirmAsk = (title: string, run: () => void) => Alert.alert(title, undefined, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Tamam', style: 'destructive', onPress: run }]);

interface DeletionRequest { id: string; userId: string; userName: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; createdAt: string; decidedAt: string | null; retainedIdentity?: { firstName: string | null; lastName: string | null; email: string; phone: string | null } | null }
const DSTATUS: Record<string, { label: string; color: string }> = { PENDING: { label: 'Bekliyor', color: adm.amber }, APPROVED: { label: 'Onaylandı', color: adm.green }, REJECTED: { label: 'Reddedildi', color: adm.red } };
export function AdminDeletionRequests() {
  const [rows, setRows] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const isSuper = myRole() === 'SUPERADMIN';
  const load = () => { api.get<DeletionRequest[]>('/admin/deletion-requests').then(r => { setRows(r); setError(''); }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(load, []);
  async function run(id: string, status: 'APPROVED' | 'REJECTED') { setBusy(id); setError(''); try { await api.patch(`/admin/deletion-requests/${id}`, { status }); load(); } catch (e) { setError((e as Error).message); } finally { setBusy(''); } }
  const decide = (id: string, status: 'APPROVED' | 'REJECTED') => (status === 'APPROVED' ? confirmAsk('Hesap kalıcı olarak silinecek. Bu işlem geri alınamaz.', () => run(id, status)) : run(id, status));
  return (
    <ACard style={{ padding: 0, overflow: 'hidden' }}>
      {!!error && <AT style={{ paddingVertical: 12, paddingHorizontal: 18, fontSize: 13, color: adm.red }}>{error}</AT>}
      {loading ? <AT style={{ padding: 20, fontSize: 13, color: adm.muted }}>Yükleniyor…</AT>
        : rows.length === 0 ? <AT w={600} style={{ paddingVertical: 40, paddingHorizontal: 20, textAlign: 'center', fontSize: 13, color: adm.muted }}>Silme talebi yok.</AT>
        : rows.map((r, i) => (
          <View key={r.id} style={{ paddingVertical: 14, paddingHorizontal: 18, borderTopWidth: i ? 1 : 0, borderTopColor: adm.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <View style={{ flexShrink: 1 }}>
              <AT w={600} style={{ fontSize: 13 }}>{r.userName}</AT>
              <AMono style={{ marginTop: 3, fontSize: 11 }}>{when(r.createdAt)}{r.decidedAt ? ` → ${when(r.decidedAt)}` : ''}</AMono>
              {r.retainedIdentity && <AT style={{ marginTop: 4, fontSize: 11, color: adm.amber }}>Saklanan kimlik: {r.retainedIdentity.firstName} {r.retainedIdentity.lastName} · {r.retainedIdentity.email} · {r.retainedIdentity.phone ?? '—'}</AT>}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <AT w={600} style={{ fontSize: 11, color: DSTATUS[r.status].color }}>{DSTATUS[r.status].label}</AT>
              {r.status === 'PENDING' && isSuper && (
                <>
                  <Btn variant="admOkDec" disabled={busy === r.id} label="Onayla" onPress={() => decide(r.id, 'APPROVED')} />
                  <Btn variant="admNoDec" disabled={busy === r.id} label="Reddet" onPress={() => decide(r.id, 'REJECTED')} />
                </>
              )}
            </View>
          </View>
        ))}
    </ACard>
  );
}

interface Sanction { id: string; type: 'WARNING' | 'SUSPENSION' | 'BAN'; reason: string; expiresAt: string | null; liftedAt: string | null; createdAt: string; admin: { profile: { firstName: string | null; lastName: string | null } | null } | null }
const TYPE_LABEL: Record<Sanction['type'], { label: string; color: string }> = { WARNING: { label: 'Uyarı', color: adm.amber }, SUSPENSION: { label: 'Askı', color: adm.red }, BAN: { label: 'Ban', color: adm.red } };
const fmt = (d: string) => new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const isActive = (s: Sanction) => !s.liftedAt && (s.type === 'WARNING' || !s.expiresAt || new Date(s.expiresAt) > new Date());
export function AdminSanctionHistory({ userId, canAct, onChanged }: { userId: string; canAct: boolean; onChanged: () => void }) {
  const [items, setItems] = useState<Sanction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lifting, setLifting] = useState<string | null>(null);
  const isSuper = myRole() === 'SUPERADMIN';
  const load = useCallback(() => { api.get<Sanction[]>(`/admin/users/${userId}/sanctions`).then(d => { setItems(d); setError(''); }).catch((e: Error) => setError(`Yaptırım geçmişi yüklenemedi: ${e.message}`)).finally(() => setLoading(false)); }, [userId]);
  useEffect(() => { load(); }, [load]);
  const lift = (id: string) => confirmAsk('Bu yaptırım kaldırılsın mı?', async () => {
    setLifting(id); setError('');
    try { await api.delete(`/admin/users/${userId}/sanction/${id}`); load(); onChanged(); } catch (e) { setError(`Kaldırılamadı: ${(e as Error).message}`); } finally { setLifting(null); }
  });
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: adm.border, paddingTop: 14, gap: 6 }}>
      <ALabel>YAPTIRIM GEÇMİŞİ{!loading ? ` (${items.length})` : ''}</ALabel>
      {!!error && <AT style={{ fontSize: 11, color: adm.red }}>{error}</AT>}
      {!loading && !error && items.length === 0 && <AT style={{ fontSize: 11, color: adm.muted }}>Kayıt yok.</AT>}
      {items.map(s => {
        const t = TYPE_LABEL[s.type]; const a = isActive(s);
        const by = s.admin?.profile ? `${s.admin.profile.firstName ?? ''} ${s.admin.profile.lastName ?? ''}`.trim() : '—';
        return (
          <View key={s.id} style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: adm.surface, borderWidth: 1, borderColor: a ? 'rgba(239,68,68,0.3)' : adm.border, gap: 3 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <AT w={800} style={{ fontSize: 10, color: t.color }}>{t.label}{a ? ' · AKTİF' : s.liftedAt ? ' · KALDIRILDI' : ' · SÜRESİ DOLDU'}</AT>
              {a && isSuper && canAct && <Btn variant="admGreenXs" disabled={!!lifting} label={lifting === s.id ? '…' : 'Kaldır'} onPress={() => lift(s.id)} />}
            </View>
            <AT style={{ fontSize: 11, lineHeight: 16.5 }}>{s.reason}</AT>
            <AT style={{ fontSize: 10, color: adm.muted }}>{fmt(s.createdAt)}{s.expiresAt ? ` → ${fmt(s.expiresAt)}` : s.type === 'BAN' ? ' → süresiz' : ''}{s.liftedAt ? ` · kaldırılma: ${fmt(s.liftedAt)}` : ''} · veren: {by}</AT>
          </View>
        );
      })}
    </View>
  );
}

export interface NoShowReportItem { createdAt: string; meeting: { id: string; scheduledAt: string; type: string; locationText: string | null; cycleId?: string | null }; reporter: { id: string; profile: { firstName: string | null; lastName: string | null } | null } }
export interface NoShowWarningInfo { count: number; limit: number; warnedMeetingIds: string[]; warnedCycleIds?: string[] }
export function AdminNoShowWarnings({ userId, reports, warnings, canSanction, userStatus, suspending, onChanged, onSuspend }: {
  userId: string; reports: NoShowReportItem[]; warnings: NoShowWarningInfo; canSanction: boolean; userStatus: string; suspending: boolean; onChanged: (w: NoShowWarningInfo) => void; onSuspend: () => void;
}) {
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState('');
  if (reports.length === 0 && warnings.count === 0) return null;
  const byMeeting = new Map<string, { meeting: NoShowReportItem['meeting']; reporters: string[] }>();
  for (const r of reports) {
    const name = r.reporter.profile ? `${r.reporter.profile.firstName ?? ''} ${r.reporter.profile.lastName ?? ''}`.trim() : '—';
    const row = byMeeting.get(r.meeting.id) ?? { meeting: r.meeting, reporters: [] }; row.reporters.push(name); byMeeting.set(r.meeting.id, row);
  }
  async function give(meetingId: string) { setWarning(meetingId); setError(''); try { onChanged(await api.post<NoShowWarningInfo>(`/admin/users/${userId}/no-show-warning`, { meetingId })); } catch (e) { setError(`Uyarı verilemedi: ${(e as Error).message}`); } finally { setWarning(null); } }
  const reached = warnings.count >= warnings.limit;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: adm.border, paddingTop: 14, gap: 6 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <ALabel style={{ color: adm.red }}>GELMEDİ BİLDİRİMLERİ ({reports.length})</ALabel>
        <AMono w={600} style={{ fontSize: 10, color: reached ? adm.red : adm.amber }}>UYARI: {warnings.count}/{warnings.limit}</AMono>
      </View>
      {[...byMeeting.values()].map(({ meeting, reporters }) => {
        const warned = warnings.warnedMeetingIds.includes(meeting.id);
        const weekWarned = !warned && !!meeting.cycleId && (warnings.warnedCycleIds ?? []).includes(meeting.cycleId);
        return (
          <View key={meeting.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AT style={{ flex: 1, fontSize: 11, color: adm.muted }}>
              {new Date(meeting.scheduledAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' })} · {meeting.type === 'ONE_ON_ONE' ? 'Başbaşa' : 'Grup'}{meeting.locationText ? ` · ${meeting.locationText}` : ''}, bildiren: <AT style={{ fontSize: 11 }}>{reporters.join(', ')}</AT>
            </AT>
            {warned ? <AT style={{ fontSize: 10, color: adm.muted }}>Uyarı verildi</AT> : weekWarned ? <AT style={{ fontSize: 10, color: adm.muted }}>Bu hafta için uyarı verildi</AT>
              : canSanction ? <Btn variant="admAmberXs" disabled={!!warning} label={warning === meeting.id ? '…' : 'Uyarı Ver'} onPress={() => give(meeting.id)} /> : null}
          </View>
        );
      })}
      {!!error && <AT style={{ fontSize: 11, color: adm.red }}>{error}</AT>}
      {reached && canSanction && userStatus !== 'SUSPENDED' && (
        <View style={{ marginTop: 4, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, backgroundColor: adm.surface, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <AT style={{ fontSize: 11, color: adm.red }}>{warnings.limit} uyarıya ulaştı.</AT>
          <Btn variant="admActRed" disabled={suspending} label={suspending ? '…' : 'Askıya Al (1 ay)'} onPress={onSuspend} />
        </View>
      )}
    </View>
  );
}

export interface EditableUser { id: string; email?: string | null; phone?: string | null; occupationSector?: string | null; profile: { firstName?: string | null; lastName?: string | null; gender?: string | null; birthDate?: string | null; primaryCity?: string | null } | null }
const initial = (u: EditableUser) => ({ firstName: u.profile?.firstName ?? '', lastName: u.profile?.lastName ?? '', gender: u.profile?.gender ?? '', birthDate: u.profile?.birthDate ? u.profile.birthDate.slice(0, 10) : '', phone: (u.phone ?? '').replace(/^\+90/, ''), cityId: u.profile?.primaryCity ?? '', occupationSector: u.occupationSector ?? '', email: u.email ?? '' });
export function AdminUserEdit({ user, canEdit, onSaved }: { user: EditableUser; canEdit: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => initial(user));
  const [cities, setCities] = useState<{ id: string; name: string; isActive: boolean }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isSuper = myRole() === 'SUPERADMIN';
  useEffect(() => { setForm(initial(user)); }, [user]);
  useEffect(() => { if (!open || cities.length) return; api.get<{ id: string; name: string; isActive: boolean }[]>('/admin/cities').then(c => setCities(c.filter(x => x.isActive))).catch((e: Error) => setError(`Şehirler yüklenemedi: ${e.message}`)); }, [open, cities.length]);
  if (!canEdit) return null;
  const set = (k: keyof ReturnType<typeof initial>, v: string) => setForm(f => ({ ...f, [k]: v }));
  const phoneValid = form.phone === '' || (form.phone.length === 10 && form.phone.startsWith('5'));
  async function save() {
    const b = initial(user); const body: Record<string, string> = {};
    if (form.firstName.trim() !== b.firstName) body.firstName = form.firstName.trim();
    if (form.lastName.trim() !== b.lastName) body.lastName = form.lastName.trim();
    if (form.gender !== b.gender && form.gender) body.gender = form.gender;
    if (form.birthDate !== b.birthDate && form.birthDate) body.birthDate = form.birthDate;
    if (form.phone !== b.phone && form.phone) body.phone = `+90${form.phone}`;
    if (form.cityId !== b.cityId && form.cityId) body.cityId = form.cityId;
    if (form.occupationSector !== b.occupationSector && form.occupationSector) body.occupationSector = form.occupationSector;
    if (isSuper && form.email.trim() !== b.email && form.email.trim()) body.email = form.email.trim();
    if (!Object.keys(body).length) { setOpen(false); return; }
    setSaving(true); setError('');
    try { await api.patch(`/admin/users/${user.id}/profile`, body); setOpen(false); onSaved(); } catch (e) { setError(`Kaydedilemedi: ${(e as Error).message}`); } finally { setSaving(false); }
  }
  if (!open) return <Btn variant="admCyanEdit" label="Bilgileri Düzenle" onPress={() => { setForm(initial(user)); setError(''); setOpen(true); }} />;
  return (
    <View style={{ padding: 12, borderRadius: 8, backgroundColor: adm.surface, borderWidth: 1, borderColor: adm.border, gap: 8 }}>
      <ALabel style={{ color: adm.cyan }}>BİLGİLERİ DÜZENLE</ALabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <AInput value={form.firstName} onChangeText={v => set('firstName', v)} placeholder="Ad" style={{ flex: 1 }} />
        <AInput value={form.lastName} onChangeText={v => set('lastName', v)} placeholder="Soyad" style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ flex: 1 }}><AdminSelect value={form.gender} onChange={v => set('gender', v)} placeholder="Cinsiyet" options={[{ value: 'MALE', label: 'Erkek' }, { value: 'FEMALE', label: 'Kadın' }]} /></View>
        <View style={{ flex: 1 }}><AdminDatePicker value={form.birthDate} onChange={v => set('birthDate', v)} /></View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <View style={{ justifyContent: 'center', backgroundColor: adm.bg, borderWidth: 1, borderColor: adm.border, borderRadius: 8, paddingHorizontal: 10 }}><AT style={{ fontSize: 13, color: adm.muted }}>+90</AT></View>
        <AInput keyboardType="number-pad" value={form.phone} onChangeText={v => set('phone', v.replace(/\D/g, '').slice(0, 10))} placeholder="5XX XXX XX XX" style={{ flex: 1 }} />
      </View>
      <AdminSelect value={form.cityId} onChange={v => set('cityId', v)} placeholder="Katılım şehri" options={cities.map(c => ({ value: c.id, label: c.name }))} />
      <AdminSelect value={form.occupationSector} onChange={v => set('occupationSector', v)} placeholder="Meslek alanı" options={OCCUPATION_SECTORS.map(o => ({ value: o, label: o }))} />
      {isSuper && <AInput keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={v => set('email', v)} placeholder="E-posta" />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn variant="admCyanSave" disabled={saving || !phoneValid} label={saving ? 'Kaydediliyor…' : 'Kaydet'} onPress={save} />
        <Btn variant="admOutlineFlex" disabled={saving} label="Vazgeç" onPress={() => setOpen(false)} />
      </View>
      {!phoneValid && <AT style={{ fontSize: 11, color: adm.red }}>Telefon 5 ile başlayan 10 hane olmalı.</AT>}
      {!!error && <AT style={{ fontSize: 11, color: adm.red }}>{error}</AT>}
    </View>
  );
}
