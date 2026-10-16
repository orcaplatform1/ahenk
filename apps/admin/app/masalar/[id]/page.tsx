'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
import { api } from '@/lib/api';

interface Participant {
  userId: string;
  initials: string;
  gender: string;
  status: string;
}

interface Meeting {
  id: string;
  status: string;
  type: string;
  scheduledAt: string;
  locationText?: string;
  venueAddress?: string;
  maxParticipants: number;
  participants?: Participant[];
}

interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  senderName: string;
  senderId: string;
  reportCount: number;
  reports?: { reporterName: string; createdAt: string }[];
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Bekliyor',
  ACTIVE:  'Aktif',
  REVEALED: 'Onaylandı',
  CANCELLED: 'İptal',
  COMPLETED: 'Tamamlandı',
};

export default function MasaDetayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMeeting, setLoadingMeeting] = useState(true);
  const [loadingChat, setLoadingChat] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Meeting>(`/admin/meetings/${id}`)
      .then(setMeeting)
      .catch(() => setError('Masa bilgisi alınamadı'))
      .finally(() => setLoadingMeeting(false));

    api.get<ChatMessage[]>(`/chat/admin/${id}`)
      .then(setMessages)
      .catch(() => {/* sohbet henüz yok */})
      .finally(() => setLoadingChat(false));
  }, [id]);

  const reportedMessages = messages.filter((m) => m.reportCount > 0);
  const deletedMessages  = messages.filter((m) => m.deletedAt);

  return (
    <AdminShell>
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Geri */}
        <button
          onClick={() => router.back()}
          className="self-start text-sm text-muted hover:text-text flex items-center gap-1"
        >
          ← Masalar
        </button>

        {/* Masa özeti */}
        {loadingMeeting ? (
          <div className="text-muted text-sm">Yükleniyor…</div>
        ) : error ? (
          <div className="text-accent text-sm">{error}</div>
        ) : meeting && (
          <div className="bg-surface rounded-2xl border border-border p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold">Masa Detayı</h1>
                <p className="text-xs text-muted mt-0.5 font-mono">{meeting.id}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                meeting.status === 'CANCELLED' ? 'bg-red-900/30 text-red-400 border border-red-800' :
                meeting.status === 'REVEALED'  ? 'bg-green-900/30 text-green-400 border border-green-800' :
                'bg-yellow-900/30 text-yellow-400 border border-yellow-800'
              }`}>
                {STATUS_LABEL[meeting.status] ?? meeting.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Tür"       value={meeting.type === 'GROUP' ? 'Grup' : 'Baş Başa'} />
              <InfoRow label="Tarih"     value={new Date(meeting.scheduledAt).toLocaleString('tr-TR')} />
              <InfoRow label="Kapasite"  value={`${meeting.participants?.filter(p => p.status !== 'CANCELLED').length ?? 0} / ${meeting.maxParticipants}`} />
              {meeting.locationText && <InfoRow label="Mekan"     value={meeting.locationText} />}
              {meeting.venueAddress  && <InfoRow label="Adres"     value={meeting.venueAddress}  />}
            </div>
            {meeting.participants && meeting.participants.length > 0 && (
              <div>
                <p className="text-xs text-muted mb-2">Katılımcılar</p>
                <div className="flex flex-wrap gap-2">
                  {meeting.participants.map((p) => (
                    <span key={p.userId} className={`px-2.5 py-1 rounded-full text-xs border ${
                      p.status === 'CANCELLED' ? 'border-red-800 text-red-400 line-through opacity-50' : 'border-border text-text'
                    }`}>
                      {p.initials} ({p.gender === 'MALE' ? 'E' : p.gender === 'FEMALE' ? 'K' : '?'})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sohbet Geçmişi */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Sohbet Geçmişi</h2>
            <div className="flex gap-3 text-xs text-muted">
              <span>{messages.length} mesaj</span>
              {reportedMessages.length > 0 && (
                <span className="text-amber-400">{reportedMessages.length} şikayet</span>
              )}
              {deletedMessages.length > 0 && (
                <span className="text-muted">{deletedMessages.length} silindi</span>
              )}
            </div>
          </div>

          {loadingChat ? (
            <div className="text-muted text-sm">Sohbet yükleniyor…</div>
          ) : messages.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-border p-6 text-center text-muted text-sm">
              Bu masa için henüz mesaj gönderilmemiş.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {messages.map((msg) => (
                <div key={msg.id} className={`bg-surface rounded-xl border px-4 py-3 flex flex-col gap-1 ${
                  msg.reportCount > 0 ? 'border-amber-700' : 'border-border'
                } ${msg.deletedAt ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-primary">{msg.senderName}</span>
                    <div className="flex items-center gap-2">
                      {msg.reportCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-900/40 text-amber-400 text-xs border border-amber-800">
                          ⚠ {msg.reportCount} şikayet
                        </span>
                      )}
                      {msg.deletedAt && (
                        <span className="px-1.5 py-0.5 rounded-md bg-surface text-muted text-xs border border-border">
                          silindi
                        </span>
                      )}
                      <span className="text-xs text-muted">{new Date(msg.createdAt).toLocaleString('tr-TR')}</span>
                    </div>
                  </div>
                  <p className={`text-sm ${msg.deletedAt ? 'italic text-muted' : 'text-text'}`}>
                    {msg.deletedAt ? '[Silinen mesaj]' : msg.content}
                  </p>
                  {msg.reports && msg.reports.length > 0 && (
                    <div className="mt-1 flex flex-col gap-0.5 border-t border-amber-900/30 pt-1">
                      {msg.reports.map((r, i) => (
                        <span key={i} className="text-xs text-muted">
                          {r.reporterName} — {new Date(r.createdAt).toLocaleString('tr-TR')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted block">{label}</span>
      <span className="text-sm text-text">{value}</span>
    </div>
  );
}
