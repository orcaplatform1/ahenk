'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';

interface Participant {
  userId: string;
  initials: string;
  gender: string | null;
  isRequester: boolean;
}

interface MeetingInfo {
  locationName: string | null;
  scheduledAt: string;
  reviewOpensAt: string;
  reviewClosesAt: string;
  reviewed: boolean;
  myNoShowIds?: string[];
}

const MALE_CLR   = '#4fc3f7';
const FEMALE_CLR = '#f48fb1';
const genderColor = (g: string | null) => (g === 'FEMALE' ? FEMALE_CLR : g === 'MALE' ? MALE_CLR : '#888');

const COMMENT_MIN = 20;
const COMMENT_MAX = 300;

function Star({ filled, size = 40 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden
      style={{ filter: filled ? 'drop-shadow(0 0 8px rgba(255,107,107,0.45))' : 'none', transition: 'filter 0.2s ease' }}>
      <defs>
        <linearGradient id="ahenk-star" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c0392b" />
          <stop offset="100%" stopColor="#ff6b6b" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.45 6.2 20.5l1.1-6.47L2.6 9.45l6.5-.95L12 2.6z"
        fill={filled ? 'url(#ahenk-star)' : 'rgba(255,255,255,0.04)'}
        stroke={filled ? 'none' : 'rgba(255,255,255,0.18)'}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
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
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [noShowIds, setNoShowIds] = useState<Set<string>>(new Set());
  // Masa kartından önceden bildirilen gelmeyenler: dolu ve kilitli (geri alınamaz)
  const [lockedNoShow, setLockedNoShow] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Participant[]>(`/meetings/${meetingId}/participants-preview`),
      api.get<MeetingInfo>(`/meetings/${meetingId}/info`).catch(() => null),
    ]).then(([parts, info]) => {
      setParticipants(parts.filter((p) => !p.isRequester));
      setMeetingInfo(info);
      const locked = new Set(info?.myNoShowIds ?? []);
      setLockedNoShow(locked);
      setNoShowIds(new Set(locked));
    }).catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [meetingId]);

  function toggleIn(setter: React.Dispatch<React.SetStateAction<Set<string>>>, userId: string) {
    setter((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }

  const blocksToSend = [...blockedIds];
  const commentLen = comment.trim().length;

  function handleSubmit() {
    if (rating === 0) { setError('Lütfen yıldız seçin.'); return; }
    if (commentLen < COMMENT_MIN) { setError(`Beklenti yorumu en az ${COMMENT_MIN} karakter olmalı.`); return; }
    setError('');
    if (blocksToSend.length > 0) { setConfirmOpen(true); return; }
    send();
  }

  async function send() {
    setConfirmOpen(false);
    setSubmitting(true); setError('');
    try {
      await api.post(`/meetings/${meetingId}/review`, {
        rating,
        blockedUserIds: blocksToSend,
        noShowUserIds: [...noShowIds],
        comment: comment.trim(),
      });
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (e) { setError((e as Error).message); }
    finally { setSubmitting(false); }
  }

  const now = Date.now();
  const windowState = !meetingInfo ? 'open'
    : meetingInfo.reviewed ? 'reviewed'
    : now < new Date(meetingInfo.reviewOpensAt).getTime() ? 'notYet'
    : now > new Date(meetingInfo.reviewClosesAt).getTime() ? 'closed'
    : 'open';
  const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', hour: '2-digit', minute: '2-digit' });
  const initialsOf = (ids: string[]) => participants.filter((p) => ids.includes(p.userId)).map((p) => p.initials).join(', ');

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#121212' }}>
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
            style={{ background: '#121212', zIndex: 100 }}
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
          <h1 className="font-serif text-3xl text-[#f5f5f5] mb-2">
            {meetingInfo ? `${new Date(meetingInfo.scheduledAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} Tarihli Masada Ahenk Nasıldı?` : 'Masada Ahenk Nasıldı?'}
          </h1>
          {meetingInfo && (
            <p className="text-[#555] text-sm">
              {meetingInfo.locationName && `${meetingInfo.locationName} · `}
              {fmtDate(meetingInfo.scheduledAt)}
            </p>
          )}
        </motion.div>

        {loading ? (
          <div className="flex flex-col gap-4">
            {[0,1,2].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />)}
          </div>
        ) : windowState !== 'open' ? (
          <motion.div {...fadeUp(0.1)} className="glass-card p-6 text-center flex flex-col items-center gap-4">
            <p className="text-[#ccc] text-sm">
              {windowState === 'reviewed' && 'Bu masayı zaten değerlendirdin. Teşekkürler!'}
              {windowState === 'notYet' && meetingInfo && `Değerlendirme ${fmtDateTime(meetingInfo.reviewOpensAt)} itibarıyla açılacak.`}
              {windowState === 'closed' && 'Bu masanın değerlendirme süresi doldu.'}
            </p>
            <button onClick={() => router.push('/dashboard')} className="btn-ghost">Panele Dön</button>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-6">

            {/* Yıldız */}
            <motion.div {...fadeUp(0.1)} className="glass-card p-5">
              <p className="text-sm text-[#888] mb-4 font-medium">Genel deneyim</p>
              <div className="flex gap-2 justify-center" onMouseLeave={() => setHovered(0)}>
                {[1,2,3,4,5].map((star) => (
                  <motion.button
                    key={star}
                    type="button"
                    aria-label={`${star} yıldız`}
                    onMouseEnter={() => setHovered(star)}
                    onClick={() => { setRating(star); setError(''); }}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    animate={rating === star ? { scale: [0.85, 1.2, 1] } : { scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="leading-none p-1"
                  >
                    <Star filled={(hovered || rating) >= star} />
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Engelleme */}
            {participants.length > 0 && (
              <motion.div {...fadeUp(0.2)} className="glass-card p-5">
                <p className="text-sm text-[#888] mb-1 font-medium">
                  Masada rahatsız olduğun birileri varsa engelleyebilirsin, bir daha asla karşılaşmazsın.
                </p>
                <p className="text-xs text-[#ff6b6b] mb-5">Bu engelleme işlemi geri alınamaz.</p>
                <div className="flex flex-wrap gap-4 justify-center">
                  {participants.map((p) => {
                    const blocked = blockedIds.has(p.userId);
                    const color = genderColor(p.gender);
                    return (
                      <motion.button
                        key={p.userId}
                        type="button"
                        onClick={() => toggleIn(setBlockedIds, p.userId)}
                        whileTap={{ scale: 0.92 }}
                        aria-pressed={blocked}
                        aria-label={`${p.initials} ${blocked ? 'engellemeyi kaldır' : 'engelle'}`}
                        className="flex flex-col items-center gap-1.5"
                      >
                        <motion.div
                          animate={{ opacity: blocked ? 0.28 : 1, filter: blocked ? 'grayscale(1)' : 'grayscale(0)' }}
                          transition={{ duration: 0.25 }}
                          className="flex items-center justify-center"
                          style={{
                            width: 58, height: 58, borderRadius: '50%',
                            border: `2.5px solid ${color}`,
                            background: `${color}1f`,
                            boxShadow: blocked ? 'none' : `0 0 10px ${color}55`,
                            fontSize: 13, fontWeight: 700, color: '#f0f0f0', letterSpacing: '0.02em',
                          }}
                        >
                          {p.initials}
                        </motion.div>
                        <span className="text-[10px] h-3" style={{ color: blocked ? '#ff6b6b' : 'transparent' }}>Engellendi</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Masaya katılmayan */}
            {participants.length > 0 && (
              <motion.div {...fadeUp(0.3)} className="glass-card p-5">
                <p className="text-sm text-[#888] mb-1 font-medium">Masaya katılmayan biri oldu mu?</p>
                <p className="text-xs text-[#555] mb-4">Masaya gelmeyen kişileri işaretle. Bildirimin yönetim ekibine iletilir ve geri alınamaz.</p>
                <div className="flex flex-col gap-2">
                  {participants.map((p) => (
                    <label
                      key={p.userId}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors"
                      style={{
                        background: noShowIds.has(p.userId) ? 'rgba(192,57,43,0.08)' : 'rgba(255,255,255,0.07)',
                        border: `1px solid ${noShowIds.has(p.userId) ? 'rgba(192,57,43,0.3)' : 'rgba(255,255,255,0.12)'}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={noShowIds.has(p.userId)}
                        disabled={lockedNoShow.has(p.userId)}
                        onChange={() => toggleIn(setNoShowIds, p.userId)}
                        className="w-4 h-4 accent-[#c0392b] cursor-pointer"
                      />
                      <span className="text-sm text-[#ccc] font-medium">{p.initials}</span>
                      {p.gender && (
                        <span className="text-xs text-[#555]">{p.gender === 'MALE' ? 'E' : p.gender === 'FEMALE' ? 'K' : ''}</span>
                      )}
                      {lockedNoShow.has(p.userId) && <span className="ml-auto text-xs text-[#c0392b]">Bildirildi</span>}
                    </label>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Beklenti */}
            <motion.div {...fadeUp(0.4)} className="glass-card p-5">
              <p className="text-sm text-[#888] mb-3 font-medium">Masa beklentilerini karşıladı mı?</p>
              <textarea
                value={comment}
                onChange={(e) => { setComment(e.target.value.slice(0, COMMENT_MAX)); setError(''); }}
                placeholder="Masa, mekan ve sohbet beklentilerini ne kadar karşıladı? Düşüncelerini yaz…"
                rows={4}
                maxLength={COMMENT_MAX}
                className="input-glass w-full px-4 py-3 text-sm resize-none"
              />
              <p className="text-right text-xs mt-1" style={{ color: commentLen > 0 && commentLen < COMMENT_MIN ? '#ff6b6b' : '#444' }}>
                {commentLen < COMMENT_MIN ? `En az ${COMMENT_MIN} karakter · ` : ''}{comment.length}/{COMMENT_MAX}
              </p>
            </motion.div>

            {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}

            {/* Gönder */}
            <motion.div {...fadeUp(0.5)}>
              <p className="text-xs text-[#555] text-center mb-3">Değerlendirme bir kez gönderilir, sonradan düzenlenemez.</p>
              <button
                onClick={handleSubmit}
                disabled={submitting || rating === 0 || commentLen < COMMENT_MIN}
                className="w-full btn-primary disabled:opacity-50"
              >
                {submitting ? 'Gönderiliyor…' : 'Değerlendirmeyi Gönder'}
              </button>
            </motion.div>

          </div>
        )}
      </div>

      {/* Engelleme onayı */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Engellemeyi onayla">
        <p className="text-sm text-[#ccc] leading-relaxed mb-2">
          <strong className="text-[#ff6b6b]">{initialsOf(blocksToSend)}</strong> engellenecek.
        </p>
        <p className="text-sm text-[#888] leading-relaxed mb-6">
          Bu işlem geri alınamaz. Engellediğin kişilerle bir daha aynı masada eşleşmezsin.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmOpen(false)} className="flex-1 btn-ghost justify-center">Vazgeç</button>
          <button onClick={send} className="flex-1 btn-primary justify-center">Onayla ve Gönder</button>
        </div>
      </Modal>
    </div>
  );
}
