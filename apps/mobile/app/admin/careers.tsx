// apps/web/app/admin/careers/page.tsx karşılığı (yalnız SUPERADMIN)
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, TextInput, useWindowDimensions, View } from 'react-native';
import { getAccess } from '@/lib/session';
import { openAuthedFile } from '@/lib/authFile';
import { api } from '@/lib/api';
import { API_PREFIX } from '@/lib/config';
import { Btn } from '@/components/ui';
import { ACard, AError, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { StatusPill } from '@/components/admin/StatusPill';
import { adm, sans } from '@/theme/theme';

const C: Record<string, string> = { PENDING: adm.amber, REVIEWED: adm.green, REJECTED: adm.red };
const B: Record<string, string> = { PENDING: 'rgba(245,158,11,0.12)', REVIEWED: 'rgba(34,197,94,0.12)', REJECTED: 'rgba(239,68,68,0.12)' };
const Bo: Record<string, string> = { PENDING: 'rgba(245,158,11,0.35)', REVIEWED: 'rgba(34,197,94,0.3)', REJECTED: 'rgba(239,68,68,0.3)' };
interface Career { id: string; fullName: string; email: string; phone?: string; city?: string; linkedinOrCv?: string; motivation?: string; hearFrom?: string; hearFromOther?: string | null; education?: string | null; languages?: { name: string; level: number }[] | null; workType?: string | null; salaryExpectation?: string | null; birthDate?: string | null; district?: string | null; cvFile?: string | null; cvOriginalName?: string | null; photoFile?: string | null; status: string; adminNote?: string; createdAt: string }

// Başvuru fotoğrafı tam ekran büyük görünüm (görselin tamamı); ekrana basınca ya da geri tuşuyla kapanır
function FullView({ uri, token, onClose }: { uri: string | null; token: string | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} accessibilityLabel="Kapat" style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }}>
        {!!uri && !!token && <Image source={{ uri, headers: { Authorization: `Bearer ${token}` } }} resizeMode="contain" style={{ width, height }} accessibilityLabel="Başvuru fotoğrafı" />}
      </Pressable>
    </Modal>
  );
}

export default function AdminCareers() {
  const [items, setItems] = useState<Career[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  useEffect(() => { getAccess().then(setToken).catch(() => undefined); }, []);
  const load = () => { api.get<Career[]>('/admin/careers').then(setItems).catch((e: Error) => setError(`Başvurular yüklenemedi: ${e.message}`)).finally(() => setLoading(false)); };
  useEffect(load, []);
  async function update(id: string, status: string) {
    setSaving(id); setError('');
    try { await api.patch(`/admin/careers/${id}`, { status, adminNote: notes[id] || undefined }); setExpanded(null); load(); } catch (e) { setError(`Güncellenemedi: ${(e as Error).message}`); } finally { setSaving(null); }
  }
  const head = (
    <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <ATitle>Başvurular</ATitle>
      {!loading && items.length > 0 && <AMono style={{ fontSize: 10, marginLeft: 'auto' }}>{items.length} kayıt</AMono>}
    </View>
  );
  return (
    <APage maxWidth={760}>
      <View style={{ marginBottom: 24 }}><ATitle>Kariyer Başvuruları</ATitle></View>
      <AError>{error}</AError>
      <ACard style={{ padding: 0, overflow: 'hidden' }}>
        {head}
        {loading ? <View style={{ gap: 6, padding: 16 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 64, backgroundColor: adm.surface, borderRadius: 8, opacity: 0.5 }} />)}</View>
          : items.length === 0 ? (
            <View style={{ paddingVertical: 48, paddingHorizontal: 20, alignItems: 'center' }}><AT w={600} style={{ fontSize: 13, color: adm.muted }}>Başvuru yok</AT><AMono style={{ marginTop: 4, fontSize: 11 }}>Yeni başvurular burada görünür</AMono></View>
          ) : items.map((c, i) => (
            <View key={c.id} style={{ borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: 'rgba(26,58,92,0.5)' }}>
              <View style={{ paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <AT w={600} numberOfLines={1} style={{ fontSize: 13, flexShrink: 1 }}>{c.fullName}</AT>
                    <StatusPill text={c.status} color={C[c.status]} bg={B[c.status]} border={Bo[c.status]} />
                  </View>
                  <AT style={{ fontSize: 11, color: adm.muted }}>{c.email}</AT>
                  <AMono style={{ marginTop: 2, fontSize: 10 }}>{c.city ?? '—'} · {new Date(c.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</AMono>
                </View>
                <Btn variant="admDetail" selected={expanded === c.id} label={expanded === c.id ? '▲ Kapat' : '▼ Detay'} onPress={() => setExpanded(e => (e === c.id ? null : c.id))} />
              </View>
              {expanded === c.id && (
                <View style={{ marginHorizontal: 18, marginBottom: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 8, backgroundColor: adm.surface, borderWidth: 1, borderColor: adm.border, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <AT w={600} style={{ fontSize: 13 }}>Fotoğraf:</AT>
                    {c.photoFile && token
                      ? <Pressable onPress={() => setViewer(`${API_PREFIX}/admin/careers/${c.id}/photo`)} accessibilityRole="imagebutton" accessibilityLabel="Fotoğrafı büyüt"
                          style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: adm.border }}>
                          <Image source={{ uri: `${API_PREFIX}/admin/careers/${c.id}/photo`, headers: { Authorization: `Bearer ${token}` } }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
                        </Pressable>
                      : <AT style={{ fontSize: 13, color: adm.muted }}>—</AT>}
                  </View>
                  {([
                    ['E-posta', c.email], ['Telefon', c.phone], ['Öğrenim durumu', c.education],
                    ['Yabancı dil', c.languages?.length ? c.languages.map(l => `${l.name} ${'★'.repeat(l.level)}`).join(', ') : null],
                    ['Çalışma türü', c.workType], ['Ücret beklentisi', c.salaryExpectation], ['Doğum tarihi', c.birthDate ? c.birthDate.split('-').reverse().join('.') : null],
                    ['Şehir', c.city], ['İlçe', c.district], ['LinkedIn', c.linkedinOrCv], ["Ben Ahenk'e şunları katabilirim", c.motivation],
                    ['Beni nereden duydu', [c.hearFrom, c.hearFromOther].filter(Boolean).join(': ')], ['Başvuru tarihi', new Date(c.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })], ['Admin notu', c.adminNote],
                  ] as [string, string | null | undefined][]).map(([k, v]) => (
                    <AT key={k} style={{ fontSize: 13, color: adm.muted }}><AT w={600} style={{ fontSize: 13 }}>{k}:</AT> {v || '—'}</AT>
                  ))}
                  <AT style={{ fontSize: 13, color: adm.muted }}><AT w={600} style={{ fontSize: 13 }}>Özgeçmiş (CV):</AT> {c.cvFile ? <AT style={{ fontSize: 13, color: adm.cyan }} onPress={() => { openAuthedFile(`${API_PREFIX}/admin/careers/${c.id}/cv`).catch((e: Error) => setError(e.message)); }}>{c.cvOriginalName ?? 'CV dosyasını aç'}</AT> : '—'}</AT>
                  {c.status === 'PENDING' && (
                    <>
                      <TextInput value={notes[c.id] ?? ''} onChangeText={t => setNotes(n => ({ ...n, [c.id]: t }))} placeholder="Admin notu (opsiyonel)" placeholderTextColor={adm.muted} multiline numberOfLines={2} keyboardAppearance="dark"
                        style={{ borderWidth: 1, borderColor: adm.border, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, fontSize: 11, color: adm.text, fontFamily: sans(400), minHeight: 48, textAlignVertical: 'top' }} />
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        <Btn variant="admOkSm" style={{ padding: 8 }} disabled={saving === c.id} label={saving === c.id ? '…' : 'İncelendi'} onPress={() => update(c.id, 'REVIEWED')} />
                        <Btn variant="admNoSm" style={{ padding: 8 }} disabled={saving === c.id} label={saving === c.id ? '…' : 'Reddet'} onPress={() => update(c.id, 'REJECTED')} />
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          ))}
      </ACard>
      <FullView uri={viewer} token={token} onClose={() => setViewer(null)} />
    </APage>
  );
}
