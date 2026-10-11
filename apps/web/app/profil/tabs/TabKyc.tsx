'use client';

import { useEffect, useState, useRef, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';

interface KycStatus {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPICIOUS';
  rejectReason?: string;
}

interface UploadUrls {
  idFront:  { url: string; key: string };
  idBack:   { url: string; key: string };
  liveness: { url: string; key: string };
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

// ─── Liveness kaydedici ──────────────────────────────────────────────────────

function LivenessRecorder({ onCapture }: { onCapture: (blob: Blob, mime: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [phase, setPhase] = useState<'idle' | 'preview' | 'countdown' | 'recording' | 'done' | 'error'>('idle');
  const [countdown, setCountdown] = useState(5);
  const [captured, setCaptured] = useState<{ blob: Blob; mime: string; url: string } | null>(null);
  const [camError, setCamError] = useState('');

  async function openCamera() {
    setCamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setPhase('preview');
    } catch {
      setCamError('Kamera erişimine izin verin.');
      setPhase('error');
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : 'video/mp4';

    const recorder = new MediaRecorder(streamRef.current, { mimeType: mime.split(';')[0] });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime.split(';')[0] });
      const url = URL.createObjectURL(blob);
      setCaptured({ blob, mime: mime.split(';')[0], url });
      stopStream();
      setPhase('done');
      if (previewRef.current) {
        previewRef.current.src = url;
        previewRef.current.load();
      }
    };
    recorderRef.current = recorder;
    recorder.start();

    setPhase('countdown');
    setCountdown(5);

    let remaining = 5;
    const tick = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        setPhase('recording');
        setTimeout(() => recorder.stop(), 300);
      }
    }, 1000);
  }

  function retake() {
    if (captured) URL.revokeObjectURL(captured.url);
    setCaptured(null);
    setPhase('idle');
  }

  function useCapture() {
    if (captured) onCapture(captured.blob, captured.mime);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[#888]">Liveness Videosu</p>

      {/* Kamera önizlemesi */}
      {(phase === 'preview' || phase === 'countdown' || phase === 'recording') && (
        <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '4/3', background: '#000', border: '1px solid rgba(255,255,255,0.08)' }}>
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />

          {/* Geri sayım overlay */}
          <AnimatePresence>
            {(phase === 'countdown' || phase === 'recording') && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ background: 'rgba(0,0,0,0.45)' }}
              >
                {phase === 'countdown' && (
                  <motion.span
                    key={countdown}
                    initial={{ scale: 1.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
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

      {/* Çekim sonrası önizleme */}
      {phase === 'done' && captured && (
        <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: '4/3', background: '#000', border: '1px solid rgba(255,255,255,0.08)' }}>
          <video ref={previewRef} controls playsInline className="w-full h-full object-cover" />
        </div>
      )}

      {/* Hata */}
      {phase === 'error' && camError && (
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)' }}>
          <p className="text-sm text-[#ff6b6b]">{camError}</p>
        </div>
      )}

      {/* Açıklama — kamera açıkken */}
      {phase === 'preview' && (
        <p className="text-xs text-[#555] text-center">
          Kayıt başlayınca adınızı ve soyadınızı yüksek sesle söyleyin.
        </p>
      )}

      {/* Butonlar */}
      <div className="flex gap-2">
        {phase === 'idle' || phase === 'error' ? (
          <button
            onClick={openCamera}
            className="flex-1 py-2.5 text-sm font-medium rounded-xl transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#f5f5f5', background: 'rgba(255,255,255,0.04)' }}
          >
            Kamerayı Aç
          </button>
        ) : phase === 'preview' ? (
          <button
            onClick={startRecording}
            className="flex-1 py-2.5 text-sm font-medium btn-grad"
          >
            Kaydı Başlat
          </button>
        ) : phase === 'done' ? (
          <>
            <button
              onClick={retake}
              className="flex-1 py-2.5 text-sm font-medium rounded-xl transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#888', background: 'transparent' }}
            >
              Tekrar Çek
            </button>
            <button
              onClick={useCapture}
              className="flex-1 py-2.5 text-sm font-medium btn-grad"
            >
              Kullan ✓
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export function TabKyc() {
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ idFront: 0, idBack: 0, liveness: 0 });

  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef  = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<{ idFront?: File; idBack?: File }>({});
  const [liveness, setLiveness] = useState<{ blob: Blob; mime: string } | null>(null);

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

      await putToR2(urls.idFront.url, files.idFront, files.idFront.type, (p) => setProgress((prev) => ({ ...prev, idFront: p })));
      await putToR2(urls.idBack.url, files.idBack, files.idBack.type, (p) => setProgress((prev) => ({ ...prev, idBack: p })));
      await putToR2(urls.liveness.url, livenessFile, liveness.mime, (p) => setProgress((prev) => ({ ...prev, liveness: p })));

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
          <h3 className="font-medium text-sm text-muted uppercase tracking-wide">Kimlik Belgelerini Yükle</h3>

          <div className="flex flex-col gap-2">
            <img
              src="/kyc_demo_identity_card.svg"
              alt="Kimlik ön yüz örneği"
              className="w-full rounded-xl"
              style={{ aspectRatio: '85/54', objectFit: 'contain', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            />
            <p className="text-xs text-[#555] text-center">Kimliğiniz bu şekilde görünmeli</p>
            <FileInput
              label="Kimlik Ön Yüz"
              accept="image/jpeg,image/png,image/webp"
              hint="JPEG, PNG veya WebP — maks. 5 MB"
              ref={idFrontRef}
              file={files.idFront}
              progress={progress.idFront}
              onChange={(f) => setFiles((p) => ({ ...p, idFront: f }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <img
              src="/kyc_demo_identity_card_back.svg"
              alt="Kimlik arka yüz örneği"
              className="w-full rounded-xl"
              style={{ aspectRatio: '85/54', objectFit: 'contain', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            />
            <p className="text-xs text-[#555] text-center">Kimliğiniz bu şekilde görünmeli</p>
            <FileInput
              label="Kimlik Arka Yüz"
              accept="image/jpeg,image/png,image/webp"
              hint="JPEG, PNG veya WebP — maks. 5 MB"
              ref={idBackRef}
              file={files.idBack}
              progress={progress.idBack}
              onChange={(f) => setFiles((p) => ({ ...p, idBack: f }))}
            />
          </div>

          <LivenessRecorder
            onCapture={(blob, mime) => setLiveness({ blob, mime })}
          />

          {liveness && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <span className="text-green-400 text-sm">✓</span>
              <p className="text-xs text-green-400">Liveness videosu hazır</p>
            </div>
          )}

          {progress.liveness > 0 && progress.liveness < 100 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-[#555]">Video yükleniyor… {progress.liveness}%</p>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full transition-all" style={{ width: `${progress.liveness}%`, background: 'linear-gradient(90deg,#c0392b,#ff6b6b)' }} />
              </div>
            </div>
          )}

          {error && <p className="text-accent text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting || !files.idFront || !files.idBack || !liveness}
            className="w-full py-3 text-sm btn-grad disabled:opacity-50"
          >
            {submitting ? 'Yükleniyor…' : 'Başvuruyu Gönder'}
          </button>
        </>
      )}
    </div>
  );
}

// ─── FileInput bileşeni ───────────────────────────────────────────────────────

const FileInput = forwardRef<HTMLInputElement, {
  label: string; accept: string; hint: string;
  file?: File; progress: number;
  onChange: (f: File) => void;
}>(({ label, accept, hint, file, progress, onChange }, ref) => (
  <div>
    <label className="block text-sm text-muted mb-2">{label}</label>
    <div
      className="relative cursor-pointer glass-card p-4 hover:border-[rgba(192,57,43,0.4)] transition-colors"
      onClick={() => (ref as React.RefObject<HTMLInputElement>).current?.click()}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])}
      />
      {file ? (
        <p className="text-sm text-text truncate">{file.name}</p>
      ) : (
        <p className="text-sm text-muted">{hint}</p>
      )}
      {progress > 0 && progress < 100 && (
        <div className="mt-2 h-1 bg-bg rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  </div>
));
FileInput.displayName = 'FileInput';
