'use client';

import { useEffect, useState } from 'react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

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

const UNITS = ['GÜN', 'SAAT', 'DAKİKA', 'SANİYE'] as const;

function CountdownRow({ label, targetDay }: { label: string; targetDay: number }) {
  const [time, setTime] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const update = () => setTime(calcTimeLeft(getNextTarget(targetDay)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDay]);

  const values = [time.days, time.hours, time.minutes, time.seconds];

  return (
    <div style={{ padding: '14px 16px' }}>
      <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>
        {label} kurulmasına kaldı
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
        {values.map((val, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44 }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 300, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.01em' }}>
                {pad(val)}
              </span>
              <span style={{ fontSize: 7, fontWeight: 500, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginTop: 4, textTransform: 'uppercase' }}>
                {UNITS[i]}
              </span>
            </div>
            {i < values.length - 1 && (
              <div style={{ width: 1, height: 24, background: 'rgba(192,57,43,0.3)', margin: '4px 5px 0', flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroCountdown() {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.45)',
      border: '1px solid rgba(192,57,43,0.25)',
      borderRadius: 10,
      overflow: 'hidden',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
    }}>
      <CountdownRow label="Grup Masası" targetDay={4} />
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '0 16px' }} />
      <CountdownRow label="Baş Başa Masa" targetDay={5} />
    </div>
  );
}
