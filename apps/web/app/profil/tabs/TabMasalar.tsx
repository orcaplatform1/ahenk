'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, API_PREFIX } from '@/lib/api';
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

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: 'var(--font-serif, "DM Serif Display", serif)',
  fontSize: 15,
  fontWeight: 400,
  color: '#888',
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  marginBottom: 10,
};

/* Boş placeholder kart */
function EmptyMasaCard({
  locked,
  infoText,
}: {
  locked: boolean;
  infoText?: string;
}) {
  return (
    <div style={{ ...CARD_STYLE, position: 'relative', minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {locked && (
        <img
          src="/lock-icon.png"
          alt="Kilitli"
          width={36}
          height={36}
          style={{ position: 'absolute', top: 16, right: 16, opacity: 0.6 }}
        />
      )}
      {!locked && infoText && (
        <p style={{ fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 1.65, padding: '0 8px' }}>
          {infoText}
        </p>
      )}
    </div>
  );
}

/* Tek bir masa bloğunu render eder */
function MasaBlock({
  title,
  item,
  locked,
  infoText,
  token,
}: {
  title: string;
  item?: DashboardItem;
  locked: boolean;
  infoText: string;
  token: string | null;
}) {
  const meeting = item?.meeting;

  let content: React.ReactNode;

  if (locked || !meeting) {
    content = <EmptyMasaCard locked={locked} infoText={locked ? undefined : infoText} />;
  } else if (item.phase === 'REVEALED' && meeting.venueName) {
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
    content = (
      <div style={CARD_STYLE}>
        <MasaDetayKarti
          masa={detayData}
          apiBase={API_PREFIX}
          token={token ?? undefined}
        />
      </div>
    );
  } else if (meeting.participants.length > 0) {
    const isOneOnOne = meeting.type === 'ONE_ON_ONE';
    content = (
      <div style={CARD_STYLE}>
        <ConfirmedRadarView
          participants={meeting.participants}
          maxParticipants={meeting.maxParticipants}
          type={meeting.type}
          scheduledAt={meeting.scheduledAt}
          infoText={isOneOnOne
            ? "Pazar saat 10:00'da masa detayı burada görünecek, bildirim göndereceğiz."
            : "Cumartesi saat 10:00'da masa detayı burada görünecek, bildirim göndereceğiz."}
        />
      </div>
    );
  } else {
    content = <EmptyMasaCard locked={false} infoText={infoText} />;
  }

  return (
    <div>
      <p style={SECTION_TITLE}>{title}</p>
      {content}
    </div>
  );
}

export function TabMasalar({ activePlan }: {
  activePlan: 'MASADA' | 'KARSIMDA' | 'ICERDE' | null;
}) {
  const [dashItems, setDashItems] = useState<DashboardItem[]>([]);
  const [history,   setHistory]   = useState<HistoryMeeting[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [token,     setToken]     = useState<string | null>(null);

  useEffect(() => {
    setToken(api.getToken());
    Promise.all([
      api.get<{ items: DashboardItem[] }>('/meetings/dashboard').catch(() => ({ items: [] as DashboardItem[] })),
      api.get<HistoryMeeting[]>('/meetings/my-history').catch(() => [] as HistoryMeeting[]),
    ])
      .then(([dash, hist]) => {
        setDashItems(dash.items ?? []);
        setHistory(Array.isArray(hist) ? hist : []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonBlock lines={5} />;

  const groupItem    = dashItems.find(i => !i.meeting.type || i.meeting.type === 'GROUP');
  const oneOnOneItem = dashItems.find(i => i.meeting.type === 'ONE_ON_ONE');
  const locked       = activePlan === null;

  const showGroup    = activePlan === 'MASADA' || activePlan === 'ICERDE' || locked;
  const showOneOnOne = activePlan === 'KARSIMDA' || activePlan === 'ICERDE' || locked;

  return (
    <div className="flex flex-col gap-6">
      {/* Paket yok → paket seç butonu */}
      {locked && (
        <a
          href="/profil?tab=paket"
          style={{
            display: 'block', textAlign: 'center',
            padding: '12px 0', borderRadius: 12,
            background: 'linear-gradient(115deg,#c0392b,#ff6b6b)',
            color: '#fff', fontWeight: 600, fontSize: 14,
            boxShadow: '0 0 16px rgba(192,57,43,0.35)',
            textDecoration: 'none',
          }}
        >
          Paket Seç
        </a>
      )}

      {showGroup && (
        <MasaBlock
          title="Grup Masa Kartı"
          item={groupItem}
          locked={locked}
          infoText="Masa detayları Cumartesi saat 10:00'da burada görünecek"
          token={token}
        />
      )}

      {showOneOnOne && (
        <MasaBlock
          title="Baş Başa Masa Kartı"
          item={oneOnOneItem}
          locked={locked}
          infoText="Masa detayları Pazar saat 10:00'da burada görünecek"
          token={token}
        />
      )}

      {/* Geçmiş masalar */}
      {history.length > 0 && (
        <>
          <p className="text-xs font-semibold tracking-[0.14em] text-[#444] uppercase">
            Geçmiş Masalarım
          </p>
          {history.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3, ease: 'easeOut' }}
            >
              <HistoryCard meeting={m} />
            </motion.div>
          ))}
        </>
      )}
    </div>
  );
}

function HistoryCard({ meeting: m }: { meeting: HistoryMeeting }) {
  const location = m.locationName ?? m.locationText ?? null;
  const pCount   = getParticipantCount(m);

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

      {m.status === 'COMPLETED' && (
        <div className="flex gap-2 flex-wrap">
          {!m.isReviewed ? (
            <a
              href={`/degerlendirme/${m.id}`}
              className="text-xs px-3 py-1.5 font-medium"
              style={{
                background: 'linear-gradient(135deg,#c0392b,#ff6b6b)',
                borderRadius: 9999, color: '#fff',
              }}
            >
              Değerlendir
            </a>
          ) : (
            <span
              className="text-xs px-3 py-1.5 text-[#555]"
              style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9999 }}
            >
              ✓ Değerlendirildi
            </span>
          )}
        </div>
      )}
    </div>
  );
}
