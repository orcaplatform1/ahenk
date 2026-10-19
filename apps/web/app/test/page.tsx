'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

interface Question {
  id: string;
  text: string;
  orderNum: number;
  section: number;
  sectionTitle: string;
}

interface QuestionsResponse {
  totalQuestions: number;
  sections: { section: number; title: string; questions: Question[] }[];
}

const LIKERT = [
  { v: 1, label: 'Hiç katılmıyorum' },
  { v: 2, label: 'Katılmıyorum' },
  { v: 3, label: 'Kararsızım' },
  { v: 4, label: 'Katılıyorum' },
  { v: 5, label: 'Tamamen katılıyorum' },
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

    api.get<QuestionsResponse>('/test/questions')
      .then((res) => {
        const flat = res.sections.flatMap(s => s.questions);
        setQuestions(flat);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const q = questions[current];
  const total = questions.length;
  const progress = total > 0 ? (Object.keys(answers).length / total) * 100 : 0;
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
        answers: questions.map(q => ({ questionId: q.id, score: answers[q.id] ?? 3 })),
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }, [questions, answers]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#c0392b] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-sm w-full text-center"
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
            className="mx-auto mb-8 w-24 h-24 flex items-center justify-center rounded-full relative"
            style={{ background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)' }}
          >
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

          <button onClick={() => router.push('/test/sonuc')} className="w-full btn-primary justify-center mb-3">
            Profilimi Gör
          </button>
          <button onClick={() => router.push('/dashboard')} className="w-full btn-ghost justify-center">
            Dashboard'a Dön
          </button>
        </motion.div>
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-[#ff6b6b] mb-4">{error}</p>
          <button onClick={() => router.push('/dashboard')} className="text-sm text-[#888]">← Dashboard</button>
        </div>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col">
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '20%', right: '-5%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.1) 0%, transparent 65%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '-5%', width: '35vw', height: '35vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,57,43,0.07) 0%, transparent 65%)', filter: 'blur(40px)' }} />
      </div>

      <div className="relative flex flex-col flex-1 max-w-xl mx-auto w-full px-5 py-8" style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold tracking-[0.18em] text-[#888] uppercase">
            BÖLÜM {String(q.section).padStart(2, '0')} — {q.sectionTitle}
          </span>
          <span className="text-xs font-mono text-[#888]">{current + 1} / {total}</span>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full mb-6 overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #c0392b 0%, #ff6b6b 100%)', boxShadow: '0 0 8px rgba(192,57,43,0.6)' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Soru kartı */}
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
            className="flex flex-col gap-4"
          >
            {/* Soru metni */}
            <div className="glass-card p-6">
              <p className="text-xs text-[#555] mb-3 font-mono">Soru {current + 1}</p>
              <p className="font-serif text-2xl sm:text-3xl text-[#f5f5f5] leading-snug">{q.text}</p>
            </div>

            {/* Likert seçenekleri */}
            <div className="flex flex-col gap-2">
              {LIKERT.map(({ v, label }) => {
                const selected = answers[q.id] === v;
                return (
                  <motion.button
                    key={v}
                    type="button"
                    onClick={() => pickAnswer(v)}
                    whileTap={{ scale: 0.99 }}
                    className="w-full px-5 py-4 rounded-xl text-left text-sm transition-all duration-200"
                    style={selected ? {
                      background: 'rgba(192,57,43,0.12)',
                      border: '1px solid rgba(192,57,43,0.55)',
                      color: '#ff6b6b',
                      boxShadow: '0 0 14px rgba(192,57,43,0.18)',
                    } : {
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#888',
                    }}
                  >
                    {label}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Alt butonlar */}
        <div className="flex items-center justify-between mt-6 gap-3">
          <button onClick={goPrev} disabled={current === 0} className="btn-ghost disabled:opacity-30">
            Geri
          </button>

          <button onClick={goNext} disabled={!hasAnswer || submitting} className="flex-1 btn-primary justify-center disabled:opacity-30">
            {submitting ? '…' : isLast ? 'Testi Bitir' : 'İleri'}
          </button>
        </div>

        {error && <p className="text-[#ff6b6b] text-xs text-center mt-4">{error}</p>}
      </div>
    </div>
  );
}
