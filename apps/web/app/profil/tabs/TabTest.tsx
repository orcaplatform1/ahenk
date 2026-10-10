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
      <div className="glass-card p-8 flex flex-col items-center gap-4 text-center">
        <p className="text-[#888] text-sm">Henüz kişilik testini yapmadın.</p>
        <Link href="/test" className="px-6 py-3 text-sm btn-grad">
          Teste Başla →
        </Link>
      </div>
    );
  }

  if (!score) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="glass-card p-5">
        <h3 className="font-medium text-sm text-[#888] uppercase tracking-wide mb-5">OCEAN Skorum</h3>
        <div className="flex flex-col gap-5">
          {DIMENSIONS.map(({ key, label }) => {
            const val = score[key] as number;
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-[#f5f5f5]">{label}</span>
                  <span className="text-sm font-semibold" style={{ background: 'linear-gradient(135deg,#c0392b,#ff6b6b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{Math.round(val)}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full progress-grad rounded-full transition-all duration-500"
                    style={{ width: `${val}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-card p-5 flex flex-col gap-2">
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
