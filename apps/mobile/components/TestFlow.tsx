// OCEAN testi soru akışı (apps/web/app/kayit adım 3 ve apps/web/app/test/page.tsx ile aynı görünüm)
import React from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Btn, BtnGhost, BtnPrimary, Eyebrow, Mono, Serif, T } from './ui';
import { ll, tw } from '@/theme/theme';
import { useTranslation } from 'react-i18next';
import { currentLang } from '@/lib/i18n';

export interface Question { id: string; text: string; textEn?: string | null; section?: number; sectionTitle?: string; sectionTitleEn?: string | null }
export const LIKERT = [
  { v: 1, label: 'test.likert1' }, { v: 2, label: 'test.likert2' }, { v: 3, label: 'test.likert3' }, { v: 4, label: 'test.likert4' }, { v: 5, label: 'test.likert5' },
];

export function TestFlow({ questions, current, answers, onPick, onPrev, onNext, submitting }: {
  questions: Question[]; current: number; answers: Record<string, number>; onPick: (v: number) => void; onPrev: () => void; onNext: () => void; submitting: boolean;
}) {
  const { t } = useTranslation();
  // İngilizce arayüzde soru ve bölüm başlığının İngilizcesi (OceanQuestion textEn / sectionTitleEn)
  const en = currentLang() === 'en';
  const q = questions[current];
  const total = questions.length;
  const progress = total > 0 ? (Object.keys(answers).length / total) * 100 : 0;
  const has = q ? answers[q.id] !== undefined : false;
  const last = current === total - 1;
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Eyebrow style={{ flex: 1 }}>{t('test.section', { n: String(q?.section ?? 1).padStart(2, '0') })}: {(en && q?.sectionTitleEn) || q?.sectionTitle || ''}</Eyebrow>
        <Mono style={{ fontSize: 11, color: ll.label }}>{current + 1} / {total}</Mono>
      </View>
      <View style={{ height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.10)', marginBottom: 8 }}>
        <LinearGradient colors={['#c0392b', '#ff6b6b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: '100%', width: `${progress}%`, borderRadius: 2 }} />
      </View>
      <View style={{ backgroundColor: 'rgba(192,57,43,0.08)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.25)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
        <T style={{ color: 'rgba(192,57,43,0.85)', fontSize: 11, lineHeight: 16.5 }}>{t('reg.testNote')}</T>
      </View>
      <View style={{ gap: 12 }}>
        <View style={{ borderRadius: 16, padding: 20, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
          <Mono style={{ fontSize: 11, color: ll.label, marginBottom: 8 }}>{t('test.question', { n: current + 1 })}</Mono>
          <Serif style={{ fontSize: 20, lineHeight: 27.5 }}>{(en && q?.textEn) || q?.text}</Serif>
        </View>
        <View style={{ gap: 8 }}>
          {LIKERT.map(({ v, label }) => {
            const sel = q ? answers[q.id] === v : false;
            return (
              <Btn key={v} variant="likertForm" selected={sel} label={t(label)} onPress={() => onPick(v)} />
            );
          })}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
        <BtnGhost label={t('reg.backArrow')} noUpper={false} disabled={current === 0} onPress={onPrev} />
        <BtnPrimary label={submitting ? '…' : last ? t('test.finish') : t('test.next')} style={{ flex: 1 }} disabled={!has || submitting} onPress={onNext} />
      </View>
    </View>
  );
}
