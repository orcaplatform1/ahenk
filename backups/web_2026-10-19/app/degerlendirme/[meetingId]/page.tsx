'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

interface Participant {
  userId: string;
  initials: string;
  gender: string | null;
  isRequester: boolean;
}

interface MeetingInfo {
  locationName: string | null;
  scheduledAt: string;
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.4, ease: 'easeOut' as const },
});

export default function DegerlendirmePage() {
  const router = useRouter();
  const params = useParams();
  const meetingId = params.meetingId as string;

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [wantRematch, setWantRematch] = useState<boolean | null>(null);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Participant[]>(`/meetings/${meetingId}/participants-preview`),
      api.get<MeetingInfo>(`/meetings/${meetingId}/info`).catch(() => null),
    ]).then(([parts]) => {
      setParticipants(parts.filter((p) => !p.isRequester));
    }).catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [meetingId]);

  function toggleBlock(userId: string) {
    setBlockedIds((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }

  async function handleSubmit() {
    if (rating === 0) { setError('Lütfen yıldız seçin.'); return; }
    setSubmitting(true); setError('');
    try {
      await api.post(`/meetings/${meetingId}/review`, {
        rating,
        blockedUserIds: [...blockedIds],
        comment: comment.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (e) { setError((e as Error).message); }
    finally { setSubmitting(false); }
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0a' }}>
      {/* Glow */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-8%', left: '50%', transform: 'translateX(-50%)', width: '70vw', height: '70vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.09) 0%, transparent 60%)', filter: 'blur(60px)' }} />
      </div>

      {/* Başarı overlay */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 flex flex-col items-center justify-center"
            style={{ background: '#0a0a0a', zIndex: 100 }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 1], opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut', times: [0, 0.7, 1] }}
              className="flex items-center justify-center mb-7"
              style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg,#c0392b,#ff6b6b)' }}
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <motion.path
                  d="M8 20 L17 29 L32 13"
                  stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                />
              </svg>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="font-serif text-4xl text-[#f5f5f5]"
            >
              Teşekkürler!
            </motion.h1>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex-1 max-w-lg mx-auto w-full px-5 py-12" style={{ zIndex: 1 }}>

        {/* Başlık */}
        <motion.div {...fadeUp(0)} className="mb-8">
          <h1 className="font-serif text-3xl text-[#f5f5f5] mb-2">Dün akşamki ahenk nasıldı?</h1>
          {meetingInfo && (
            <p className="text-[#555] text-sm">
              {meetingInfo.locationName && `${meetingInfo.locationName} · `}
              {fmtDate(meetingInfo.scheduledAt)}
            </p>
          )}
        </motion.div>

        {loading ? (
          <div className="flex flex-col gap-4">
            {[0,1,2].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
          </div>
        ) : (
          <div className="flex flex-col gap-6">

            {/* Yıldız */}
            <motion.div {...fadeUp(0.1)} className="glass-card p-5">
              <p className="text-sm text-[#888] mb-4 font-medium">Genel deneyim</p>
              <div className="flex gap-3 justify-center">
                {[1,2,3,4,5].map((star) => (
                  <motion.button
                    key={star}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setRating(star)}
                    whileHover={{ scale: 1.2 }}
                    animate={rating === star ? { scale: [0.9, 1.15, 1] } : { scale: 1 }}
                    transition={{ duration: 0.25 }}
                    className="text-3xl leading-none"
                    style={{ filter: (hovered || rating) >= star ? 'none' : 'grayscale(1) opacity(0.25)' }}
                  >
                    <span style={{ color: (hovered || rating) >= star ? '#c0392b' : '#555' }}>★</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Tekrar buluşma isteği */}
            <motion.div {...fadeUp(0.2)} className="glass-card p-5">
              <p className="text-sm text-[#888] mb-4 font-medium">
                Masadakilerle tekrar bir araya gelmek ister misin?
              </p>
              <div className="flex gap-3">
                {[{ val: true, label: 'Evet' }, { val: false, label: 'Hayır' }].map(({ val, label }) => (
                  <button
                    key={label}
                    onClick={() => setWantRematch(val)}
                    className="flex-1 py-2.5 text-sm font-medium rounded-xl transition-all"
                    style={
                      wantRematch === val
                        ? { background: 'linear-gradient(135deg,#c0392b,#ff6b6b)', color: '#fff', border: 'none' }
                        : { border: '1px solid rgba(255,255,255,0.1)', color: '#888', background: 'transparent' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              <AnimatePresence>
                {wantRematch === false && participants.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 rounded-xl px-4 py-3" style={{ background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)' }}>
                      <p className="text-xs text-[#ff6b6b] leading-relaxed">
                        Masada tekrar görmek istemediğin kişiyi işaretle. Bir daha asla aynı masada denk gelmeyeceksiniz. <strong>Bu işlemin geri dönüşü yoktur.</strong>
                      </p>
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      {participants.map((p) => (
                        <label
                          key={p.userId}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors"
                          style={{
                            background: blockedIds.has(p.userId) ? 'rgba(192,57,43,0.08)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${blockedIds.has(p.userId) ? 'rgba(192,57,43,0.3)' : 'rgba(255,255,255,0.07)'}`,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={blockedIds.has(p.userId)}
                            onChange={() => toggleBlock(p.userId)}
                            className="w-4 h-4 accent-[#c0392b] cursor-pointer"
                          />
                          <span className="text-sm text-[#ccc] font-medium">{p.initials}</span>
                          {p.gender && (
                            <span className="text-xs text-[#555]">{p.gender === 'MALE' ? 'E' : p.gender === 'FEMALE' ? 'K' : ''}</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Yorum */}
            <motion.div {...fadeUp(0.3)} className="glass-card p-5">
              <p className="text-sm text-[#888] mb-3 font-medium">Açık yorum <span className="text-[#444]">(opsiyonel)</span></p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 300))}
                placeholder="Bu akşam hakkında düşüncelerini yaz..."
                rows={3}
                className="input-glass w-full px-4 py-3 text-sm resize-none"
              />
              <p className="text-right text-xs text-[#444] mt-1">{comment.length}/300</p>
            </motion.div>

            {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}

            {/* Gönder */}
            <motion.div {...fadeUp(0.4)}>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full btn-primary disabled:opacity-50"
              >
                {submitting ? 'Gönderiliyor…' : 'Değerlendirmeyi Gönder'}
              </button>
            </motion.div>

          </div>
        )}
      </div>
    </div>
  );
}
