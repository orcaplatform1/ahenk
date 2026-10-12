'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { ConfirmedRadarView } from '@ahenk/ui';

interface Meeting {
  id: string;
  scheduledAt: string;
  type?: 'GROUP' | 'ONE_ON_ONE';
  locationName?: string | null;
  locationText?: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  _count?: { participants?: number };
  participantCount?: number;
  maxParticipants?: number;
  isReviewed?: boolean;
}

interface Participant {
  userId: string;
  initials: string;
  gender: string;
  isRequester: boolean;
}

const STATUS: Record<Meeting['status'], { label: string; color: string; border: string }> = {
  PENDING:   { label: 'Bekleniyor',   color: '#888',     border: 'rgba(255,255,255,0.1)' },
  CONFIRMED: { label: 'Onaylandı',    color: '#4ade80',  border: 'rgba(74,222,128,0.25)' },
  COMPLETED: { label: 'Tamamlandı',   color: '#ff6b6b',  border: 'rgba(192,57,43,0.35)' },
  CANCELLED: { label: 'İptal Edildi', color: '#ff6b6b',  border: 'rgba(192,57,43,0.2)' },
};

function fmtDate(val: string) {
  return new Date(val).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getParticipantCount(m: Meeting): number | null {
  if (typeof m.participantCount === 'number') return m.participantCount;
  if (typeof m._count?.participants === 'number') return m._count.participants;
  return null;
}

export function TabMasalar() {
  const [current, setCurrent] = useState<Meeting | null>(null);
  const [history, setHistory] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [pendingParticipants, setPendingParticipants] = useState<Participant[]>([]);

  const [previewMeeting, setPreviewMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [blockingUserId, setBlockingUserId] = useState('');
  const [blockError, setBlockError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Meeting>('/meetings/my-current').catch(() => null),
      api.get<Meeting[]>('/meetings/my-history').catch(() => [] as Meeting[]),
    ])
      .then(([cur, hist]) => {
        setCurrent(cur);
        setHistory(Array.isArray(hist) ? hist : []);
        // PENDING masa varsa katılımcıları çek (masa kuruldu kartı için)
        if (cur && cur.status === 'PENDING') {
          api.get<Participant[]>(`/meetings/${cur.id}/participants-preview`)
            .then(setPendingParticipants)
            .catch(() => {});
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function openPreview(meeting: Meeting) {
    setPreviewMeeting(meeting);
    setParticipants([]);
    setBlockError('');
    setPreviewLoading(true);
    try {
      const data = await api.get<Participant[]>(`/meetings/${meeting.id}/participants-preview`);
      setParticipants(data);
    } catch (e) {
      setBlockError((e as Error).message);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function blockUser(meetingId: string, userId: string) {
    setBlockingUserId(userId);
    setBlockError('');
    try {
      await api.post(`/meetings/${meetingId}/block`, { blockedUserIds: [userId] });
      setParticipants((prev) => prev.filter((p) => p.userId !== userId));
    } catch (e) {
      setBlockError((e as Error).message);
    } finally {
      setBlockingUserId('');
    }
  }

  if (loading) return <SkeletonBlock lines={5} />;
  if (error) return <p className="text-[#ff6b6b] text-sm">{error}</p>;

  // PENDING masa ve geçmiş de yoksa boş mesaj
  if (!current && history.length === 0) {
    return (
      <div className="glass-card p-10 flex flex-col items-center text-center gap-2">
        <p className="text-[#888] text-sm">Henüz hiç masana katılmadın.</p>
        <p className="text-xs text-[#555]">Eşleştirme algoritması her Perşembe çalışır.</p>
      </div>
    );
  }

  const isPending = current?.status === 'PENDING';

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* PENDING masa — masa kuruldu kartı */}
        {isPending && pendingParticipants.length > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.4)',
            borderRadius: 16,
            padding: '28px 20px 24px',
          }}>
            <ConfirmedRadarView
              participants={pendingParticipants}
              maxParticipants={current?.maxParticipants}
              type={current?.type}
              scheduledAt={current?.scheduledAt ?? new Date().toISOString()}
              infoText={
                current?.type === 'ONE_ON_ONE'
                  ? "Pazar günü saat 10:00'da masa detayı burada görünecek, bildirim göndereceğiz."
                  : "Cumartesi günü saat 10:00'da masa detayı burada görünecek, bildirim göndereceğiz."
              }
            />
          </div>
        )}

        {/* PENDING ama katılımcı yoksa (henüz taranıyor) — kart gösterme */}

        {/* CONFIRMED/ACTIVE masa */}
        {current && !isPending && (
          <MeetingCard
            meeting={current}
            label="Bu Hafta"
            onPreview={openPreview}
          />
        )}

        {/* Geçmiş masalar */}
        {history.length > 0 && (
          <>
            {current && (
              <p className="text-xs font-semibold tracking-[0.14em] text-[#444] uppercase mt-2">Geçmiş Masalar</p>
            )}
            {history.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3, ease: 'easeOut' }}
              >
                <MeetingCard meeting={m} onPreview={openPreview} />
              </motion.div>
            ))}
          </>
        )}
      </div>

      <Modal open={!!previewMeeting} onClose={() => setPreviewMeeting(null)} title="Masa Katılımcıları">
        {previewLoading && <SkeletonBlock lines={3} />}
        {!previewLoading && blockError && <p className="text-[#ff6b6b] text-sm">{blockError}</p>}
        {!previewLoading && participants.length === 0 && !blockError && (
          <p className="text-[#888] text-sm">Katılımcı bulunamadı.</p>
        )}
        {!previewLoading && participants.length > 0 && (
          <div className="flex flex-col gap-3">
            {participants.map((p) => (
              <div key={p.userId} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-[#f5f5f5]"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {p.initials}
                  </div>
                  <span className="text-sm text-[#888]">{p.gender === 'MALE' ? 'Erkek' : p.gender === 'FEMALE' ? 'Kadın' : '—'}</span>
                </div>
                {!p.isRequester && previewMeeting?.status === 'COMPLETED' && (
                  <button
                    onClick={() => blockUser(previewMeeting.id, p.userId)}
                    disabled={blockingUserId === p.userId}
                    className="text-xs px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                    style={{ border: '1px solid rgba(192,57,43,0.4)', color: '#ff6b6b' }}
                  >
                    {blockingUserId === p.userId ? '…' : 'Engelle'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

function MeetingCard({ meeting: m, label, onPreview }: {
  meeting: Meeting;
  label?: string;
  onPreview: (m: Meeting) => void;
}) {
  const router = useRouter();
  const s = STATUS[m.status];
  const location = m.locationName ?? m.locationText ?? null;
  const pCount = getParticipantCount(m);
  const canPreview = m.status === 'CONFIRMED' || m.status === 'COMPLETED';
  const canReview = m.status === 'COMPLETED' && !m.isReviewed;

  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          {label && (
            <span className="text-xs font-semibold tracking-[0.14em] text-[#555] uppercase">{label}</span>
          )}
          <p className="text-sm font-medium text-[#f5f5f5]">{fmtDate(m.scheduledAt)}</p>
          <p className="text-xs text-[#888] truncate">
            {location ?? 'Mekan henüz belirlenmedi'}
          </p>
          {pCount !== null && (
            <p className="text-xs text-[#555]">
              {pCount} kişi ile buluşma
            </p>
          )}
        </div>
        <span
          className="text-xs px-2.5 py-1 rounded-full border flex-shrink-0 font-medium"
          style={{ color: s.color, borderColor: s.border }}
        >
          {s.label}
        </span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {canPreview && (
          <button
            onClick={() => onPreview(m)}
            className="text-xs px-3 py-1.5 text-[#888] hover:text-[#f5f5f5] transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9999 }}
          >
            {m.status === 'COMPLETED' ? 'Katılımcıları Gör' : 'Katılımcıları Gör'}
          </button>
        )}
        {canReview && (
          <button
            onClick={() => router.push(`/degerlendirme/${m.id}`)}
            className="text-xs px-3 py-1.5 font-medium transition-all"
            style={{ background: 'linear-gradient(135deg,#c0392b,#ff6b6b)', borderRadius: 9999, color: '#fff', border: 'none' }}
          >
            Değerlendir
          </button>
        )}
        {m.status === 'COMPLETED' && m.isReviewed && (
          <span className="text-xs px-3 py-1.5 text-[#555]" style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9999 }}>
            ✓ Değerlendirildi
          </span>
        )}
      </div>
    </div>
  );
}
