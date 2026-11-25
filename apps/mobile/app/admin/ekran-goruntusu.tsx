// apps/web/app/admin/ekran-goruntusu/page.tsx karşılığı (Ekran Görüntüsü İhlalleri): büyütülmüş profil fotoğrafı açıkken alınan ekran
// görüntüleri. Önerilen işlem: 1. ihlal işlem yok (kullanıcıya uyarı gösterildi), 2. ihlal 3 gün, 3. ihlal 15 gün, 4. ve sonrası 30 gün
// askı; admin 3 / 15 / 30 günden birini ya da "İşlem yapma"yı seçebilir. Askı mevcut askı sistemiyle, sebep "Ekran görüntüsü ihlali".
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { showAlert } from '@/components/AppAlert';
import { api } from '@/lib/api';
import { ACard, AError, ALabel, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { AdminSelect } from '@/components/admin/AdminControls';
import { AdminUserPhoto } from '@/components/admin/AdminUserPhoto';
import { adm } from '@/theme/theme';
import { daysLabel, fmtDate, initialsOf, PLATFORM_LABEL, statusLabel, type ScreenshotItem, type ScreenshotList } from '@/lib/screenshotAdmin';

function ActBtn({ label, color, filled, disabled, onPress }: { label: string; color: string; filled?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
      style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: color, backgroundColor: filled ? color : 'transparent', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}>
      <AT w={600} style={{ fontSize: 12, color: filled ? '#fff' : color }}>{label}</AT>
    </Pressable>
  );
}

export default function AdminScreenshots() {
  const router = useRouter();
  const [data, setData] = useState<ScreenshotList>({ count: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<{ value: string; label: string }[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    api.get<ScreenshotList>(`/admin/screenshot-logs${userFilter ? `?userId=${encodeURIComponent(userFilter)}` : ''}`)
      .then((r) => {
        setData(r);
        if (!userFilter) {
          const m = new Map<string, string>();
          r.items.forEach((i) => m.set(i.user.id, i.user.name));
          setAllUsers([...m].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'tr')));
        }
      })
      .catch((e: Error) => setError(`Kayıtlar yüklenemedi: ${e.message}`))
      .finally(() => setLoading(false));
  }, [userFilter]);
  useEffect(() => { load(); }, [load]);

  function decide(it: ScreenshotItem, action: 'NONE' | 'SUSPEND', days?: number) {
    const title = action === 'NONE' ? `${it.user.name} için işlem yapılmasın mı?` : `${it.user.name} ${daysLabel(days ?? 0)} askıya alınsın mı?`;
    showAlert(title, action === 'SUSPEND' ? 'Kullanıcıya askı bildirimi gönderilir.' : undefined, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Onayla', style: action === 'SUSPEND' ? 'destructive' : 'default', onPress: async () => {
        setBusy(it.id); setError('');
        try { await api.post(`/admin/screenshot-logs/${it.id}/decision`, { action, ...(days ? { days } : {}) }); load(); }
        catch (e) { setError((e as Error).message); } finally { setBusy(null); }
      } },
    ]);
  }

  return (
    <APage maxWidth={860}>
      <View style={{ marginBottom: 24 }}><ATitle>Ekran Görüntüsü İhlalleri</ATitle></View>
      <AError>{error}</AError>
      <View style={{ marginBottom: 16 }}>
        <AdminSelect value={userFilter} onChange={setUserFilter} title="Kullanıcı" placeholder="Kullanıcı: Tümü"
          options={[{ value: '', label: 'Tümü' }, ...allUsers]} />
      </View>
      <ACard style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ATitle>Kayıtlar</ATitle>
          {!loading && <AMono style={{ fontSize: 10, marginLeft: 'auto' }}>{data.items.length} kayıt</AMono>}
        </View>
        {loading ? <View style={{ gap: 6, padding: 16 }}>{[0, 1, 2].map((i) => <View key={i} style={{ height: 56, backgroundColor: adm.surface, borderRadius: 8, opacity: 0.5 }} />)}</View>
          : data.items.length === 0 ? <View style={{ paddingVertical: 40, alignItems: 'center' }}><AT w={600} style={{ fontSize: 13, color: adm.muted }}>İhlal kaydı yok</AT></View>
          : data.items.map((it, i) => {
            const dis = busy === it.id;
            return (
              <View key={it.id} style={{ paddingVertical: 14, paddingHorizontal: 18, gap: 10, borderBottomWidth: i < data.items.length - 1 ? 1 : 0, borderBottomColor: 'rgba(26,58,92,0.5)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <AdminUserPhoto userId={it.user.id} photoUrl={it.user.photoUrl} initials={initialsOf(it.user.name)} size={48} onDeleted={load} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AT w={600} style={{ fontSize: 13 }}>{it.user.name}</AT>
                    <AMono style={{ marginTop: 2, fontSize: 11 }}>{it.user.phone ?? '—'}</AMono>
                  </View>
                  <ActBtn label="Detay" color="#93c5fd" onPress={() => router.push({ pathname: '/admin/users', params: { detay: it.user.id } })} />
                </View>
                <AT style={{ fontSize: 12 }}>Fotoğraf sahibi: <AT style={{ fontSize: 12, color: '#93c5fd' }}>{it.target.name}</AT><AT style={{ fontSize: 12, color: adm.muted }}> · {PLATFORM_LABEL[it.platform] ?? it.platform} · {fmtDate(it.createdAt)}</AT></AT>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <ALabel style={{ paddingVertical: 2, paddingHorizontal: 8, borderRadius: 99, overflow: 'hidden', borderWidth: 1, borderColor: it.nth > 1 ? adm.red : adm.amber, color: it.nth > 1 ? adm.red : adm.amber }}>{`${it.nth}. ihlal`}</ALabel>
                  <ALabel style={{ paddingVertical: 2, paddingHorizontal: 8, borderRadius: 99, overflow: 'hidden', borderWidth: 1, borderColor: it.adminAction ? adm.green : adm.border, color: it.adminAction ? adm.green : adm.muted }}>{statusLabel(it)}</ALabel>
                  {!!it.adminActionAt && <AMono style={{ fontSize: 10 }}>{fmtDate(it.adminActionAt)}{it.admin ? ` · ${it.admin.name}` : ''}</AMono>}
                </View>
                {/* 1. ihlal: işlem yok, yalnız uyarı gösterildi bilgisi */}
                {!it.adminAction && it.nth > 1 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {!!it.suggestedDays && <ActBtn label={`${daysLabel(it.suggestedDays)} askıya al`} color={adm.red} filled disabled={dis} onPress={() => decide(it, 'SUSPEND', it.suggestedDays!)} />}
                    {([3, 15, 30] as const).filter((d) => d !== it.suggestedDays).map((d) => (
                      <ActBtn key={d} label={daysLabel(d)} color={adm.red} disabled={dis} onPress={() => decide(it, 'SUSPEND', d)} />
                    ))}
                    <ActBtn label="İşlem yapma" color={adm.muted} disabled={dis} onPress={() => decide(it, 'NONE')} />
                  </View>
                )}
              </View>
            );
          })}
      </ACard>
    </APage>
  );
}
