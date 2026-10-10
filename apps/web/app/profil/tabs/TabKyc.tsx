'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';

interface KycStatus {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPICIOUS';
  rejectReason?: string;
}

interface UploadUrls {
  idFront: { url: string; key: string };
  idBack:  { url: string; key: string };
  liveness:{ url: string; key: string };
}

async function putToR2(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Yükleme başarısız (${xhr.status})`));
    xhr.onerror = () => reject(new Error('Ağ hatası'));
    xhr.send(file);
  });
}

export function TabKyc() {
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ idFront: 0, idBack: 0, liveness: 0 });

  const idFrontRef  = useRef<HTMLInputElement>(null);
  const idBackRef   = useRef<HTMLInputElement>(null);
  const livenessRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<{ idFront?: File; idBack?: File; liveness?: File }>({});

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
    if (!files.idFront || !files.idBack || !files.liveness) {
      setError('Tüm dosyaları seçin.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const urls = await api.post<UploadUrls>('/kyc/request-upload', {
        idFrontMime:  files.idFront.type,
        idFrontSize:  files.idFront.size,
        idBackMime:   files.idBack.type,
        idBackSize:   files.idBack.size,
        livenessMime: files.liveness.type,
        livenessSize: files.liveness.size,
      });

      await putToR2(urls.idFront.url, files.idFront, (p) => setProgress((prev) => ({ ...prev, idFront: p })));
      await putToR2(urls.idBack.url, files.idBack, (p) => setProgress((prev) => ({ ...prev, idBack: p })));
      await putToR2(urls.liveness.url, files.liveness, (p) => setProgress((prev) => ({ ...prev, liveness: p })));

      await api.post('/kyc/submit', {
        idFrontKey:  urls.idFront.key,
        idBackKey:   urls.idBack.key,
        livenessKey: urls.liveness.key,
      });

      setKycStatus({ status: 'PENDING' });
      setFiles({});
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
      <div className="bg-surface border border-green-800 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
        <span className="text-3xl">✓</span>
        <p className="font-medium text-green-400">Kimliğiniz doğrulandı</p>
        <p className="text-sm text-muted">Artık masalara katılabilir ve paket satın alabilirsiniz.</p>
      </div>
    );
  }

  if (kycStatus?.status === 'PENDING') {
    return (
      <div className="bg-surface border border-border rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
        <p className="font-medium text-text">Belgeleriniz inceleniyor</p>
        <p className="text-sm text-muted">Başvurunuz değerlendiriliyor. Bu süreç genellikle 24-48 saat sürer.</p>
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

          <FileInput
            label="Kimlik Ön Yüz"
            accept="image/jpeg,image/png,image/webp"
            hint="JPEG, PNG veya WebP — maks. 5 MB"
            ref={idFrontRef}
            file={files.idFront}
            progress={progress.idFront}
            onChange={(f) => setFiles((p) => ({ ...p, idFront: f }))}
          />
          <FileInput
            label="Kimlik Arka Yüz"
            accept="image/jpeg,image/png,image/webp"
            hint="JPEG, PNG veya WebP — maks. 5 MB"
            ref={idBackRef}
            file={files.idBack}
            progress={progress.idBack}
            onChange={(f) => setFiles((p) => ({ ...p, idBack: f }))}
          />
          <FileInput
            label="Liveness Videosu"
            accept="video/mp4,video/webm,video/quicktime"
            hint="MP4, WebM veya MOV — 6-7 saniye — maks. 80 MB"
            ref={livenessRef}
            file={files.liveness}
            progress={progress.liveness}
            onChange={(f) => setFiles((p) => ({ ...p, liveness: f }))}
          />

          {error && <p className="text-accent text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting || !files.idFront || !files.idBack || !files.liveness}
            className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-sm font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? 'Yükleniyor…' : 'Başvuruyu Gönder'}
          </button>
        </>
      )}
    </div>
  );
}

// ─── FileInput bileşeni ───────────────────────────────────────────────────

import { forwardRef } from 'react';

const FileInput = forwardRef<HTMLInputElement, {
  label: string; accept: string; hint: string;
  file?: File; progress: number;
  onChange: (f: File) => void;
}>(({ label, accept, hint, file, progress, onChange }, ref) => (
  <div>
    <label className="block text-sm text-muted mb-2">{label}</label>
    <div
      className="relative bg-surface border border-border rounded-xl p-4 cursor-pointer hover:border-muted transition-colors"
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
