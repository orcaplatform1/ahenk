'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

const SURFACE = '#0a1628';
const BORDER  = '#1a3a5c';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const RED     = '#ef4444';
const AMBER   = '#f59e0b';
const SANS    = 'Inter, system-ui, sans-serif';
const MONO    = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

export interface NoShowReportItem {
  createdAt: string;
  meeting: { id: string; scheduledAt: string; type: string; locationText: string | null; cycleId?: string | null };
  reporter: { id: string; profile: { firstName: string | null; lastName: string | null } | null };
}

export interface NoShowWarningInfo {
  count: number;
  limit: number;
  warnedMeetingIds: string[];
  warnedCycleIds?: string[]; // aynı hafta tek uyarı
}

// Admin kullanıcı penceresi: gelmedi bildirimleri + hazır metinli uyarı + sınırda manuel askı seçeneği
export function AdminNoShowWarnings({
  userId, reports, warnings, canSanction, userStatus, suspending, onChanged, onSuspend,
}: {
  userId: string;
  reports: NoShowReportItem[];
  warnings: NoShowWarningInfo;
  canSanction: boolean;
  userStatus: string;
  suspending: boolean;
  onChanged: (w: NoShowWarningInfo) => void;
  onSuspend: () => void;
}) {
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (reports.length === 0 && warnings.count === 0) return null;

  // Aynı masaya birden fazla bildirim gelebilir; masa başına tek satır
  const byMeeting = new Map<string, { meeting: NoShowReportItem['meeting']; reporters: string[] }>();
  for (const r of reports) {
    const name = r.reporter.profile ? `${r.reporter.profile.firstName ?? ''} ${r.reporter.profile.lastName ?? ''}`.trim() : '—';
    const row = byMeeting.get(r.meeting.id) ?? { meeting: r.meeting, reporters: [] };
    row.reporters.push(name);
    byMeeting.set(r.meeting.id, row);
  }

  async function giveWarning(meetingId: string) {
    setWarning(meetingId);
    setError('');
    try {
      const w = await api.post<NoShowWarningInfo>(`/admin/users/${userId}/no-show-warning`, { meetingId });
      onChanged(w);
    } catch (e) {
      setError(`Uyarı verilemedi: ${(e as Error).message}`);
    } finally {
      setWarning(null);
    }
  }

  const reachedLimit = warnings.count >= warnings.limit;

  return (
    <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: RED }}>
          GELMEDİ BİLDİRİMLERİ ({reports.length})
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: reachedLimit ? RED : AMBER, fontFamily: MONO }}>
          UYARI: {warnings.count}/{warnings.limit}
        </span>
      </div>

      {[...byMeeting.values()].map(({ meeting, reporters }) => {
        const warned = warnings.warnedMeetingIds.includes(meeting.id);
        const weekWarned = !warned && !!meeting.cycleId && (warnings.warnedCycleIds ?? []).includes(meeting.cycleId);
        return (
          <div key={meeting.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
              {new Date(meeting.scheduledAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}{meeting.type === 'ONE_ON_ONE' ? 'Başbaşa' : 'Grup'}
              {meeting.locationText ? ` · ${meeting.locationText}` : ''}
              {' — bildiren: '}
              <span style={{ color: TEXT }}>{reporters.join(', ')}</span>
            </p>
            {warned ? (
              <span style={{ fontSize: 10, color: MUTED, flexShrink: 0 }}>Uyarı verildi</span>
            ) : weekWarned ? (
              <span style={{ fontSize: 10, color: MUTED, flexShrink: 0 }}>Bu hafta için uyarı verildi</span>
            ) : canSanction ? (
              <button
                onClick={() => giveWarning(meeting.id)} disabled={!!warning}
                style={{
                  flexShrink: 0, padding: '3px 10px', borderRadius: 6, cursor: warning ? 'not-allowed' : 'pointer',
                  background: 'rgba(245,158,11,0.1)', color: AMBER, border: '1px solid rgba(245,158,11,0.3)',
                  fontSize: 10, fontWeight: 600, fontFamily: SANS, opacity: warning ? 0.5 : 1,
                }}
              >
                {warning === meeting.id ? '…' : 'Uyarı Ver'}
              </button>
            ) : null}
          </div>
        );
      })}

      {error && <p style={{ margin: 0, fontSize: 11, color: RED }}>{error}</p>}

      {/* Sınıra ulaşınca otomatik askı yok; karar admin'de */}
      {reachedLimit && canSanction && userStatus !== 'SUSPENDED' && (
        <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 8, background: SURFACE, border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 11, color: RED }}>{warnings.limit} uyarıya ulaştı.</span>
          <button
            onClick={onSuspend} disabled={suspending}
            style={{
              padding: '5px 12px', borderRadius: 8, cursor: suspending ? 'not-allowed' : 'pointer',
              background: 'rgba(239,68,68,0.1)', color: RED, border: '1px solid rgba(239,68,68,0.3)',
              fontSize: 11, fontWeight: 600, fontFamily: SANS, opacity: suspending ? 0.5 : 1,
            }}
          >
            {suspending ? '…' : 'Askıya Al (1 ay)'}
          </button>
        </div>
      )}
    </div>
  );
}
