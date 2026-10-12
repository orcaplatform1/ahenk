'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { ConfirmedRadarView, MasaDetayKarti, type MasaDetayData } from '@ahenk/ui';

interface DashboardItem {
  phase: 'WAITING' | 'REVEALED';
  meeting: {
    id: string;
    type?: 'GROUP' | 'ONE_ON_ONE';
    maxParticipants?: number;
    scheduledAt: string;
    participants: Array<{ initials: string; gender: string | null }>;
    venueName?: string;
    venueAddress?: string;
    venueMapsUrl?: string;
    venuePhotos?: Array<{ url: string; caption?: string }>;
    aiReport?: { content: string; uyumSkoru: number; generatedAt: string } | null;
  };
}

interface HistoryMeeting {
  id: string;
  scheduledAt: string;
  type?: 'GROUP' | 'ONE_ON_ONE';
  locationName?: string | null;
  locationText?: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  _count?: { participants?: number };
  participantCount?: number;
  isReviewed?: boolean;
}

function fmtDate(val: string) {
  return new Date(val).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getParticipantCount(m: HistoryMeeting): number | null {
  if (typeof m.participantCount === 'number') return m.participantCount;
  if (typeof m._count?.participants === 'number') return m._count.participants;
  return null;
}

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.4)',
  borderRadius: 16,
  padding: '28px 20px 24px',
};

export function TabMasalar() {
  const router = useRouter();
  const [dashItems, setDashItems] = useState<DashboardItem[]>([]);
  const [history, setHistory] = useState<HistoryMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<{ items: DashboardItem[] }>('/meetings/dashboard').catch(() => ({ items: [] as DashboardItem[] })),
      api.get<HistoryMeeting[]>('/meetings/my-history').catch(() => [] as HistoryMeeting[]),
    ])
      .then(([dash, hist]) => {
        setDashItems(dash.items ?? []);
        setHistory(Array.isArray(hist) ? hist : []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonBlock lines={5} />;
  if (error) return <p className="text-[#ff6b6b] text-sm">{error}</p>;

  if (dashItems.length === 0 && history.length === 0) {
    return (
      <div className="glass-card p-10 flex flex-col items-center text-center gap-2">
        <p className="text-[#888] text-sm">Henüz hiç masana katılmadın.</p>
        <p className="text-xs text-[#555]">Eşleştirme algoritması her Perşembe çalışır.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {dashItems.map((item) => {
        const { meeting } = item;

        if (item.phase === 'REVEALED' && meeting.venueName) {
          const detayData: MasaDetayData = {
            id: meeting.id,
            type: meeting.type,
            maxParticipants: meeting.maxParticipants,
            scheduledAt: meeting.scheduledAt,
            venueName: meeting.venueName,
            venueAddress: meeting.venueAddress,
            venueMapsUrl: meeting.venueMapsUrl,
            venuePhotos: meeting.venuePhotos,
            participants: meeting.participants,
            aiReport: meeting.aiReport,
          };
          return (
            <div key={meeting.id} style={CARD_STYLE}>
              <MasaDetayKarti masa={detayData} />
            </div>
          );
        }

        if (meeting.participants.length > 0) {
          const isOneOnOne = meeting.type === 'ONE_ON_ONE';
          const infoText = isOneOnOne
            ? "Pazar saat 10:00'da masa detayı burada görünecek, bildirim göndereceğiz."
            : "Cumartesi saat 10:00'da masa detayı burada görünecek, bildirim göndereceğiz.";
          return (
            <div key={meeting.id} style={CARD_STYLE}>
              <ConfirmedRadarView
                participants={meeting.participants}
                maxParticipants={meeting.maxParticipants}
                type={meeting.type}
                scheduledAt={meeting.scheduledAt}
                infoText={infoText}
              />
            </div>
          );
        }

        return null;
      })}

      {history.length > 0 && (
        <>
          {dashItems.length > 0 && (
            <p className="text-xs font-semibold tracking-[0.14em] text-[#444] uppercase mt-2">
              Geçmiş Masalar
            </p>
          )}
          {history.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3, ease: 'easeOut' }}
            >
              <HistoryCard
                meeting={m}
                onReview={() => router.push(`/degerlendirme/${m.id}`)}
              />
            </motion.div>
          ))}
        </>
      )}
    </div>
  );
}

function HistoryCard({ meeting: m, onReview }: {
  meeting: HistoryMeeting;
  onReview: () => void;
}) {
  const location = m.locationName ?? m.locationText ?? null;
  const pCount = getParticipantCount(m);
  const canReview = m.status === 'COMPLETED' && !m.isReviewed;

  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-sm font-medium text-[#f5f5f5]">{fmtDate(m.scheduledAt)}</p>
          <p className="text-xs text-[#888] truncate">{location ?? 'Mekan bilgisi yok'}</p>
          {pCount !== null && (
            <p className="text-xs text-[#555]">{pCount} kişi ile buluşma</p>
          )}
        </div>
        <span
          className="text-xs px-2.5 py-1 rounded-full border flex-shrink-0 font-medium"
          style={{ color: '#888', borderColor: 'rgba(255,255,255,0.1)' }}
        >
          Tamamlandı
        </span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {canReview && (
          <button
            onClick={onReview}
            className="text-xs px-3 py-1.5 font-medium transition-all"
            style={{
              background: 'linear-gradient(135deg,#c0392b,#ff6b6b)',
              borderRadius: 9999, color: '#fff', border: 'none',
            }}
          >
            Değerlendir
          </button>
        )}
        {m.status === 'COMPLETED' && m.isReviewed && (
          <span
            className="text-xs px-3 py-1.5 text-[#555]"
            style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9999 }}
          >
            ✓ Değerlendirildi
          </span>
        )}
      </div>
    </div>
  );
}
