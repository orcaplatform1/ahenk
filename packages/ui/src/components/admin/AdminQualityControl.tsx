'use client';

import { useCallback, useEffect, useState } from 'react';

// ─── Renk sabitleri ───────────────────────────────────────────────────────────
const SURFACE = '#0a1628';
const CARD    = '#0d1f3c';
const BORDER  = '#1a3a5c';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const GREEN   = '#22c55e';
const RED     = '#ef4444';
const BLUE    = '#3b82f6';
const CYAN    = '#22d3ee';
const ORANGE  = '#fb923c';
const SANS    = 'Inter, system-ui, sans-serif';
const MONO    = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

const SEV_COLOR: Record<string, string>  = { CRITICAL: RED,    MEDIUM: ORANGE };
const SEV_BG:    Record<string, string>  = { CRITICAL: 'rgba(239,68,68,0.12)',   MEDIUM: 'rgba(251,146,60,0.12)' };
const SEV_BORDER:Record<string, string>  = { CRITICAL: 'rgba(239,68,68,0.35)',   MEDIUM: 'rgba(251,146,60,0.35)' };

// ─── Tipler ───────────────────────────────────────────────────────────────────
export interface QcItem {
  id: string;
  userId: string;
  userName: string;
  severity: 'CRITICAL' | 'MEDIUM';
  reason: string;
  createdAt: string;
  detail?: string;
}

interface ApiReportItem {
  id: string; userId: string; userName: string;
  riskLevel: 'CRITICAL' | 'MEDIUM'; reason: string;
  detail?: string; createdAt: string;
}

interface Props {
  items?: QcItem[];
  apiBase?: string;
  token?: string;
  onAction?: (userId: string, action: 'quarantine' | 'ban') => void;
}

async function postAction(apiBase: string, token: string | undefined, userId: string, action: 'quarantine' | 'ban') {
  const res = await fetch(`${apiBase}/api/v1/admin/users/${userId}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Hata' }));
    throw new Error((err as { message?: string }).message ?? 'Hata');
  }
  return res.json();
}

// ─── Bileşen ──────────────────────────────────────────────────────────────────
export function AdminQualityControl({ items: propItems, apiBase = '', token, onAction }: Props) {
  const [items, setItems]     = useState<QcItem[]>(propItems ?? []);
  const [selected, setSelected] = useState<QcItem | null>(null);
  const [acting, setActing]   = useState<'quarantine' | 'ban' | null>(null);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState<Set<string>>(new Set());

  const loadReports = useCallback(() => {
    if (!apiBase || propItems) return;
    fetch(`${apiBase}/api/v1/admin/reports/pending`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: ApiReportItem[]) => {
        const mapped: QcItem[] = data.map((r) => ({
          id: r.id, userId: r.userId, userName: r.userName,
          severity: r.riskLevel, reason: r.reason,
          detail: r.detail, createdAt: r.createdAt,
        }));
        setItems(mapped);
        setSelected((prev) => mapped.find((m) => m.id === prev?.id) ?? mapped[0] ?? null);
      })
      .catch(() => {});
  }, [apiBase, token, propItems]);

  useEffect(() => {
    if (propItems) {
      setItems(propItems);
      setSelected(propItems[0] ?? null);
    } else {
      loadReports();
    }
  }, [propItems, loadReports]);

  async function handleAction(action: 'quarantine' | 'ban') {
    if (!selected) return;
    setActing(action); setError('');
    try {
      await postAction(apiBase, token, selected.userId, action);
      setDone((prev) => new Set([...prev, selected.id]));
      onAction?.(selected.userId, action);
      loadReports();
      const next = items.find((i) => !done.has(i.id) && i.id !== selected.id);
      setSelected(next ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActing(null);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, minHeight: 400, fontFamily: SANS }}>

      {/* Sol liste kartı */}
      <div style={{
        width: 240, flexShrink: 0,
        background: CARD, border: `1px solid ${BORDER}`,
        borderRadius: 10, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Liste başlığı */}
        <div style={{
          padding: '12px 14px', borderBottom: `1px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ width: 2, height: 12, borderRadius: 1, background: ORANGE }} />
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: ORANGE }}>
            ŞİKAYET RAPORLARI
          </span>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginLeft: 'auto' }}>
            {items.length}
          </span>
        </div>

        {/* Liste içeriği */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.length === 0 ? (
            <div style={{ padding: '32px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: GREEN }}>
                Şikayet yok
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>
                Tüm kayıtlar temiz
              </p>
            </div>
          ) : (
            items.map((item) => {
              const isSelected = selected?.id === item.id;
              const isDone     = done.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    background: isSelected ? 'rgba(59,130,246,0.12)' : 'transparent',
                    border: `1px solid ${isSelected ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                    opacity: isDone ? 0.35 : 1,
                    fontFamily: SANS,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? TEXT : MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.userName}
                    </span>
                    <span style={{
                      fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', flexShrink: 0,
                      padding: '1px 6px', borderRadius: 99,
                      background: SEV_BG[item.severity],
                      border: `1px solid ${SEV_BORDER[item.severity]}`,
                      color: SEV_COLOR[item.severity],
                    }}>
                      {item.severity}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 10, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.reason}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Sağ detay kartı */}
      <div style={{ flex: 1 }}>
        {selected ? (
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`,
            borderRadius: 10, padding: '20px 22px',
            height: '100%', display: 'flex', flexDirection: 'column', gap: 18,
            boxSizing: 'border-box',
          }}>
            {/* Üst: isim + badge */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT }}>
                  {selected.userName}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 10, color: MUTED, fontFamily: MONO }}>
                  {new Date(selected.createdAt).toLocaleDateString('tr-TR')}
                </p>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', flexShrink: 0,
                padding: '3px 10px', borderRadius: 99,
                background: SEV_BG[selected.severity],
                border: `1px solid ${SEV_BORDER[selected.severity]}`,
                color: SEV_COLOR[selected.severity],
              }}>
                {selected.severity}
              </span>
            </div>

            {/* Sebep */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 2, height: 10, borderRadius: 1, background: MUTED }} />
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>SEBEP</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: TEXT }}>{selected.reason}</p>
            </div>

            {/* Detay */}
            {selected.detail && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 2, height: 10, borderRadius: 1, background: MUTED }} />
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED }}>DETAY</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{selected.detail}</p>
              </div>
            )}

            {/* Hata */}
            {error && (
              <p style={{ margin: 0, fontSize: 12, color: RED }}>{error}</p>
            )}

            {/* Aksiyonlar */}
            <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
              <button
                onClick={() => handleAction('quarantine')}
                disabled={!!acting || done.has(selected.id)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8,
                  cursor: acting || done.has(selected.id) ? 'not-allowed' : 'pointer',
                  background: 'rgba(251,146,60,0.1)',
                  border: '1px solid rgba(251,146,60,0.35)',
                  fontSize: 12, fontWeight: 600, color: ORANGE,
                  fontFamily: SANS,
                  opacity: acting || done.has(selected.id) ? 0.4 : 1,
                }}
              >
                {acting === 'quarantine' ? '…' : 'Karantina'}
              </button>
              <button
                onClick={() => handleAction('ban')}
                disabled={!!acting || done.has(selected.id)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8,
                  cursor: acting || done.has(selected.id) ? 'not-allowed' : 'pointer',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  fontSize: 12, fontWeight: 600, color: RED,
                  fontFamily: SANS,
                  opacity: acting || done.has(selected.id) ? 0.4 : 1,
                }}
              >
                {acting === 'ban' ? '…' : 'Banla'}
              </button>
            </div>
          </div>
        ) : (
          /* Boş detay — kart içinde */
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`,
            borderRadius: 10, height: '100%', minHeight: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 8,
          }}>
            <div style={{ fontSize: 32 }}>✅</div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: GREEN }}>
              Tüm kayıtlar işlendi
            </p>
            <p style={{ margin: 0, fontSize: 11, color: MUTED, fontFamily: MONO }}>
              Bekleyen şikayet yok
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
