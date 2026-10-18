'use client';

import { useEffect, useState } from 'react';

type Mode = 'grup' | 'basbasa';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// Perşembe=4, Cuma=5 (JS getDay: 0=Paz...6=Cmt)
function getNextTarget(targetDay: number): Date {
  const trOffset = 3 * 60 * 60 * 1000;
  const now = new Date();
  const nowTR = new Date(now.getTime() + trOffset);
  const todayTR = nowTR.getUTCDay();
  let daysUntil = (targetDay - todayTR + 7) % 7;
  const targetTR = new Date(nowTR);
  targetTR.setUTCDate(nowTR.getUTCDate() + daysUntil);
  targetTR.setUTCHours(23, 59, 0, 0);
  const targetUTC = new Date(targetTR.getTime() - trOffset);
  if (targetUTC.getTime() <= now.getTime()) {
    targetUTC.setDate(targetUTC.getDate() + 7);
  }
  return targetUTC;
}

function calcTimeLeft(target: Date): TimeLeft {
  const diff = Math.max(0, target.getTime() - Date.now());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

const CONTENT = {
  grup: {
    tagline: 'Kaliteli insanlarla aynı masada oturmak tesadüf değil.',
    label: 'Grup Masası kurulmasına',
    targetDay: 4,
  },
  basbasa: {
    tagline: 'Bazı akşamlar takvimde kalır, bazıları hafızanda.',
    label: 'Baş Başa Masa kurulmasına',
    targetDay: 5,
  },
};

export function HeroCountdown() {
  const [mode, setMode] = useState<Mode>('grup');
  const [visible, setVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const content = CONTENT[mode];
    const target = getNextTarget(content.targetDay);
    setTimeLeft(calcTimeLeft(target));

    const interval = setInterval(() => {
      const t = getNextTarget(content.targetDay);
      setTimeLeft(calcTimeLeft(t));
    }, 1000);

    return () => clearInterval(interval);
  }, [mode]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setVisible(false);
    setTimeout(() => {
      setMode(next);
      setVisible(true);
    }, 220);
  }

  const units = [
    { value: timeLeft.days, label: 'GÜN' },
    { value: timeLeft.hours, label: 'SAAT' },
    { value: timeLeft.minutes, label: 'DAKİKA' },
    { value: timeLeft.seconds, label: 'SANİYE' },
  ];

  return (
    <div style={{ background: 'transparent' }}>
      {/* Toggle */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
        {(['grup', 'basbasa'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: mode === m ? '#c0392b' : 'rgba(245,245,245,0.3)',
              transition: 'color 0.2s',
            }}
          >
            {m === 'grup' ? 'Grup Masası' : 'Baş Başa'}
          </button>
        ))}
      </div>

      {/* Tagline + sayaç */}
      <div
        style={{
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.22s ease',
        }}
      >
        <p style={{ fontSize: 12, color: 'rgba(245,245,245,0.45)', marginBottom: 12, lineHeight: 1.5 }}>
          {CONTENT[mode].tagline}
        </p>

        <p style={{ fontSize: 10, color: 'rgba(245,245,245,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          {CONTENT[mode].label} kaldı
        </p>

        {/* Sayaç */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
          {units.map((unit, i) => (
            <div key={unit.label} style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 48 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-serif, Georgia, serif)',
                    fontSize: 36,
                    fontWeight: 300,
                    color: '#c0392b',
                    lineHeight: 1,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {pad(unit.value)}
                </span>
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 500,
                    letterSpacing: '0.12em',
                    color: 'rgba(245,245,245,0.25)',
                    marginTop: 4,
                    textTransform: 'uppercase',
                  }}
                >
                  {unit.label}
                </span>
              </div>
              {i < units.length - 1 && (
                <div
                  style={{
                    width: 1,
                    height: 28,
                    background: 'rgba(192,57,43,0.25)',
                    margin: '4px 6px 0',
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
