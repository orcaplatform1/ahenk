'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  id: string;
  userId: string;
  userName: string;
  riskLevel: 'CRITICAL' | 'MEDIUM';
  reason: string;
  detail?: string;
  createdAt: string;
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

const BADGE_CLS: Record<QcItem['severity'], string> = {
  CRITICAL: 'bg-red-900/40 text-accent border border-red-800',
  MEDIUM:   'bg-orange-900/30 text-orange-400 border border-orange-800',
};

export function AdminQualityControl({ items: propItems, apiBase = '', token, onAction }: Props) {
  const [items, setItems] = useState<QcItem[]>(propItems ?? []);
  const [selected, setSelected] = useState<QcItem | null>(null);
  const [acting, setActing] = useState<'quarantine' | 'ban' | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Set<string>>(new Set());

  const loadReports = useCallback(() => {
    if (!apiBase || propItems) return;
    fetch(`${apiBase}/api/v1/admin/reports/pending`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: ApiReportItem[]) => {
        const mapped: QcItem[] = data.map((r) => ({
          id: r.id,
          userId: r.userId,
          userName: r.userName,
          severity: r.riskLevel,
          reason: r.reason,
          detail: r.detail,
          createdAt: r.createdAt,
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
      // Listeyi yenile
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
    <div className="flex gap-4 h-full min-h-96">
      {/* Sol liste */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-1 overflow-y-auto">
        {items.map((item) => (
          <motion.button
            key={item.id}
            onClick={() => setSelected(item)}
            whileHover={{ x: 2 }}
            className={`w-full text-left px-3 py-3 rounded-xl border transition-colors ${
              selected?.id === item.id
                ? 'bg-primary/10 border-primary/40 text-text'
                : done.has(item.id)
                ? 'opacity-40 border-border text-muted'
                : 'border-border hover:bg-surface text-muted hover:text-text'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate">{item.userName}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-md flex-shrink-0 ml-2 ${BADGE_CLS[item.severity]}`}>
                {item.severity}
              </span>
            </div>
            <p className="text-xs text-muted truncate">{item.reason}</p>
          </motion.button>
        ))}
        {items.length === 0 && <p className="text-sm text-muted px-3">Kayıt yok.</p>}
      </div>

      {/* Sağ detay */}
      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              className="bg-surface border border-border rounded-2xl p-6 h-full flex flex-col gap-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-serif text-xl text-text">{selected.userName}</h3>
                  <p className="text-xs text-muted mt-0.5">{new Date(selected.createdAt).toLocaleDateString('tr-TR')}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-md ${BADGE_CLS[selected.severity]}`}>{selected.severity}</span>
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted uppercase tracking-wide">Sebep</p>
                <p className="text-sm text-text">{selected.reason}</p>
              </div>

              {selected.detail && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted uppercase tracking-wide">Detay</p>
                  <p className="text-sm text-muted leading-relaxed">{selected.detail}</p>
                </div>
              )}

              {error && <p className="text-accent text-sm">{error}</p>}

              <div className="flex gap-3 mt-auto">
                <motion.button
                  onClick={() => handleAction('quarantine')}
                  disabled={!!acting || done.has(selected.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 py-2.5 rounded-xl border border-orange-800 bg-orange-900/20 text-orange-400 text-sm font-medium disabled:opacity-40 transition-colors hover:bg-orange-900/40"
                >
                  {acting === 'quarantine' ? '…' : 'Karantina'}
                </motion.button>
                <motion.button
                  onClick={() => handleAction('ban')}
                  disabled={!!acting || done.has(selected.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 py-2.5 rounded-xl border border-red-800 bg-red-900/20 text-accent text-sm font-medium disabled:opacity-40 transition-colors hover:bg-red-900/40"
                >
                  {acting === 'ban' ? '…' : 'Banla'}
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center justify-center h-full">
              <p className="text-muted text-sm">Tüm kayıtlar işlendi.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
