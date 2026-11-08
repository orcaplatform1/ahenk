// apps/web/app/admin/partnerships/page.tsx karşılığı (yalnız SUPERADMIN)
import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/venueApi';
import { Btn } from '@/components/ui';
import { ACard, AError, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { AdminSelect } from '@/components/admin/AdminControls';
import { StatusPill } from '@/components/admin/StatusPill';
import { adm, sans } from '@/theme/theme';

const C: Record<string, string> = { PENDING: adm.amber, REVIEWED: adm.green, APPROVED: adm.green, REJECTED: adm.red };
const L: Record<string, string> = { PENDING: 'BEKLİYOR', REVIEWED: 'İNCELENDİ', APPROVED: 'ONAYLANDI', REJECTED: 'REDDEDİLDİ' };
const A: Record<string, string> = { PENDING: 'Onay bekliyor', ACTIVE: 'Aktif', REJECTED: 'Reddedildi', DEACTIVATED: 'Pasif (mekân kapattı)' };
const B: Record<string, string> = { PENDING: 'rgba(245,158,11,0.12)', REVIEWED: 'rgba(34,197,94,0.12)', APPROVED: 'rgba(34,197,94,0.12)', REJECTED: 'rgba(239,68,68,0.12)' };
const Bo: Record<string, string> = { PENDING: 'rgba(245,158,11,0.35)', REVIEWED: 'rgba(34,197,94,0.3)', APPROVED: 'rgba(34,197,94,0.3)', REJECTED: 'rgba(239,68,68,0.3)' };
interface P { id: string; businessName: string; contactName: string; email: string; phone: string; city: string; venueType?: string; capacity?: number; description?: string; websiteOrSocial?: string; address?: string | null; district?: string | null; locationUrl?: string | null; alcoholStatus?: 'ALCOHOLIC' | 'NON_ALCOHOLIC' | null; referenceCode?: string | null; photos?: string[]; account?: { status: string; registeredAt: string; approvedAt: string | null; deactivatedAt: string | null } | null; status: string; adminNote?: string; adminNoteByName?: string | null; venueTypeOther?: string | null; lastEditedAt?: string | null; lastEditedByName?: string | null; createdAt: string }
const dt = (d?: string | null) => (d ? new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : null);
const KV = ({ k, children }: { k: string; children: React.ReactNode }) => <AT style={{ fontSize: 13, color: adm.muted }}><AT w={600} style={{ fontSize: 13 }}>{k}:</AT> {children}</AT>;

export default function AdminPartnerships() {
  const [items, setItems] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [cityIds, setCityIds] = useState<Record<string, string>>({});
  const load = () => { api.get<P[]>('/admin/partnerships').then(setItems).catch((e: Error) => setError(`Başvurular yüklenemedi: ${e.message}`)).finally(() => setLoading(false)); };
  useEffect(() => { load(); api.get<{ id: string; name: string }[]>('/admin/cities').then(setCities).catch(() => undefined); }, []);
  const cityMatches = (city: string) => cities.some(c => c.name === city.split(' (')[0].trim());
  async function update(id: string, status: string) {
    setSaving(id); setError('');
    try { await api.patch(`/admin/partnerships/${id}`, { status, adminNote: notes[id] || undefined, cityId: cityIds[id] || undefined }); setExpanded(null); load(); } catch (e) { setError(`Güncellenemedi: ${(e as Error).message}`); } finally { setSaving(null); }
  }
  return (
    <APage maxWidth={760}>
      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <Pressable onPress={() => setLightbox(null)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.85)' }}>
          {lightbox && <Image source={{ uri: lightbox }} style={{ width: '100%', height: '100%', borderRadius: 8 }} resizeMode="contain" accessibilityLabel="Mekân fotoğrafı" />}
        </Pressable>
      </Modal>
      <View style={{ marginBottom: 24 }}><ATitle>İş Ortaklığı Başvuruları</ATitle></View>
      <AError>{error}</AError>
      <ACard style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ATitle>Başvurular</ATitle>
          {!loading && items.length > 0 && <AMono style={{ fontSize: 10, marginLeft: 'auto' }}>{items.length} kayıt</AMono>}
        </View>
        {loading ? <View style={{ gap: 6, padding: 16 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 64, backgroundColor: adm.surface, borderRadius: 8, opacity: 0.5 }} />)}</View>
          : items.length === 0 ? <View style={{ paddingVertical: 48, paddingHorizontal: 20, alignItems: 'center' }}><AT w={600} style={{ fontSize: 13, color: adm.muted }}>Başvuru yok</AT><AMono style={{ marginTop: 4, fontSize: 11 }}>Yeni başvurular burada görünür</AMono></View>
          : items.map((p, i) => (
            <View key={p.id} style={{ borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: 'rgba(26,58,92,0.5)' }}>
              <View style={{ paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <AT w={600} numberOfLines={1} style={{ fontSize: 13, flexShrink: 1 }}>{p.businessName}</AT>
                    <StatusPill text={L[p.status] ?? p.status} color={C[p.status]} bg={B[p.status]} border={Bo[p.status]} />
                  </View>
                  <AT style={{ fontSize: 11, color: adm.muted }}>{p.contactName} · {p.email}</AT>
                  <AMono style={{ marginTop: 2, fontSize: 10 }}>{p.city}{p.venueType ? ` · ${p.venueType}` : ''} · {new Date(p.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</AMono>
                </View>
                <Btn variant="admDetail" selected={expanded === p.id} label={expanded === p.id ? '▲ Kapat' : '▼ Detay'} onPress={() => setExpanded(e => (e === p.id ? null : p.id))} />
              </View>
              {expanded === p.id && (
                <View style={{ marginHorizontal: 18, marginBottom: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 8, backgroundColor: adm.surface, borderWidth: 1, borderColor: adm.border, gap: 8 }}>
                  {([
                    ['Başvuru durumu', L[p.status] ?? p.status], ['İşletme adı', p.businessName], ['Yetkili', p.contactName], ['E-posta', p.email], ['Telefon', p.phone], ['Şehir', p.city], ['İlçe', p.district], ['Adres', p.address],
                    ['Mekân türü', p.venueType === 'Diğer' && p.venueTypeOther ? `Diğer: ${p.venueTypeOther}` : p.venueType], ['Kapasite', p.capacity], ['Alkol durumu', p.alcoholStatus ? (p.alcoholStatus === 'ALCOHOLIC' ? 'Alkollü' : 'Alkolsüz') : null],
                    ['Web / Sosyal', p.websiteOrSocial], ['Personel Referans Kodu', p.referenceCode], ['Başvuru tarihi', dt(p.createdAt)], ['Son güncelleme', p.lastEditedAt ? `${dt(p.lastEditedAt)} · ${p.lastEditedByName ?? '—'}` : null],
                    ['Panel hesabı', p.account ? A[p.account.status] ?? p.account.status : null], ['Panel kayıt tarihi', dt(p.account?.registeredAt)], ['Onay tarihi', dt(p.account?.approvedAt)], ['Kapatılma tarihi', dt(p.account?.deactivatedAt)],
                  ] as [string, string | number | null | undefined][]).map(([k, v]) => <KV key={k} k={k}>{v || '—'}</KV>)}
                  <KV k="Maps linki">{p.locationUrl ? <AT style={{ fontSize: 13, color: adm.cyan }} onPress={() => WebBrowser.openBrowserAsync(p.locationUrl!)}>{p.locationUrl}</AT> : '—'}</KV>
                  <KV k="Açıklama">{p.description || '—'}</KV>
                  <KV k="Admin notu">{p.adminNote ? `${p.adminNote}${p.adminNoteByName ? ` (${p.adminNoteByName})` : ''}` : '—'}</KV>
                  {!!p.photos?.length && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {p.photos.map((src, k) => (
                        <Pressable key={src} onPress={() => setLightbox(mediaUrl(src))} accessibilityLabel={`Mekân fotoğrafı ${k + 1} büyüt`} style={{ width: 96, aspectRatio: 1 }}>
                          <Image source={{ uri: mediaUrl(src) }} style={{ width: '100%', height: '100%', borderRadius: 6 }} />
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {p.status === 'PENDING' && (
                    <>
                      <TextInput value={notes[p.id] ?? ''} onChangeText={t => setNotes(n => ({ ...n, [p.id]: t }))} placeholder="Admin notu (opsiyonel)" placeholderTextColor={adm.muted} multiline numberOfLines={2} keyboardAppearance="dark"
                        style={{ borderWidth: 1, borderColor: adm.border, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, fontSize: 11, color: adm.text, fontFamily: sans(400), minHeight: 48, textAlignVertical: 'top' }} />
                      {p.account && !cityMatches(p.city) && <AdminSelect value={cityIds[p.id] ?? ''} onChange={v => setCityIds(c => ({ ...c, [p.id]: v }))} options={cities.map(c => ({ value: c.id, label: c.name }))} placeholder="Onay için şehir seçin" />}
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Btn variant="admOkSm" style={{ padding: 8 }} disabled={saving === p.id} label={saving === p.id ? '…' : p.account ? 'Onayla' : 'İncelendi'} onPress={() => update(p.id, p.account ? 'APPROVED' : 'REVIEWED')} />
                        <Btn variant="admNoSm" style={{ padding: 8 }} disabled={saving === p.id} label={saving === p.id ? '…' : 'Reddet'} onPress={() => update(p.id, 'REJECTED')} />
                      </View>
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
