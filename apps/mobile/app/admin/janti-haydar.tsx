// apps/web/app/admin/janti-haydar/page.tsx karşılığı (yalnız görüntüleme)
import React, { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/lib/api';
import { openAuthedFile } from '@/lib/authFile';
import { API_PREFIX } from '@/lib/config';
import { Btn } from '@/components/ui';
import { ACard, AError, AMono, APage, AT, ATitle } from '@/components/admin/AdminUi';
import { adm } from '@/theme/theme';

interface JantiFile { file: string; originalName: string; type: string; size: number }
interface JantiRequest { id: string; fullName: string; phone: string; adTypes: string[]; storyOwner: string; websiteOrSocial: string | null; message: string; files: JantiFile[] | null; createdAt: string }
const fmtDate = (iso: string) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const safeUrl = (v: string) => (/^https?:\/\//i.test(v.trim()) ? v.trim() : null);

function Line({ k, children }: { k: string; children: React.ReactNode }) {
  return <AT style={{ fontSize: 13, color: adm.muted }}><AT w={600} style={{ fontSize: 13 }}>{k}</AT> {children}</AT>;
}

export default function AdminJantiHaydar() {
  const [items, setItems] = useState<JantiRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get<JantiRequest[]>('/admin/janti-haydar').then(setItems).catch((e: Error) => setError(`Talepler yüklenemedi: ${e.message}`)).finally(() => setLoading(false)); }, []);
  return (
    <APage maxWidth={760}>
      <View style={{ marginBottom: 24 }}><ATitle>Janti Haydar</ATitle></View>
      <AError>{error}</AError>
      <ACard style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: adm.border, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <ATitle>Teklif Talepleri</ATitle>
          {!loading && items.length > 0 && <AMono style={{ fontSize: 10, marginLeft: 'auto' }}>{items.length} kayıt</AMono>}
        </View>
        {loading ? <View style={{ gap: 6, padding: 16 }}>{[0, 1, 2].map(i => <View key={i} style={{ height: 64, backgroundColor: adm.surface, borderRadius: 8, opacity: 0.5 }} />)}</View>
          : items.length === 0 ? (
            <View style={{ paddingVertical: 48, paddingHorizontal: 20, alignItems: 'center' }}>
              <AT w={600} style={{ fontSize: 13, color: adm.muted }}>Talep yok</AT>
              <AMono style={{ marginTop: 4, fontSize: 11 }}>Yeni talepler burada görünür</AMono>
            </View>
          ) : items.map((r, i) => {
            const open = expanded === r.id;
            const url = r.websiteOrSocial ? safeUrl(r.websiteOrSocial) : null;
            const files = Array.isArray(r.files) ? r.files : [];
            return (
              <View key={r.id} style={{ borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: 'rgba(26,58,92,0.5)' }}>
                <View style={{ paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <AT w={600} numberOfLines={1} style={{ marginBottom: 4, fontSize: 13 }}>{r.fullName}</AT>
                    <AT style={{ fontSize: 11, color: adm.muted }}>{r.adTypes.join(', ')}</AT>
                    <AMono style={{ marginTop: 2, fontSize: 10 }}>{fmtDate(r.createdAt)}</AMono>
                  </View>
                  <Btn variant="admDetail" selected={open} label={open ? '▲ Kapat' : '▼ Detay'} onPress={() => setExpanded(e => (e === r.id ? null : r.id))} />
                </View>
                {open && (
                  <View style={{ marginHorizontal: 18, marginBottom: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 8, backgroundColor: adm.surface, borderWidth: 1, borderColor: adm.border, gap: 8 }}>
                    <Line k="Ad Soyad:">{r.fullName}</Line>
                    <Line k="Telefon:"><AT style={{ fontSize: 13, color: adm.cyan }} onPress={() => Linking.openURL(`tel:${r.phone}`)}>{r.phone}</AT></Line>
                    <Line k="Reklam türleri:">{r.adTypes.join(', ') || '—'}</Line>
                    <Line k="Kurgu:">{r.storyOwner}</Line>
                    <Line k="Web / Instagram:">{r.websiteOrSocial ? (url ? <AT style={{ fontSize: 13, color: adm.cyan }} onPress={() => WebBrowser.openBrowserAsync(url)}>{r.websiteOrSocial}</AT> : r.websiteOrSocial) : '—'}</Line>
                    <Line k="Mesaj:">{r.message}</Line>
                    <View style={{ gap: 6 }}>
                      <AT w={600} style={{ fontSize: 13 }}>Dosyalar:</AT>
                      {files.length === 0 ? <AT style={{ fontSize: 13, color: adm.muted }}>—</AT> : files.map((f, k) => (
                        <View key={f.file} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                          <AT style={{ fontSize: 13 }}>{f.originalName}</AT>
                          <AMono style={{ fontSize: 10 }}>{f.type.toUpperCase()} · {fmtSize(f.size)}</AMono>
                          <Btn variant="admLink" label="Görüntüle" onPress={() => { openAuthedFile(`${API_PREFIX}/admin/janti-haydar/${r.id}/files/${k}`).catch((e: Error) => setError(e.message)); }} />
                          <Btn variant="admLink" label="İndir" onPress={() => { openAuthedFile(`${API_PREFIX}/admin/janti-haydar/${r.id}/files/${k}?download=1`).catch((e: Error) => setError(e.message)); }} />
                        </View>
                      ))}
                    </View>
                    <Line k="Gönderim tarihi:">{fmtDate(r.createdAt)}</Line>
                  </View>
                )}
              </View>
            );
          })}
      </ACard>
    </APage>
  );
}
