// Salla-Bildir: giriş yapmış üye telefonu sallayınca Sorun Bildir penceresi açılır; sallandığı anki ekran görüntüsü otomatik eklenir
// (en fazla 3 görsel sınırına dahil). Ek görseller galeriden eklenebilir.
// Gönderim web Sorun Bildir ile aynı uç (POST /problem-reports); admin Sorun Bildirimleri'ne düşer.
import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { captureScreen } from 'react-native-view-shot';
import type { PickedImage } from '@/lib/imagePick';
import { getShakeEnabled, onShakePref } from '@/lib/shakePref';
import { ProblemReport } from './profil/ProblemReport';

const THRESHOLD = 2.2; // g
const COOLDOWN_MS = 2000;

export function ShakeReport() {
  const path = usePathname();
  const [enabled, setEnabled] = useState(true);
  const [open, setOpen] = useState(false);
  const [shot, setShot] = useState<PickedImage | null>(null);
  const last = useRef(0);
  const openRef = useRef(false);
  openRef.current = open;

  useEffect(() => { getShakeEnabled().then(setEnabled); return onShakePref(setEnabled); }, []);

  useEffect(() => {
    if (!enabled) return;
    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(async ({ x, y, z }) => {
      const g = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (g < THRESHOLD || openRef.current || now - last.current < COOLDOWN_MS) return;
      last.current = now;
      let img: PickedImage | null = null;
      try {
        const uri = await captureScreen({ format: 'jpg', quality: 0.8 });
        img = { uri, name: `ekran-${now}.jpg`, type: 'image/jpeg' };
      } catch { img = null; }
      setShot(img);
      setOpen(true);
    });
    return () => sub.remove();
  }, [enabled]);

  return <ProblemReport open={open} onClose={() => { setOpen(false); setShot(null); }} screen={`Salla-Bildir: ${path}`} initialImage={shot} />;
}
