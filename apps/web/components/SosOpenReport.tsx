'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

const POLL_MS = 30_000;
const NOTICE_MS = 30_000; // Talep uyarısı 30 saniye görünür (geri sayım çubuğu + X); konum gönderimi sürer
const RESUMED_MS = 10_000; // "Konumun yeniden alınıyor" 10 saniye görünür (X ile kapanır)
// Masa kartı (MasaDetayKarti) talep açınca ve burada talep kapanınca haberleşme olayları
const SOS_OPENED_EVENT = 'ahenk-sos-opened';
const SOS_CLOSED_EVENT = 'ahenk-sos-closed';

// Açık acil yardım talebi masa kartından bağımsızdır: kart kalksa da sayfa yenilense de ekranda kalır, canlı konum
// gönderilir. Admin sonuçlandırınca (reportId null ya da active:false) konum durur ve ekran kapanır.
export default function SosOpenReport() {
  const t = useTranslations();
  const pathname = usePathname();
  const [reportId, setReportId] = useState<string | null>(null);
  const [noticeVisible, setNoticeVisible] = useState(false);
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    if (!resumed) return;
    const t = setTimeout(() => setResumed(false), RESUMED_MS);
    return () => clearTimeout(t);
  }, [resumed]);

  // Talep açıldığında uyarı 30 saniye gösterilir, sonra yalnızca görsel uyarı gizlenir
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
    // Konum alınamazsa (izin kapatıldı / konum servisi kapalı) sunucuya bir kez bildirilir; sunucu talep edene push gönderir.
    // Konum yeniden gelince sunucu resumed döner: "Konumun yeniden alınıyor" uyarısı
    let offReported = false;
    const watch = navigator.geolocation?.watchPosition(
      (pos) => {
        offReported = false;
        api.post<{ active: boolean; resumed?: boolean }>(`/sos/reports/${reportId}/location`, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }).then((r) => { if (r.active === false) setReportId(null); else if (r.resumed) setResumed(true); }).catch(() => undefined);
      },
      (err) => {
        if (err.code === err.TIMEOUT || offReported) return;
        offReported = true;
        api.post(`/sos/reports/${reportId}/location-off`, {}).catch(() => { offReported = false; });
      },
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => {
      clearInterval(poll);
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
      window.dispatchEvent(new Event(SOS_CLOSED_EVENT));
    };
  }, [reportId]);

  if (!reportId) return null;
  return (
    <>
      {noticeVisible && (
        <Notice
          title={t('sos.sentTitle')} lines={[t('sos.sentLine1'), t('sos.sentLine2')]} bold={t('sos.sentBold')}
          countdownMs={NOTICE_MS} closeLabel={t('masa.close')} onClose={() => setNoticeVisible(false)}
        />
      )}
      {resumed && !noticeVisible && (
        <Notice
          title={t('sos.resumedTitle')} lines={[t('sos.resumedLine')]} bold={t('sos.resumedBold')}
          closeLabel={t('masa.close')} onClose={() => setResumed(false)}
        />
      )}
    </>
  );
}

// Uyarı kutusu: başlık, satırlar, son satır kalın, sağ üstte X; countdownMs verilirse altta geri sayım çubuğu
function Notice({ title, lines, bold, countdownMs, closeLabel, onClose }: {
  title: string; lines: string[]; bold: string; countdownMs?: number; closeLabel: string; onClose: () => void;
}) {
  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 60, maxWidth: 480, margin: '0 auto',
        padding: '16px 16px 14px', borderRadius: 12, textAlign: 'center', overflow: 'hidden',
        background: '#2a0a0a', border: '1.5px solid rgba(192,57,43,0.5)',
      }}
    >
      <style>{'@keyframes sosBar{from{transform:scaleX(1)}to{transform:scaleX(0)}}'}</style>
      <button type="button" onClick={onClose} aria-label={closeLabel}
        style={{ position: 'absolute', top: 4, right: 4, width: 44, height: 44, background: 'none', border: 'none', color: '#f5f5f5', fontSize: 20, cursor: 'pointer' }}>
        ×
      </button>
      <p style={{ margin: '0 32px', fontSize: 13, fontWeight: 700, color: '#ff6b6b' }}>{title}</p>
      {lines.map((l) => <p key={l} style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,107,107,0.8)' }}>{l}</p>)}
      <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 700, color: '#ff6b6b' }}>{bold}</p>
      {countdownMs && (
        <div style={{ marginTop: 12, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <div style={{ height: 4, borderRadius: 2, background: '#ff6b6b', transformOrigin: 'left center', animation: `sosBar ${countdownMs}ms linear forwards` }} />
        </div>
      )}
    </div>
  );
}
