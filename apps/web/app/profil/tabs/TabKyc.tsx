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

async function putToR2(url: string, file: File | Blob, mimeType: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Yükleme başarısız (${xhr.status})`));
    xhr.onerror = () => reject(new Error('Ağ hatası'));
    xhr.send(file);
  });
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
          <p className="text-xs text-green-400">Görsel Yüklendi</p>
          <button
            onClick={() => onChange(null as unknown as File)}
            className="ml-auto text-xs text-[#555] hover:text-[#888] transition-colors"
          >
            Değiştir
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

function LivenessRecorder({ onCapture }: { onCapture: (blob: Blob, mime: string) => void }) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);

  const [phase,     setPhase]     = useState<'idle' | 'preview' | 'countdown' | 'recording' | 'done' | 'error'>('idle');
  const [countdown, setCountdown] = useState(3);
  const [camError,  setCamError]  = useState('');
  const [done,      setDone]      = useState(false);

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
            {(phase === 'countdown' || phase === 'recording') && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ background: 'rgba(0,0,0,0.45)' }}
              >
                {phase === 'countdown' && (
                  <motion.span
                    key={countdown}
                    initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    className="text-7xl font-bold"
                    style={{ color: '#c0392b', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {countdown}
                  </motion.span>
                )}
                {phase === 'recording' && (
                  <motion.div
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className="w-4 h-4 rounded-full"
                    style={{ background: '#c0392b' }}
                  />
                )}
                <p className="text-sm text-white font-medium px-6 text-center">
                  Adınızı ve soyadınızı söyleyin
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
  const [progress,  setProgress]  = useState({ idFront: 0, idBack: 0, liveness: 0 });

  const [files,    setFiles]    = useState<{ idFront?: File; idBack?: File }>({});
  const [liveness, setLiveness] = useState<{ blob: Blob; mime: string } | null>(null);

  const handleCapture = useCallback((blob: Blob, mime: string) => {
    if (blob.size === 0) { setLiveness(null); return; }
    setLiveness({ blob, mime });
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
      const ext = liveness.mime === 'video/mp4' ? 'mp4' : 'webm';
      const livenessFile = new File([liveness.blob], `liveness.${ext}`, { type: liveness.mime });

      const urls = await api.post<UploadUrls>('/kyc/request-upload', {
        idFrontMime:  files.idFront.type,
        idFrontSize:  files.idFront.size,
        idBackMime:   files.idBack.type,
        idBackSize:   files.idBack.size,
        livenessMime: liveness.mime,
        livenessSize: liveness.blob.size,
      });

      await putToR2(urls.idFront.uploadUrl, files.idFront, files.idFront.type, (p) => setProgress(prev => ({ ...prev, idFront: p })));
      await putToR2(urls.idBack.uploadUrl,  files.idBack,  files.idBack.type,  (p) => setProgress(prev => ({ ...prev, idBack: p })));
      await putToR2(urls.liveness.uploadUrl, livenessFile,  liveness.mime,      (p) => setProgress(prev => ({ ...prev, liveness: p })));

      await api.post('/kyc/submit', {
        idFrontKey:  urls.idFront.key,
        idBackKey:   urls.idBack.key,
        livenessKey: urls.liveness.key,
      });

      setKycStatus({ status: 'PENDING' });
      setFiles({});
      setLiveness(null);
      setProgress({ idFront: 0, idBack: 0, liveness: 0 });
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
      <div className="glass-card p-8 flex flex-col items-center gap-3 text-center">
        <p className="font-medium text-[#f5f5f5]">Belgeleriniz inceleniyor</p>
        <p className="text-sm text-[#888]">Başvurunuz değerlendiriliyor. Bu süreç genellikle 24-48 saat sürer.</p>
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
            progress={progress.idFront}
            onChange={(f) => setFiles(p => ({ ...p, idFront: f || undefined }))}
          />

          <ImageUploader
            svgSrc="/kyc_demo_identity_card_back.svg"
            svgAlt="Kimlik arka yüz örneği"
            uploadLabel="Arka Yüzü Yükle"
            file={files.idBack}
            progress={progress.idBack}
            onChange={(f) => setFiles(p => ({ ...p, idBack: f || undefined }))}
          />

          <LivenessRecorder onCapture={handleCapture} />

          {error && <p className="text-accent text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting || !files.idFront || !files.idBack || !liveness}
            className="w-full py-3 text-sm font-semibold rounded-xl disabled:opacity-50"
            style={{ background: 'linear-gradient(115deg,#1a5c2a,#27ae60)', color: '#fff', boxShadow: '0 0 16px rgba(39,174,96,0.35)', border: 'none' }}
          >
            {submitting ? 'Yükleniyor…' : 'Kimliğimi Doğrula'}
          </button>
        </>
      )}
    </div>
  );
}
