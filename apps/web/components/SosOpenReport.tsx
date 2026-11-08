'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

const POLL_MS = 30_000;
const NOTICE_MS = 10_000; // Görsel uyarı 10 saniye görünür; konum gönderimi sürer
// Masa kartı (MasaDetayKarti) talep açınca ve burada talep kapanınca haberleşme olayları
const SOS_OPENED_EVENT = 'ahenk-sos-opened';
const SOS_CLOSED_EVENT = 'ahenk-sos-closed';

// Açık acil yardım talebi masa kartından bağımsızdır: kart kalksa da sayfa yenilense de ekranda kalır, canlı konum
// gönderilir. Admin sonuçlandırınca (reportId null ya da active:false) konum durur ve ekran kapanır.
export default function SosOpenReport() {
  const pathname = usePathname();
  const [reportId, setReportId] = useState<string | null>(null);
  const [noticeVisible, setNoticeVisible] = useState(false);

  // Talep açıldığında uyarı 10 saniye gösterilir, sonra yalnızca görsel uyarı gizlenir
  useEffect(() => {
    if (!reportId) { setNoticeVisible(false); return; }
    setNoticeVisible(true);
    const t = setTimeout(() => setNoticeVisible(false), NOTICE_MS);
    return () => clearTimeout(t);
  }, [reportId]);

  useEffect(() => {
    const sync = () => {
      if (!api.hasSession()) return;
      api.get<{ reportId: string | null }>('/sos/my-open-report').then((r) => setReportId(r.reportId)).catch(() => undefined);
    };
    sync();
    window.addEventListener(SOS_OPENED_EVENT, sync);
    return () => window.removeEventListener(SOS_OPENED_EVENT, sync);
  }, [pathname]);

  useEffect(() => {
    if (!reportId) return;
    const poll = setInterval(() => {
      api.get<{ reportId: string | null }>('/sos/my-open-report').then((r) => setReportId(r.reportId)).catch(() => undefined);
    }, POLL_MS);
    const watch = navigator.geolocation?.watchPosition(
      (pos) => {
        api.post<{ active: boolean }>(`/sos/reports/${reportId}/location`, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }).then((r) => { if (r.active === false) setReportId(null); }).catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => {
      clearInterval(poll);
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
      window.dispatchEvent(new Event(SOS_CLOSED_EVENT));
    };
  }, [reportId]);

  if (!reportId || !noticeVisible) return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 60, maxWidth: 480, margin: '0 auto',
        padding: '14px 16px', borderRadius: 12, textAlign: 'center',
        background: '#2a0a0a', border: '1.5px solid rgba(192,57,43,0.5)',
      }}
    >
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#ff6b6b' }}>ACİL YARDIM TALEBİ ETKİN</p>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,107,107,0.7)' }}>
        Konumunuz emniyet birimleriyle paylaşılıyor ve talebiniz çözülene kadar ekibimiz tarafından aralıksız takip ediliyor, konumunuzu kapatmayın. İhbarınız, sizin ve masanızdakilerin kimlik bilgileri de emniyet birimleriyle paylaşılıyor.
      </p>
    </div>
  );
}
