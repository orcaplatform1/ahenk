'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

interface Question {
  id: string;
  text: string;
  section?: number;
  sectionName?: string;
  trait?: string;
  reverse?: boolean;
}

const LIKERT = [
  { v: 1, label: 'Hiç\nkatılmıyorum' },
  { v: 2, label: 'Katılmıyorum' },
  { v: 3, label: 'Kararsızım' },
  { v: 4, label: 'Katılıyorum' },
  { v: 5, label: 'Tamamen\nkatılıyorum' },
];

export default function TestPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = api.getToken();
    if (!t) { router.replace('/giris'); return; }

    api.get<Question[]>('/test/questions')
      .then(setQuestions)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const q = questions[current];
  const total = questions.length;
  const progress = total > 0 ? ((Object.keys(answers).length) / total) * 100 : 0;
  const hasAnswer = q ? answers[q.id] !== undefined : false;
  const isLast = current === total - 1;

  function pickAnswer(val: number) {
    if (!q) return;
    setAnswers(prev => ({ ...prev, [q.id]: val }));
  }

  function goNext() {
    if (!hasAnswer) return;
    if (isLast) { submitTest(); return; }
    setDirection(1);
    setCurrent(c => c + 1);
  }

  function goPrev() {
    if (current === 0) return;
    setDirection(-1);
    setCurrent(c => c - 1);
  }

  const submitTest = useCallback(async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/test/submit', {
        answers: questions.map(q => ({ questionId: q.id, value: answers[q.id] ?? 3 })),
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }, [questions, answers]);

  /* ── Yüklenme ──────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#c0392b] border-t-transparent animate-spin" />
      </div>
    );
  }

  /* ── Tamamlandı — 180 gün kilit ───────────────────────────────── */
  if (done) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-sm w-full text-center"
        >
          {/* Kilit animasyonu */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
            className="mx-auto mb-8 w-24 h-24 flex items-center justify-center rounded-full relative"
            style={{ background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)' }}
          >
            {/* Dış halka */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: '2px solid rgba(192,57,43,0.5)' }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10" style={{ color: '#c0392b' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} stroke="currentColor"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </motion.div>

          <h1 className="font-serif text-3xl text-[#f5f5f5] mb-3">Test Tamamlandı</h1>
          <p className="text-[#888] text-sm leading-relaxed mb-2">
            OCEAN profilin oluşturuldu. Algoritma artık seni doğru insanlarla eşleştirebilir.
          </p>
          <p className="text-xs font-mono tracking-widest text-[#555] mb-8">
            ⏱ Sonraki test: 180 gün sonra
          </p>

          <button
            onClick={() => router.push('/test/sonuc')}
            className="w-full py-4 rounded-2xl text-sm font-medium text-white mb-3"
            style={{ background: 'linear-gradient(135deg,#c0392b,#ff6b6b)', boxShadow: '0 0 24px rgba(192,57,43,0.4)' }}
          >
            Profilimi Gör →
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 rounded-2xl text-sm text-[#888] hover:text-[#f5f5f5] transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            Dashboard'a Dön
          </button>
        </motion.div>
      </div>
    );
  }

  /* ── Hata ──────────────────────────────────────────────────────── */
  if (error && questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-[#ff6b6b] mb-4">{error}</p>
          <button onClick={() => router.push('/dashboard')} className="text-sm text-[#888]">← Dashboard</button>
        </div>
      </div>
    );
  }

  if (!q) return null;

  const sectionNum = q.section ?? 1;
  const sectionName = q.sectionName ?? 'KİŞİLİK TESTİ';
  const traitLabel = q.trait ?? '';

  /* ── Test UI ───────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Arka plan glow */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '20%', right: '-5%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.1) 0%, transparent 65%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '-5%', width: '35vw', height: '35vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.07) 0%, transparent 65%)', filter: 'blur(40px)' }} />
      </div>

      <div className="relative flex flex-col flex-1 max-w-xl mx-auto w-full px-5 py-8" style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold tracking-[0.18em] text-[#888] uppercase">
            BÖLÜM {String(sectionNum).padStart(2, '0')} — {sectionName}
          </span>
          <span className="text-xs font-mono text-[#888]">{current + 1} / {total}</span>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full mb-5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #c0392b 0%, #ff6b6b 100%)', boxShadow: '0 0 8px rgba(192,57,43,0.6)' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Trait label */}
        {traitLabel && (
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#c0392b', boxShadow: '0 0 6px rgba(192,57,43,0.8)' }} />
            <span className="text-xs font-semibold tracking-[0.16em] text-[#c0392b] uppercase">{traitLabel}</span>
          </div>
        )}

        {/* Soru kartı — AnimatePresence */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: d * 50, opacity: 0, filter: 'blur(4px)' }),
              center: { x: 0, opacity: 1, filter: 'blur(0px)' },
              exit: (d: number) => ({ x: d * -50, opacity: 0, filter: 'blur(4px)' }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="flex flex-col gap-5"
          >
            {/* Soru metni */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: 'rgba(255,60,40,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(20px)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              <p className="text-xs text-[#555] mb-3 font-mono">Soru {current + 1}</p>
              <p className="font-serif text-2xl sm:text-3xl text-[#f5f5f5] leading-snug">{q.text}</p>
            </div>

            {/* Likert scale */}
            <div className="flex flex-col gap-2">
              {LIKERT.map(({ v, label }) => {
                const selected = answers[q.id] === v;
                return (
                  <motion.button
                    key={v}
                    type="button"
                    onClick={() => pickAnswer(v)}
                    whileTap={{ scale: 0.98 }}
                    className="w-full px-5 py-4 rounded-xl text-left text-sm font-medium transition-all duration-200 flex items-center gap-4"
                    style={selected ? {
                      background: 'rgba(192,57,43,0.14)',
                      border: '1px solid rgba(192,57,43,0.6)',
                      color: '#ff6b6b',
                      boxShadow: '0 0 18px rgba(192,57,43,0.25)',
                    } : {
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#aaa',
                    }}
                  >
                    {/* Circle */}
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200"
                      style={selected ? {
                        background: 'linear-gradient(135deg,#c0392b,#ff6b6b)',
                        boxShadow: '0 0 12px rgba(192,57,43,0.6)',
                        color: '#fff',
                      } : {
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#555',
                        background: 'transparent',
                      }}
                    >
                      {v}
                    </div>
                    <span className="whitespace-pre-line leading-tight">{label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Alt butonlar */}
        <div className="flex items-center justify-between mt-6 gap-3">
          <button
            onClick={goPrev}
            disabled={current === 0}
            className="px-6 py-3 rounded-xl text-sm text-[#888] hover:text-[#f5f5f5] transition-colors disabled:opacity-30"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            ← Geri
          </button>

          <button
            onClick={goNext}
            disabled={!hasAnswer || submitting}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-white transition-all duration-200 disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg,#c0392b,#ff6b6b)', boxShadow: hasAnswer ? '0 0 20px rgba(192,57,43,0.4)' : 'none' }}
          >
            {submitting ? '…' : isLast ? 'Testi Bitir' : 'İleri →'}
          </button>
        </div>

        {error && <p className="text-[#ff6b6b] text-xs text-center mt-4">{error}</p>}
      </div>
    </div>
  );
}
