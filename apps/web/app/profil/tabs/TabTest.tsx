'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import Link from 'next/link';

interface OceanScore {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  completedAt: string;
  nextTestAt: string;
}

const DIMENSIONS: { key: keyof OceanScore; label: string }[] = [
  { key: 'openness',          label: 'Açıklık' },
  { key: 'conscientiousness', label: 'Öz-Disiplin' },
  { key: 'extraversion',      label: 'Dışadönüklük' },
  { key: 'agreeableness',     label: 'Uyumluluk' },
  { key: 'neuroticism',       label: 'Nevrotiklik' },
];

export function TabTest() {
  const [score, setScore] = useState<OceanScore | null>(null);
  const [noTest, setNoTest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<OceanScore>('/test/result')
      .then(setScore)
      .catch((e: Error) => {
        if (e.message.includes('404') || e.message.toLowerCase().includes('bulunamadı') || e.message.toLowerCase().includes('tamamlanmamış')) {
          setNoTest(true);
        } else {
          setError(e.message);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonBlock lines={6} />;
  if (error) return <p className="text-accent text-sm">{error}</p>;

  if (noTest) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
        <p className="text-muted text-sm">Henüz kişilik testini yapmadın.</p>
        <Link
          href="/test"
          className="px-6 py-3 bg-primary hover:bg-primary-hover rounded-xl text-sm font-medium transition-colors"
        >
          Teste Başla →
        </Link>
      </div>
    );
  }

  if (!score) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h3 className="font-medium text-sm text-muted uppercase tracking-wide mb-5">OCEAN Skorum</h3>
        <div className="flex flex-col gap-5">
          {DIMENSIONS.map(({ key, label }) => {
            const val = score[key] as number;
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-text">{label}</span>
                  <span className="text-sm font-semibold text-primary">{Math.round(val)}</span>
                </div>
                <div className="h-2 bg-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${val}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Test Tarihi</span>
          <span className="text-sm text-text">{new Date(score.completedAt).toLocaleDateString('tr-TR')}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Sonraki Test</span>
          <span className="text-sm text-text">{new Date(score.nextTestAt).toLocaleDateString('tr-TR')}</span>
        </div>
      </div>
    </div>
  );
}
