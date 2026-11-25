'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { SURFACE, BORDER, TEXT, MUTED, RED, AMBER, GREEN, SANS, MONO, LABEL } from '@/lib/adminTheme';
import { AdminUserPhoto } from '@/components/AdminUserPhoto';
import { actionLabel, daysLabel, fmtDate, initialsOf, PLATFORM_LABEL, type ScreenshotItem, type ScreenshotList } from '@/lib/screenshotAdmin';

// Ekran Görüntüsü İhlalleri: büyütülmüş profil fotoğrafı açıkken alınan ekran görüntüleri (iOS). Önerilen işlem ihlal sırasına göre:
// 1. ihlal işlem yok (kullanıcıya uyarı gösterildi), 2. ihlal 3 gün, 3. ihlal 15 gün, 4. ve sonrası 30 gün askı. Admin 3 / 15 / 30 günden
// birini ya da "İşlem yapma"yı seçebilir; askı mevcut askı sistemiyle, sebep "Ekran görüntüsü ihlali".
export default function AdminScreenshots() {
  const [data, setData] = useState<ScreenshotList>({ count: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    api.get<ScreenshotList>(`/admin/screenshot-logs${userFilter ? `?userId=${encodeURIComponent(userFilter)}` : ''}`)
      .then((r) => {
        setData(r);
        if (!userFilter) {
          const m = new Map<string, string>();
          r.items.forEach((i) => m.set(i.user.id, i.user.name));
          setAllUsers([...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'tr')));
        }
      })
      .catch((e: Error) => setError(`Kayıtlar yüklenemedi: ${e.message}`))
      .finally(() => setLoading(false));
  }, [userFilter]);
  useEffect(() => { load(); }, [load]);

  async function decide(item: ScreenshotItem, action: 'NONE' | 'SUSPEND', days?: number) {
    const q = action === 'NONE' ? `${item.user.name} için işlem yapılmasın mı?` : `${item.user.name} ${daysLabel(days ?? 0)} askıya alınsın mı? Kullanıcıya askı bildirimi gönderilir.`;
    if (!confirm(q)) return;
    setBusy(item.id); setError('');
    try { await api.post(`/admin/screenshot-logs/${item.id}/decision`, { action, ...(days ? { days } : {}) }); load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  const btn = (color: string, disabled: boolean, filled = false): React.CSSProperties => ({
    minHeight: 36, padding: '0 10px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: SANS,
    background: filled ? color : 'transparent', border: `1px solid ${color}`, color: filled ? '#fff' : color, opacity: disabled ? 0.4 : 1,
  });

  return (
    <div className="adm-page" style={{ maxWidth: 860, margin: '0 auto', fontFamily: SANS }}>
      <div style={{ marginBottom: 24 }}><h1 className="ll-title">Ekran Görüntüsü İhlalleri</h1></div>
      {error && <p style={{ margin: '0 0 16px', fontSize: 13, color: RED }}>{error}</p>}

      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <label htmlFor="ss-user" style={{ ...LABEL, color: MUTED }}>KULLANICI</label>
        <select id="ss-user" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}
          style={{ minHeight: 36, padding: '0 10px', borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontFamily: SANS }}>
          <option value="">Tümü</option>
          {allUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 className="ll-title">Kayıtlar</h2>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>{data.items.length} kayıt</span>
        </div>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 56, background: SURFACE, borderRadius: 8, opacity: 0.5 }} />)}
          </div>
        ) : data.items.length === 0 ? (
          <p style={{ margin: 0, padding: '40px 20px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: MUTED }}>İhlal kaydı yok</p>
        ) : data.items.map((it, i) => {
          const dis = busy === it.id;
          return (
            <div key={it.id} style={{ padding: '14px 18px', borderBottom: i < data.items.length - 1 ? '1px solid rgba(26,58,92,0.5)' : 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <AdminUserPhoto userId={it.user.id} photoUrl={it.user.photoUrl} size={48} initials={initialsOf(it.user.name)} onDeleted={load} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>{it.user.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO }}>{it.user.phone ?? '—'}</p>
                </div>
                <Link href={`/admin/users?detay=${encodeURIComponent(it.user.id)}`} style={{ ...btn('#93c5fd', false), display: 'inline-flex', alignItems: 'center' }}>Detay</Link>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: TEXT }}>
                Fotoğraf sahibi: <span style={{ color: '#93c5fd' }}>{it.target.name}</span>
                <span style={{ color: MUTED }}> · {PLATFORM_LABEL[it.platform] ?? it.platform} · {fmtDate(it.createdAt)}</span>
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ ...LABEL, padding: '2px 8px', borderRadius: 99, border: `1px solid ${it.nth > 1 ? RED : AMBER}`, color: it.nth > 1 ? RED : AMBER }}>{it.nth}. ihlal</span>
                <span style={{ ...LABEL, padding: '2px 8px', borderRadius: 99, border: `1px solid ${it.adminAction ? GREEN : BORDER}`, color: it.adminAction ? GREEN : MUTED }}>
                  {it.nth === 1 && !it.adminAction ? 'Kullanıcıya uyarı gösterildi' : actionLabel(it.adminAction)}
                </span>
                {it.adminActionAt && <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO }}>{fmtDate(it.adminActionAt)}{it.admin ? ` · ${it.admin.name}` : ''}</span>}
              </div>
              {/* 1. ihlal: işlem yok, yalnız uyarı gösterildi bilgisi */}
              {!it.adminAction && it.nth > 1 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {it.suggestedDays && (
                    <button type="button" disabled={dis} onClick={() => void decide(it, 'SUSPEND', it.suggestedDays!)} style={btn(RED, dis, true)}>{daysLabel(it.suggestedDays)} askıya al</button>
                  )}
                  {([3, 15, 30] as const).filter((d) => d !== it.suggestedDays).map((d) => (
                    <button key={d} type="button" disabled={dis} onClick={() => void decide(it, 'SUSPEND', d)} style={btn(RED, dis)}>{daysLabel(d)}</button>
                  ))}
                  <button type="button" disabled={dis} onClick={() => void decide(it, 'NONE')} style={btn(MUTED, dis)}>İşlem yapma</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
