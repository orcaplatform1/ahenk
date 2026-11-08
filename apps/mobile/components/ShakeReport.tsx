// Salla-Bildir: giriş yapmış üye telefonu sallayınca Sorun Bildir penceresi açılır (ekran görüntüsü eklenmez; görseller yalnız galeriden).
// Gönderim web Sorun Bildir ile aynı uç (POST /problem-reports); admin Sorun Bildirimleri'ne düşer.
import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { getShakeEnabled, onShakePref } from '@/lib/shakePref';
import { ProblemReport, isProblemReportOpen } from './profil/ProblemReport';

const THRESHOLD = 2.2; // g
const COOLDOWN_MS = 2000;

export function ShakeReport() {
  const path = usePathname();
  const [enabled, setEnabled] = useState(true);
  const [open, setOpen] = useState(false);
  const last = useRef(0);
  const openRef = useRef(false);
  openRef.current = open;

  useEffect(() => { getShakeEnabled().then(setEnabled); return onShakePref(setEnabled); }, []);

  useEffect(() => {
    if (!enabled) return;
    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const g = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (g < THRESHOLD || openRef.current || isProblemReportOpen() || now - last.current < COOLDOWN_MS) return;
      last.current = now;
      setOpen(true);
    });
    return () => sub.remove();
  }, [enabled]);

  return <ProblemReport open={open} onClose={() => setOpen(false)} screen={`Salla-Bildir: ${path}`} />;
}
