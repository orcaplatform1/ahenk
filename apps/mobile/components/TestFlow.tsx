// OCEAN testi soru akışı (apps/web/app/kayit adım 3 ve apps/web/app/test/page.tsx ile aynı görünüm)
import React from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Btn, BtnGhost, BtnPrimary, Eyebrow, Mono, Serif, T } from './ui';
import { ll, tw } from '@/theme/theme';

export interface Question { id: string; text: string; section?: number; sectionTitle?: string }
export const LIKERT = [
  { v: 1, label: 'Hiç katılmıyorum' }, { v: 2, label: 'Katılmıyorum' }, { v: 3, label: 'Kararsızım' }, { v: 4, label: 'Katılıyorum' }, { v: 5, label: 'Tamamen katılıyorum' },
];

export function TestFlow({ questions, current, answers, onPick, onPrev, onNext, submitting }: {
  questions: Question[]; current: number; answers: Record<string, number>; onPick: (v: number) => void; onPrev: () => void; onNext: () => void; submitting: boolean;
}) {
  const q = questions[current];
  const total = questions.length;
  const progress = total > 0 ? (Object.keys(answers).length / total) * 100 : 0;
  const has = q ? answers[q.id] !== undefined : false;
  const last = current === total - 1;
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Eyebrow style={{ flex: 1 }}>BÖLÜM {String(q?.section ?? 1).padStart(2, '0')}: {q?.sectionTitle ?? ''}</Eyebrow>
        <Mono style={{ fontSize: 11, color: ll.label }}>{current + 1} / {total}</Mono>
      </View>
      <View style={{ height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.10)', marginBottom: 8 }}>
        <LinearGradient colors={['#c0392b', '#ff6b6b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: '100%', width: `${progress}%`, borderRadius: 2 }} />
      </View>
      <View style={{ backgroundColor: 'rgba(192,57,43,0.08)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.25)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
        <T style={{ color: 'rgba(192,57,43,0.85)', fontSize: 11, lineHeight: 16.5 }}>Bu test, size en uygun kişilerle eşleştirmek için kullanılır. Lütfen gerçek yanıtlarınızı seçin. Yeni test 6 ay boyunca tekrar yapılamaz.</T>
      </View>
      <View style={{ gap: 12 }}>
        <View style={{ borderRadius: 16, padding: 20, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
          <Mono style={{ fontSize: 11, color: ll.label, marginBottom: 8 }}>SORU {current + 1}</Mono>
          <Serif style={{ fontSize: 20, lineHeight: 27.5 }}>{q?.text}</Serif>
        </View>
        <View style={{ gap: 8 }}>
          {LIKERT.map(({ v, label }) => {
            const sel = q ? answers[q.id] === v : false;
            return (
              <Btn key={v} variant="likertForm" selected={sel} label={label} onPress={() => onPick(v)} />
            );
          })}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
        <BtnGhost label="← Geri" noUpper={false} disabled={current === 0} onPress={onPrev} />
        <BtnPrimary label={submitting ? '…' : last ? 'Testi Bitir' : 'İleri →'} style={{ flex: 1 }} disabled={!has || submitting} onPress={onNext} />
      </View>
    </View>
  );
}
