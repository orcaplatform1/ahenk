// Salla-Bildir: giriş yapmış üye telefonu sallayınca Sorun Bildir penceresi açılır (ekran görüntüsü eklenmez; görseller yalnız galeriden).
// Gönderim web Sorun Bildir ile aynı uç (POST /problem-reports); admin Sorun Bildirimleri'ne düşer.
import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { getShakeEnabled, onShakePref } from '@/lib/shakePref';
import { ProblemReport, isProblemReportOpen } from './profil/ProblemReport';

// Hassasiyet düşürüldü: 2.2 g → 2.7 g (eğme ~1 g, tek sert hareket yetmez)
const THRESHOLD = 2.7; // g
const COOLDOWN_MS = 2000;
// Pencere yalnız art arda 2 sallamada açılır: iki sallama tepesi arası en az 250 ms, en fazla 1500 ms
const SHAKE_GAP_MIN_MS = 250;
const SHAKE_GAP_MAX_MS = 1500;

export function ShakeReport() {
  const path = usePathname();
  const [enabled, setEnabled] = useState(true);
  const [open, setOpen] = useState(false);
  const last = useRef(0);
  const firstShake = useRef(0);
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
      const gap = now - firstShake.current;
      if (gap < SHAKE_GAP_MIN_MS) return; // aynı sallamanın devam eden okumaları
      if (gap > SHAKE_GAP_MAX_MS) { firstShake.current = now; return; } // 1. sallama
      firstShake.current = 0;
      last.current = now;
      setOpen(true);
    });
    return () => sub.remove();
  }, [enabled]);

  return <ProblemReport open={open} onClose={() => setOpen(false)} screen={`Salla-Bildir: ${path}`} />;
}
