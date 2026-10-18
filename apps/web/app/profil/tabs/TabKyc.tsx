'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';

interface KycStatus {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPICIOUS';
  rejectReason?: string;
}

interface UploadUrls {
  idFront:  { uploadUrl: string; key: string };
  idBack:   { uploadUrl: string; key: string };
  liveness: { uploadUrl: string; key: string };
}

async function uploadKyc(
  idFront: File,
  idBack: File,
  livenessBlob: Blob,
  livenessMime: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  const form = new FormData();
  form.append('idFront', idFront);
  form.append('idBack', idBack);
  form.append('liveness', new File([livenessBlob], `liveness.${livenessMime === 'video/mp4' ? 'mp4' : 'webm'}`, { type: livenessMime }));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const token = document.cookie.match(/(?:^|;\s*)ahenk_token=([^;]+)/)?.[1];
    xhr.open('POST', `${process.env.NEXT_PUBLIC_API_URL ?? 'https://ahenk.co'}/api/v1/kyc/upload`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${decodeURIComponent(token)}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        try { reject(new Error(JSON.parse(xhr.responseText)?.message ?? `Hata (${xhr.status})`)); }
        catch { reject(new Error(`Yükleme başarısız (${xhr.status})`)); }
      }
    };
    xhr.onerror = () => reject(new Error('Ağ hatası'));
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
                border: '1px solid rgba(255,255,255,0.06)',
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
                alt="Önizleme"
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
          <p className="text-xs text-green-400">Fotoğraf Yüklendi</p>
          <button
            onClick={() => onChange(null as unknown as File)}
            className="ml-auto text-xs text-[#555] hover:text-[#888] transition-colors"
          >
            Tekrar Çek
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => cameraRef.current?.click()}
            className="w-full py-2.5 text-sm font-medium rounded-xl transition-all"
            style={{ border: '1px solid rgba(192,57,43,0.5)', color: '#ff6b6b', background: 'rgba(192,57,43,0.06)' }}
          >
            {uploadLabel}
          </button>
        </div>
      )}

      {progress > 0 && progress < 100 && (
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
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

function LivenessRecorder({ onCapture, initialDone }: { onCapture: (blob: Blob, mime: string) => void; initialDone?: boolean }) {
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
      setCamError('Kamera için HTTPS bağlantısı gereklidir. Güvenli bağlantıyla erişin.');
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
        setCamError('Kamera izni reddedildi. Tarayıcı ayarlarından izin verin.');
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        setCamError('Kamera bulunamadı.');
      } else if (e.name === 'NotSupportedError') {
        setCamError('HTTPS bağlantısı gereklidir.');
      } else {
        setCamError(`Kamera açılamadı: ${e.message || e.name}`);
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
                className="absolute inset-0 flex flex-col justify-between p-3"
              >
                {/* Sol üst: KAYIT BAŞLADI + altında geri sayım */}
                <div className="flex flex-col items-start gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: '#27ae60' }}
                    />
                    <span className="text-xs font-bold" style={{ color: '#2ecc71', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                      KAYIT BAŞLADI
                    </span>
                  </div>
                  <span className="text-2xl font-bold" style={{ color: '#2ecc71', textShadow: '0 1px 6px rgba(0,0,0,0.9)', lineHeight: 1, paddingLeft: '2px' }}>
                    {recCountdown}
                  </span>
                </div>
                {/* Alt: söyleme talimatı */}
                <p className="text-xs font-medium text-center px-2" style={{ color: '#2ecc71', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                  Kayıt başladığında 5 sn. içinde adınızı ve soyadınızı söyleyin.
                </p>
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
          <p className="text-xs text-green-400">Video Yüklendi</p>
          <button onClick={retake} className="ml-auto text-xs text-[#555] hover:text-[#888] transition-colors">
            Tekrar Çek
          </button>
        </div>
      )}

      {/* Açıklama */}
      {phase === 'preview' && (
        <p className="text-xs text-[#555] text-center">
          Kayıt başlayınca adınızı ve soyadınızı yüksek sesle söyleyin.
        </p>
      )}

      {/* Butonlar */}
      {!done && (
        <>
          {(phase === 'idle' || phase === 'error') && (
            <>
              <img
                src="/kyc-liveness-demo.png"
                alt="Canlı video örneği"
                className="w-full rounded-xl"
                style={{ maxHeight: '180px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.06)' }}
              />
            </>
          )}
          <div className="flex gap-2">
          {(phase === 'idle' || phase === 'error') && (
            <button
              onClick={openCamera}
              className="flex-1 py-2.5 text-sm font-medium rounded-xl transition-all"
              style={{ border: '1px solid rgba(192,57,43,0.5)', color: '#ff6b6b', background: 'rgba(192,57,43,0.06)' }}
            >
              Canlı Video Yükle
            </button>
          )}
          {phase === 'preview' && (
            <button onClick={startRecording} className="flex-1 py-2.5 text-sm font-medium btn-grad">
              Kaydı Başlat
            </button>
          )}
          </div>
          {(phase === 'idle' || phase === 'error') && (
            <div className="w-full rounded-xl px-4 py-3" style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.3)' }}>
              <p className="text-xs" style={{ color: 'rgba(192,57,43,0.85)', lineHeight: 1.6 }}>
                Ekibimiz hesap doğrulama talebinizi inceleyene kadar bilgiler saklanır. Doğrulama onaylanır veya reddedilir ise, tüm bilgiler veritabanından silinir ve depolanmaz. Doğrulama, sahte profillerin platformu kullanmasını engellemek için bir filtredir.
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
        if (e.message.includes('404') || e.message.toLowerCase().includes('bulunamadı')) {
          setKycStatus({ status: 'PENDING' });
        } else {
          setError(e.message);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit() {
    if (!files.idFront || !files.idBack || !liveness) {
      setError('Tüm alanları doldurun ve liveness videosu kaydedin.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await uploadKyc(files.idFront, files.idBack, liveness.blob, liveness.mime, setProgress);
      await kycDbClear();
      setKycStatus({ status: 'PENDING' });
      setFiles({});
      setLiveness(null);
      setProgress(0);
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
      <div className="glass-card p-8 flex flex-col items-center gap-3 text-center" style={{ border: '1px solid rgba(74,222,128,0.25)' }}>
        <span className="text-3xl">✓</span>
        <p className="font-medium text-green-400">Kimliğiniz doğrulandı</p>
        <p className="text-sm text-[#888]">Artık masalara katılabilir ve paket satın alabilirsiniz.</p>
      </div>
    );
  }

  if (kycStatus?.status === 'PENDING') {
    return (
      <div className="glass-card flex flex-col items-center gap-4 text-center overflow-hidden" style={{ paddingBottom: '2rem' }}>
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
        <p className="font-semibold text-[#f5f5f5] text-base px-6">Doğrulama incelemeye alındı</p>
        <p className="text-sm text-[#888] px-6">
          Başvurunuz değerlendiriliyor.<br />
          Bu süreç genellikle 1 saat içinde tamamlanır.
        </p>
      </div>
    );
  }

  const showForm = !kycStatus?.status || kycStatus.status === 'REJECTED' || kycStatus.status === 'SUSPICIOUS';

  return (
    <div className="flex flex-col gap-5">
      {kycStatus?.status === 'REJECTED' && (
        <div className="bg-red-900/20 border border-red-800 rounded-2xl p-4">
          <p className="text-sm text-accent font-medium mb-1">Başvurunuz reddedildi</p>
          <p className="text-sm text-muted">{kycStatus.rejectReason ?? 'Lütfen belgelerinizi yeniden yükleyin.'}</p>
        </div>
      )}

      {showForm && (
        <>
          <h3 className="font-medium text-sm text-muted uppercase tracking-wide">KİMLİK DOĞRULAMA</h3>

          <ImageUploader
            svgSrc="/kyc_demo_identity_card.svg"
            svgAlt="Kimlik ön yüz örneği"
            uploadLabel="Ön Yüzü Yükle"
            file={files.idFront}
            progress={0}
            onChange={(f) => {
              setFiles(p => ({ ...p, idFront: f || undefined }));
              if (f) kycDbSet('idFront', f); else kycDbDel('idFront');
            }}
          />

          <ImageUploader
            svgSrc="/kyc_demo_identity_card_back.svg"
            svgAlt="Kimlik arka yüz örneği"
            uploadLabel="Arka Yüzü Yükle"
            file={files.idBack}
            progress={0}
            onChange={(f) => {
              setFiles(p => ({ ...p, idBack: f || undefined }));
              if (f) kycDbSet('idBack', f); else kycDbDel('idBack');
            }}
          />

          <LivenessRecorder onCapture={handleCapture} initialDone={!!liveness} />

          {error && <p className="text-accent text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting || !files.idFront || !files.idBack || !liveness}
            className="w-full py-3 text-sm font-semibold rounded-xl disabled:opacity-50"
            style={{ background: 'linear-gradient(115deg,#1a5c2a,#27ae60)', color: '#fff', boxShadow: '0 0 16px rgba(39,174,96,0.35)', border: 'none' }}
          >
            {submitting ? 'Yükleniyor…' : 'Kimliğimi Doğrula'}
          </button>

          {submitting && progress > 0 && (
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#1a5c2a,#27ae60)' }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
