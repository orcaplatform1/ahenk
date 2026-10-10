'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';

interface Meeting {
  id: string;
  scheduledAt: string;
  locationText?: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
}

interface Participant {
  userId: string;
  initials: string;
  gender: string;
  isRequester: boolean;
}

const STATUS_LABEL: Record<Meeting['status'], { label: string; cls: string }> = {
  PENDING:   { label: 'Bekleniyor',   cls: 'text-muted border-border' },
  CONFIRMED: { label: 'Onaylandı',    cls: 'text-green-400 border-green-800' },
  COMPLETED: { label: 'Tamamlandı',   cls: 'text-primary border-red-800' },
  CANCELLED: { label: 'İptal Edildi', cls: 'text-accent border-accent/30' },
};

export function TabMasalar() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [previewMeeting, setPreviewMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [blockingUserId, setBlockingUserId] = useState('');
  const [blockError, setBlockError] = useState('');

  useEffect(() => {
    api.get<Meeting[]>('/meetings/my')
      .then(setMeetings)
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
  if (error) return <p className="text-accent text-sm">{error}</p>;

  if (meetings.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-8 text-center">
        <p className="text-muted text-sm">Henüz hiç masana katılmadın.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {meetings.map((m) => {
          const s = STATUS_LABEL[m.status];
          return (
            <div key={m.id} className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-text font-medium">
                    {new Date(m.scheduledAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-muted">
                    {m.locationText ?? 'Mekan henüz belirlenmedi'}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border flex-shrink-0 ${s.cls}`}>{s.label}</span>
              </div>

              {m.status === 'CONFIRMED' && (
                <button
                  onClick={() => openPreview(m)}
                  className="mt-4 text-xs border border-border rounded-xl px-3 py-1.5 text-muted hover:text-text hover:border-muted transition-colors"
                >
                  Katılımcıları Gör
                </button>
              )}

              {m.status === 'COMPLETED' && (
                <button
                  onClick={() => openPreview(m)}
                  className="mt-4 text-xs border border-border rounded-xl px-3 py-1.5 text-muted hover:text-text hover:border-muted transition-colors"
                >
                  Katılımcıları Gör &amp; Engelle
                </button>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        open={!!previewMeeting}
        onClose={() => setPreviewMeeting(null)}
        title="Masa Katılımcıları"
      >
        {previewLoading && <SkeletonBlock lines={3} />}
        {!previewLoading && blockError && <p className="text-accent text-sm">{blockError}</p>}
        {!previewLoading && participants.length === 0 && !blockError && (
          <p className="text-muted text-sm">Katılımcı bulunamadı.</p>
        )}
        {!previewLoading && participants.length > 0 && (
          <div className="flex flex-col gap-3">
            {participants.map((p) => (
              <div key={p.userId} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-bg border border-border flex items-center justify-center text-xs font-medium text-text">
                    {p.initials}
                  </div>
                  <span className="text-sm text-muted">{p.gender === 'MALE' ? 'Erkek' : p.gender === 'FEMALE' ? 'Kadın' : '—'}</span>
                </div>
                {!p.isRequester && previewMeeting?.status === 'COMPLETED' && (
                  <button
                    onClick={() => blockUser(previewMeeting.id, p.userId)}
                    disabled={blockingUserId === p.userId}
                    className="text-xs px-3 py-1 rounded-lg border border-red-900 text-accent hover:bg-red-900/20 transition-colors disabled:opacity-50"
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
