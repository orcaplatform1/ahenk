'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

interface Report {
  id: string;
  userId: string;
  userName: string;
  reason: string;
  detail?: string;
  createdAt: string;
  riskLevel: 'CRITICAL' | 'MEDIUM';
}

export default function AdminQuality() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function load() {
    api.get<Report[]>('/admin/reports/pending').then(setReports).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function quarantine(userId: string) {
    setActionLoading(userId + '_q');
    await api.post(`/admin/users/${userId}/quarantine`, {}).catch(() => {});
    setActionLoading(null);
    load();
  }

  async function ban(userId: string) {
    if (!confirm('Kullanıcıyı ban et?')) return;
    setActionLoading(userId + '_b');
    await api.post(`/admin/users/${userId}/ban`, {}).catch(() => {});
    setActionLoading(null);
    load();
  }

  const riskColor = { CRITICAL: '#ff6b6b', MEDIUM: '#f59e0b' };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="font-serif text-2xl text-[#f5f5f5] mb-2">Şikayetler</h1>
      <p className="text-sm text-[#555] mb-6">Bekleyen şikayet raporları</p>

      {loading ? (
        <div className="flex flex-col gap-3">{[0,1,2].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />)}</div>
      ) : reports.length === 0 ? (
        <p className="text-[#555] text-sm">Bekleyen şikayet yok.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {reports.map((r, i) => (
            <motion.div key={r.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-card px-4 py-3"
              style={r.riskLevel === 'CRITICAL' ? { border: '1px solid rgba(192,57,43,0.3)' } : {}}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-[#f5f5f5]">{r.userName}</p>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: r.riskLevel === 'CRITICAL' ? 'rgba(192,57,43,0.15)' : 'rgba(245,158,11,0.12)', color: riskColor[r.riskLevel] }}>
                      {r.riskLevel}
                    </span>
                  </div>
                  <p className="text-xs text-[#888]">{r.reason}</p>
                  <p className="text-xs text-[#444] mt-0.5">{new Date(r.createdAt).toLocaleString('tr-TR')}</p>
                </div>
                <button onClick={() => setExpanded(e => e === r.id ? null : r.id)}
                  className="text-xs px-2.5 py-1 rounded-lg flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.10)', color: '#666', border: '1px solid rgba(255,255,255,0.12)' }}>
                  {expanded === r.id ? '▲' : '▼'}
                </button>
              </div>

              {expanded === r.id && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                  {r.detail && <p className="text-xs text-[#888] mb-3 italic">"{r.detail}"</p>}
                  <div className="flex gap-2">
                    <button onClick={() => quarantine(r.userId)} disabled={actionLoading !== null}
                      className="flex-1 py-1.5 rounded-xl text-xs font-medium"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                      {actionLoading === r.userId + '_q' ? '…' : 'Karantinaya Al'}
                    </button>
                    <button onClick={() => ban(r.userId)} disabled={actionLoading !== null}
                      className="flex-1 py-1.5 rounded-xl text-xs font-medium"
                      style={{ background: 'rgba(192,57,43,0.12)', color: '#ff6b6b', border: '1px solid rgba(192,57,43,0.2)' }}>
                      {actionLoading === r.userId + '_b' ? '…' : 'Ban Et'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
