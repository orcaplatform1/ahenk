'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Sabit sorular ────────────────────────────────────────────────────────────
// Backend'den GET /test/questions ile de çekilebilir; şimdilik sabit.
export interface OceanQuestion {
  id: string;
  text: string;
  section: number;
  sectionTitle: string;
}

const QUESTIONS: OceanQuestion[] = [
  { id: 'q1',  section: 1, sectionTitle: 'Açıklık',        text: 'Yeni fikirlere ve deneyimlere açık olduğumu düşünüyorum.' },
  { id: 'q2',  section: 1, sectionTitle: 'Açıklık',        text: 'Sanat, müzik veya edebiyat beni derinden etkiler.' },
  { id: 'q3',  section: 1, sectionTitle: 'Açıklık',        text: 'Alışılmışın dışındaki fikir ve görüşleri keşfetmeyi severim.' },
  { id: 'q4',  section: 1, sectionTitle: 'Açıklık',        text: 'Rutin işler beni sıkar; çeşitlilik beni canlandırır.' },
  { id: 'q5',  section: 2, sectionTitle: 'Öz-Disiplin',    text: 'Görevlerimi zamanında tamamlarım.' },
  { id: 'q6',  section: 2, sectionTitle: 'Öz-Disiplin',    text: 'Düzenli ve planlı bir yaşam tarzı benimserim.' },
  { id: 'q7',  section: 2, sectionTitle: 'Öz-Disiplin',    text: 'Uzun vadeli hedefler için anlık zevklerden vazgeçebilirim.' },
  { id: 'q8',  section: 2, sectionTitle: 'Öz-Disiplin',    text: 'Başladığım işleri yarıda bırakmam.' },
  { id: 'q9',  section: 3, sectionTitle: 'Dışadönüklük',   text: 'Büyük sosyal ortamlarda kendimi enerjik hissederim.' },
  { id: 'q10', section: 3, sectionTitle: 'Dışadönüklük',   text: 'Yeni insanlarla tanışmak beni heyecanlandırır.' },
  { id: 'q11', section: 3, sectionTitle: 'Dışadönüklük',   text: 'Grup aktivitelerine katılmaktan keyif alırım.' },
  { id: 'q12', section: 3, sectionTitle: 'Dışadönüklük',   text: 'Yalnız kalmak yerine çevremde insanlar olmasını tercih ederim.' },
  { id: 'q13', section: 4, sectionTitle: 'Uyumluluk',      text: 'Başkalarının bakış açısını anlamaya çalışırım.' },
  { id: 'q14', section: 4, sectionTitle: 'Uyumluluk',      text: 'İnsanlara yardım etmek içimden gelir.' },
  { id: 'q15', section: 4, sectionTitle: 'Uyumluluk',      text: 'Çatışmadan kaçınır, uzlaşma yolları ararım.' },
  { id: 'q16', section: 4, sectionTitle: 'Uyumluluk',      text: 'Başkalarının duygularına karşı hassasımdır.' },
  { id: 'q17', section: 5, sectionTitle: 'Nevrotiklik',    text: 'Stresli durumlarda kaygılanma eğilimim yüksektir.' },
  { id: 'q18', section: 5, sectionTitle: 'Nevrotiklik',    text: 'Ruh halim sık sık değişir.' },
  { id: 'q19', section: 5, sectionTitle: 'Nevrotiklik',    text: 'Küçük aksaklıklar bile beni rahatsız eder.' },
];

const LIKERT = [
  { value: 1, label: 'Hiç\nkatılmıyorum' },
  { value: 2, label: 'Katılmıyorum' },
  { value: 3, label: 'Kararsızım' },
  { value: 4, label: 'Katılıyorum' },
  { value: 5, label: 'Tamamen\nkatılıyorum' },
];

interface Props {
  onComplete?: (answers: { questionId: string; score: number }[]) => void;
  onSubmitError?: (msg: string) => void;
  apiBase?: string;
  token?: string;
}

export function OceanTest({ onComplete, onSubmitError, apiBase = '', token }: Props) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [locked, setLocked] = useState(false);

  const q = QUESTIONS[current];
  const progress = (current / QUESTIONS.length) * 100;
  const selectedScore = answers[q.id];

  async function handleSelect(score: number) {
    const next = { ...answers, [q.id]: score };
    setAnswers(next);

    if (current < QUESTIONS.length - 1) {
      setDirection(1);
      setTimeout(() => setCurrent((c) => c + 1), 180);
    } else {
      setSubmitting(true);
      try {
        const payload = QUESTIONS.map((qq) => ({ questionId: qq.id, score: next[qq.id] ?? 3 }));
        const res = await fetch(`${apiBase}/api/v1/test/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ answers: payload }),
        });
        if (res.status === 409) { setLocked(true); return; }
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Bir hata oluştu' }));
          onSubmitError?.((err as { message?: string }).message ?? 'Bir hata oluştu');
          return;
        }
        setDone(true);
        onComplete?.(payload);
      } catch {
        onSubmitError?.('Bağlantı hatası');
      } finally {
        setSubmitting(false);
      }
    }
  }

  function handleBack() {
    if (current === 0) return;
    setDirection(-1);
    setCurrent((c) => c - 1);
  }

  // ─── 180 gün kilitli ──────────────────────────────────────────────────────
  if (locked) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center text-2xl">🔒</div>
        <h2 className="font-serif text-2xl text-text">Test Kilitli</h2>
        <p className="text-muted text-sm max-w-xs">Testi zaten tamamladın. Bir sonraki test 180 gün sonra açılacak.</p>
      </div>
    );
  }

  // ─── Tamamlandı ───────────────────────────────────────────────────────────
  if (done) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-2xl">✓</div>
        <h2 className="font-serif text-2xl text-text">Test Tamamlandı</h2>
        <p className="text-muted text-sm max-w-xs">OCEAN skorun hesaplandı. Profilinde sonuçlarını görebilirsin.</p>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-lg mx-auto px-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #c0392b, #b5651d)' }}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <span className="text-xs text-muted tabular-nums">{current + 1}/{QUESTIONS.length}</span>
      </div>

      {/* Section label */}
      <p className="text-xs text-muted uppercase tracking-wider">{q.sectionTitle}</p>

      {/* Kart */}
      <div className="relative overflow-hidden" style={{ minHeight: 140 }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={q.id}
            custom={direction}
            initial={{ x: direction * 50, opacity: 0, filter: 'blur(6px)' }}
            animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ x: direction * -50, opacity: 0, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-surface border border-border rounded-2xl p-7"
          >
            <p className="font-serif text-xl text-text leading-snug">{q.text}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Likert */}
      <div className="flex justify-between gap-2">
        {LIKERT.map(({ value, label }) => {
          const active = selectedScore === value;
          return (
            <button
              key={value}
              onClick={() => handleSelect(value)}
              disabled={submitting}
              className="flex flex-col items-center gap-2 flex-1 group"
            >
              <motion.div
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.95 }}
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center text-sm font-semibold transition-colors ${
                  active
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface text-muted group-hover:border-primary/60 group-hover:text-text'
                }`}
                style={active ? { boxShadow: '0 0 14px rgba(192,57,43,0.55)' } : {}}
              >
                {value}
              </motion.div>
              <span className="text-xs text-muted text-center leading-tight hidden sm:block whitespace-pre-line">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Geri */}
      {current > 0 && (
        <button onClick={handleBack} className="text-sm text-muted hover:text-text transition-colors self-start">
          ← Önceki
        </button>
      )}

      {submitting && <p className="text-sm text-muted text-center">Sonuçlar hesaplanıyor…</p>}
    </div>
  );
}
