'use client';

import { useLocale, useTranslations } from 'next-intl';
import { KYC_DOC_TYPES as ID_TYPES, type KycDocType as IdType } from '@ahenk/shared';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';

interface KycStatus {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPICIOUS';
  rejectReason?: string;
}

// Kimlik türü (TC / YKN / Pasaport); numara istenmez. Pasaportta yalnız fotoğraflı sayfa (idFront)
async function uploadKyc(
  idType: IdType,
  idFront: File,
  idBack: File | undefined,
  livenessBlob: Blob,
  livenessMime: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  const form = new FormData();
  form.append('idType', idType);
  form.append('idFront', idFront);
  if (idType !== 'PASSPORT' && idBack) form.append('idBack', idBack);
  form.append('liveness', new File([livenessBlob], `liveness.${livenessMime === 'video/mp4' ? 'mp4' : 'webm'}`, { type: livenessMime }));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${process.env.NEXT_PUBLIC_API_URL ?? 'https://ahenk.co'}/api/v1/kyc/upload`);
    xhr.withCredentials = true; // oturum HttpOnly çerezle gider
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        try { reject(new Error(JSON.parse(xhr.responseText)?.message ?? `Error (${xhr.status})`)); }
        catch { reject(new Error(`Upload failed (${xhr.status})`)); }
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(form);
  });
}

/* ── IndexedDB: KYC taslak kalıcılığı ───────────────────────────────────── */

const KYC_DB_NAME  = 'ahenk-kyc-draft';
const KYC_DB_STORE = 'files';

function openKycDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(KYC_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(KYC_DB_STORE);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}
async function kycDbSet(key: string, value: unknown) {
  try {
    const db = await openKycDb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(KYC_DB_STORE, 'readwrite');
      tx.objectStore(KYC_DB_STORE).put(value, key);
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(tx.error);
    });
  } catch {}
}
async function kycDbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openKycDb();
    return new Promise((res) => {
      const req = db.transaction(KYC_DB_STORE, 'readonly').objectStore(KYC_DB_STORE).get(key);
      req.onsuccess = () => res(req.result as T);
      req.onerror   = () => res(undefined);
    });
  } catch { return undefined; }
}
async function kycDbDel(key: string) {
  try {
    const db = await openKycDb();
    await new Promise<void>((res) => {
      const tx = db.transaction(KYC_DB_STORE, 'readwrite');
      tx.objectStore(KYC_DB_STORE).delete(key);
      tx.oncomplete = () => res();
    });
  } catch {}
}
async function kycDbClear() {
  try {
    const db = await openKycDb();
    await new Promise<void>((res) => {
      const tx = db.transaction(KYC_DB_STORE, 'readwrite');
      tx.objectStore(KYC_DB_STORE).clear();
      tx.oncomplete = () => res();
    });
  } catch {}
}

/* ── Görsel Yükleyici ────────────────────────────────────────────────────── */

function ImageUploader({
  svgSrc, svgAlt, uploadLabel, file, progress, onChange,
}: {
  svgSrc: string; svgAlt: string; uploadLabel: string;
  file?: File | null; progress: number;
  onChange: (f: File | null) => void;
}) {
  const t = useTranslations();
  const cameraRef  = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(f: File) {
    onChange(f);

  }

  return (
    <div className="flex flex-col gap-3">
      {/* SVG veya önizleme */}
      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div
            key="svg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mx-auto relative rounded-xl overflow-hidden"
            style={{ maxHeight: '160px', width: '100%', maxWidth: '260px', aspectRatio: '85/54' }}
          >
            <img
              src={svgSrc}
              alt={svgAlt}
              className="w-full h-full object-contain"
              style={{
                filter: 'brightness(0.6) contrast(1.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '12px',
              }}
            />
            {/* Karartma overlay */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', borderRadius: '12px' }} />
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {previewUrl && (
              <img
                src={previewUrl}
                alt={t('kycf.preview')}
                className="w-full rounded-xl"
                style={{ maxHeight: '220px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Yüklendi onayı veya yükleme butonu */}
      {file ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
          <span className="text-green-400">✓</span>
          <p className="text-xs text-green-400">{t('kycf.photoUploaded')}</p>
          <button
            onClick={() => onChange(null as unknown as File)}
            className="ml-auto btn-ghost"
          >
            {t('kycf.retake')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => cameraRef.current?.click()}
            className="w-full btn-ghost justify-center"
          >
            {uploadLabel}
          </button>
        </div>
      )}

      {progress > 0 && progress < 100 && (
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.10)' }}>
          <div className="h-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#c0392b,#ff6b6b)' }} />
        </div>
      )}

      {/* Gizli file input'lar */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
      />
    </div>
  );
}

/* ── Liveness Kaydedici ──────────────────────────────────────────────────── */

function LivenessRecorder({ onCapture, initialDone, fullName }: { onCapture: (blob: Blob, mime: string) => void; initialDone?: boolean; fullName?: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);

  const [phase,     setPhase]     = useState<'idle' | 'preview' | 'countdown' | 'recording' | 'done' | 'error'>(initialDone ? 'done' : 'idle');
  const [countdown, setCountdown] = useState(3);
  const [recCountdown, setRecCountdown] = useState(5);
  const [camError,  setCamError]  = useState('');
  const [done,      setDone]      = useState(initialDone ?? false);

  useEffect(() => {
    if (initialDone) { setDone(true); setPhase('done'); }
  }, [initialDone]);

  useEffect(() => {
    if ((phase === 'preview' || phase === 'countdown' || phase === 'recording') && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [phase]);

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  async function openCamera() {
    setCamError('');
    setDone(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError(t('kycf.httpsNeeded'));
      setPhase('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      streamRef.current = stream;
      setPhase('preview');
    } catch (err) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setCamError(t('kycf.camDenied'));
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        setCamError(t('kycf.noCam'));
      } else if (e.name === 'NotSupportedError') {
        setCamError(t('kycf.httpsShort'));
      } else {
        setCamError(t('kycf.camFailed', { error: e.message || e.name }));
      }
      setPhase('error');
    }
  }

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : 'video/mp4';

    const recorder = new MediaRecorder(streamRef.current, { mimeType: mime });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      stopStream();
      setPhase('done');
      setDone(true);
      onCapture(blob, mime);
    };
    recorderRef.current = recorder;
    recorder.start();

    setPhase('countdown');
    setCountdown(3);

    let remaining = 3;
    const tick = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        setPhase('recording');
        setRecCountdown(5);
        let recRemaining = 5;
        const recTick = setInterval(() => {
          recRemaining -= 1;
          setRecCountdown(recRemaining);
          if (recRemaining <= 0) clearInterval(recTick);
        }, 1000);
        setTimeout(() => recorder.stop(), 5000);
      }
    }, 1000);
  }

  function retake() {
    setDone(false);
    setPhase('idle');
    onCapture(new Blob(), '');
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Kamera canlı görüntü */}
      {(phase === 'preview' || phase === 'countdown' || phase === 'recording') && (
        <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '4/3', background: '#000', border: '1px solid rgba(255,255,255,0.08)' }}>
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />

          <AnimatePresence>
            {phase === 'countdown' && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <motion.span
                  key={countdown}
                  initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className="text-7xl font-bold"
                  style={{ color: '#c0392b', fontVariantNumeric: 'tabular-nums', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
                >
                  {countdown}
                </motion.span>
              </motion.div>
            )}
            {phase === 'recording' && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col justify-between items-start p-3"
              >
                {/* Sol üst: KAYIT BAŞLADI + altında geri sayım ortalı */}
                <div className="flex flex-col items-center gap-0 w-fit">
                  <div className="flex items-center gap-1">
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: '#27ae60' }}
                    />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#2ecc71', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                      {t('kycf.recording')}
                    </span>
                  </div>
                  <span className="font-bold text-center" style={{ fontSize: '18px', color: '#2ecc71', textShadow: '0 1px 6px rgba(0,0,0,0.9)', lineHeight: 1 }}>
                    {recCountdown}
                  </span>
                </div>
                <div />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Hata */}
      {phase === 'error' && camError && (
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)' }}>
          <p className="text-sm text-[#ff6b6b]">{camError}</p>
        </div>
      )}

      {/* Video kaydedildi onayı */}
      {done && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
          <span className="text-green-400">✓</span>
          <p className="text-xs text-green-400">{t('kycf.videoUploaded')}</p>
          <button onClick={retake} className="ml-auto btn-ghost">
            {t('kycf.retake')}
          </button>
        </div>
      )}

      {/* Açıklama */}
      {phase === 'preview' && (
        <p className="text-xs text-center" style={{ color: '#2ecc71' }}>
          {/* Türkçe arayüzde mevcut metin; İngilizce arayüzde ekranda "My name is [ad soyad]" */}
          {locale === 'en' ? <>{t('kycf.sayEn')} <strong style={{ color: '#f5f5f5' }}>&quot;My name is {fullName}&quot;</strong></> : t('kycf.sayTr')}
        </p>
      )}

      {/* Butonlar */}
      {!done && (
        <>
          {(phase === 'idle' || phase === 'error') && (
            <>
              <img
                src="/kyc-liveness-demo.webp"
                alt={t('kycf.videoAlt')}
                className="w-full rounded-xl"
                style={{ maxHeight: '180px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.10)' }}
              />
            </>
          )}
          <div className="flex gap-2">
          {(phase === 'idle' || phase === 'error') && (
            <button
              onClick={openCamera}
              className="flex-1 btn-ghost"
            >
              {t('kycf.uploadVideo')}
            </button>
          )}
          {phase === 'preview' && (
            <button onClick={startRecording} className="flex-1 btn-primary">
              {t('kycf.startRec')}
            </button>
          )}
          </div>
          {(phase === 'idle' || phase === 'error') && (
            <div className="w-full rounded-xl px-4 py-3" style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.3)' }}>
              <p className="text-xs" style={{ color: 'rgba(192,57,43,0.85)', lineHeight: 1.6 }}>
                {t('kycf.privacy')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Ana bileşen ─────────────────────────────────────────────────────────── */

export function TabKyc() {
  const t = useTranslations();
  // Önce belge türü sorulur (bölgede izin verilen türler: Türkiye'de dördü, diğer bölgelerde Pasaport / Oturma İzni / Ehliyet),
  // sonra çekim: Pasaport'ta fotoğraflı sayfa, diğerlerinde önce ön yüz, ardından arka yüz. Video metni için ad soyad
  const [idTypes, setIdTypes] = useState<IdType[]>(ID_TYPES);
  const [idType, setIdType] = useState<IdType>('ID_CARD');
  const [typeChosen, setTypeChosen] = useState(false);
  const [fullName, setFullName] = useState('');
  useEffect(() => {
    api.get<{ firstName?: string; lastName?: string; profile?: { primaryCity?: { idTypes?: IdType[] } } }>('/auth/me').then((u) => {
      setFullName(`${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim());
      const allowed = u?.profile?.primaryCity?.idTypes;
      const selectable = allowed?.filter((a) => ID_TYPES.includes(a));
      if (selectable?.length) { setIdTypes(selectable); if (!selectable.includes('ID_CARD')) setIdType(selectable[0]); }
    }).catch(() => {});
  }, []);
  const needsBack = idType !== 'PASSPORT';
  // Belge türü değişince yüklenen ön / arka yüz silinir (canlılık videosu kalır)
  function resetDocs() {
    setFiles(p => ({ ...p, idFront: undefined, idBack: undefined }));
    kycDbDel('idFront'); kycDbDel('idBack');
  }
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress,  setProgress]  = useState(0);

  const [files,    setFiles]    = useState<{ idFront?: File; idBack?: File }>({});
  const [liveness, setLiveness] = useState<{ blob: Blob; mime: string } | null>(null);

  const handleCapture = useCallback((blob: Blob, mime: string) => {
    if (blob.size === 0) {
      setLiveness(null);
      kycDbDel('livenessBlob');
      kycDbDel('livenessMime');
      return;
    }
    setLiveness({ blob, mime });
    kycDbSet('livenessBlob', blob);
    kycDbSet('livenessMime', mime);
  }, []);

  useEffect(() => {
    async function restore() {
      try {
        const front   = await kycDbGet<File>('idFront');
        const back    = await kycDbGet<File>('idBack');
        const livBlob = await kycDbGet<Blob>('livenessBlob');
        const livMime = await kycDbGet<string>('livenessMime');
        if (front || back) setFiles({ idFront: front, idBack: back });
        if (livBlob && livMime && livBlob.size > 0) setLiveness({ blob: livBlob, mime: livMime });
      } catch {}
    }
    restore();
  }, []);

  useEffect(() => {
    api.get<KycStatus>('/kyc/status')
      .then(setKycStatus)
      .catch((e: Error) => {
        if (e.message.includes('404') || e.message.toLowerCase().includes('bulunamadı') || e.message.toLowerCase().includes('not found')) {
          setKycStatus({ status: 'PENDING' });
        } else if (e.message === '__rate_limit__') {
          setError(t('common.rateLimit'));
        } else {
          setError(e.message);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit() {
    if (!files.idFront || (needsBack && !files.idBack) || !liveness) {
      setError(t('kycf.fillAll'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await uploadKyc(idType, files.idFront, files.idBack, liveness.blob, liveness.mime, setProgress);
      await kycDbClear();
      setKycStatus({ status: 'PENDING' });
      setFiles({});
      setLiveness(null);
      setProgress(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <SkeletonBlock lines={4} />;
  if (error && !kycStatus) return <p className="text-accent text-sm">{error}</p>;

  if (kycStatus?.status === 'APPROVED') {
    return (
      <div className="ll-card flex flex-col items-center gap-3 text-center">
        <span className="text-3xl">✓</span>
        <p className="font-medium text-green-400">{t('kycf.verified')}</p>
        <p className="text-[13px] text-[#a39c93]">{t('kycf.verifiedInfo')}</p>
      </div>
    );
  }

  if (kycStatus?.status === 'PENDING') {
    return (
      <div className="ll-card flex flex-col items-center gap-4 text-center overflow-hidden" style={{ padding: '0 0 2rem' }}>
        {/* Şarap kırmızısı top animasyonu */}
        <div className="w-full relative overflow-hidden" style={{ height: '36px' }}>
          <style>{`
            @keyframes ballRoll {
              0%   { transform: translateX(-120px); }
              100% { transform: translateX(calc(100vw + 40px)); }
            }
            .kyc-ball { position: absolute; top: 50%; width: 12px; height: 12px; border-radius: 50%; background: #722f37; transform: translateY(-50%); animation: ballRoll 3s linear infinite; }
            .kyc-ball:nth-child(1) { animation-delay: 0s; }
            .kyc-ball:nth-child(2) { animation-delay: 1s; }
            .kyc-ball:nth-child(3) { animation-delay: 2s; }
          `}</style>
          <div className="kyc-ball" />
          <div className="kyc-ball" />
          <div className="kyc-ball" />
        </div>
        <p className="font-semibold text-[#f5f5f5] text-base px-6">{t('kycf.inReview')}</p>
        <p className="text-[13px] text-[#a39c93] px-6">
          {t('kycf.reviewing1')}<br />
          {t('kycf.reviewing2')}
        </p>
      </div>
    );
  }

  const showForm = !kycStatus?.status || kycStatus.status === 'REJECTED' || kycStatus.status === 'SUSPICIOUS';

  return (
    <div className="flex flex-col gap-5">
      {kycStatus?.status === 'REJECTED' && (
        <div className="bg-red-900/20 border border-red-800 rounded-2xl p-4">
          <p className="text-sm text-accent font-medium mb-1">{t('kycf.rejected')}</p>
          <p className="text-[13px] text-[#a39c93]">{kycStatus.rejectReason ?? t('kycf.reupload')}</p>
        </div>
      )}

      {showForm && (
        <>
          <h3 className="ll-title">{t('kycf.title')}</h3>

          {/* 1. adım — belge türü (bölge ayarından) */}
          {!typeChosen ? (
          <div>
            <p className="text-[13px] text-[#c9c2b8] mb-2">{t('kycf.idType')}</p>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label={t('kycf.idType')}>
              {idTypes.map((it) => (
                <button key={it} type="button" role="radio" aria-checked={idType === it} onClick={() => setIdType(it)}
                  className="text-left rounded-xl px-4 text-[14px]" style={{ minHeight: 44, border: `1px solid ${idType === it ? 'rgba(192,57,43,0.6)' : 'rgba(255,255,255,0.08)'}`, background: idType === it ? 'rgba(192,57,43,0.10)' : 'rgba(255,255,255,0.025)', color: idType === it ? '#ff6b6b' : '#c9c2b8' }}>
                  {t(`kycf.type${it}`)}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setTypeChosen(true)} className="w-full btn-primary justify-center mt-4">{t('common.continue')}</button>
          </div>
          ) : (
          <>
          {/* Seçilen belge türü; değiştirilirse yüklenen belge fotoğrafları sıfırlanır */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-[#c9c2b8]">{t('kycf.idType')}: <span className="font-semibold text-[#f4f1ec]">{t(`kycf.type${idType}`)}</span></p>
            <button type="button" onClick={() => { resetDocs(); setTypeChosen(false); }} className="btn-ghost">{t('prof.change')}</button>
          </div>

          <ImageUploader
            svgSrc="/kyc_demo_identity_card.svg"
            svgAlt={t('kycf.frontAlt')}
            uploadLabel={idType === 'PASSPORT' ? t('kycf.uploadPassport') : t('kycf.uploadFront')}
            file={files.idFront}
            progress={0}
            onChange={(f) => {
              setFiles(p => ({ ...p, idFront: f || undefined }));
              if (f) kycDbSet('idFront', f); else kycDbDel('idFront');
            }}
          />

          {/* Ön yüz yüklenince arka yüz */}
          {needsBack && !!files.idFront && <ImageUploader
            svgSrc="/kyc_demo_identity_card_back.svg"
            svgAlt={t('kycf.backAlt')}
            uploadLabel={t('kycf.uploadBack')}
            file={files.idBack}
            progress={0}
            onChange={(f) => {
              setFiles(p => ({ ...p, idBack: f || undefined }));
              if (f) kycDbSet('idBack', f); else kycDbDel('idBack');
            }}
          />}

          <LivenessRecorder onCapture={handleCapture} initialDone={!!liveness} fullName={fullName} />

          {error && <p className="text-accent text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting || !files.idFront || (needsBack && !files.idBack) || !liveness}
            className="w-full btn-primary justify-center disabled:opacity-50"
          >
            {submitting ? t('kycf.uploading') : t('kycf.submit')}
          </button>

          {submitting && progress > 0 && (
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.10)' }}>
              <div className="h-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#1a5c2a,#27ae60)' }} />
            </div>
          )}
          </>
          )}
        </>
      )}
    </div>
  );
}
