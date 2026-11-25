'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { API_PREFIX, langHeaders } from '@/lib/api';
import { PhotoCropper } from './PhotoCropper';
import { PhotoViewer } from '@ahenk/ui';

// Profil fotoğrafı: yalnız KYC onaylıysa yüklenir; fotoğraf admin onayına düşer. Dosya seçimi galeri / dosyalardan
// (capture özniteliği yok; kamera seçeneği sunulmaz)
// Mesajlar çeviri anahtarı (t(...) ile gösterilir)
const KYC_PHOTO_MESSAGE = 'photo.kycFirst';
const PENDING_PHOTO_MESSAGE = 'photo.pending';
const MALE = '#4fc3f7';
const FEMALE = '#f48fb1';
export const genderColor = (g?: string | null) => (g === 'FEMALE' ? FEMALE : MALE);

async function uploadPhoto(file: File): Promise<void> {
  const form = new FormData();
  form.append('photo', file);
  const res = await fetch(`${API_PREFIX}/users/me/profile-photo`, { method: 'POST', credentials: 'include', headers: langHeaders(), body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string | string[] } | null;
    throw new Error((Array.isArray(body?.message) ? body?.message[0] : body?.message) ?? 'photo.uploadFailed');
  }
}

// pick(): KYC onaysızsa mesaj; onaylıysa dosya seçiciyi açar ve yükler. input öğesi sayfaya eklenmeli
function useProfilePhotoPicker(kycApproved: boolean) {
  const t = useTranslations();
  const ref = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const pick = () => {
    setMessage('');
    if (!kycApproved) { setMessage(t(KYC_PHOTO_MESSAGE)); return; }
    ref.current?.click();
  };
  // Seçilen dosya önce kırpma ekranında açılır (İptal / Bitti); kırpılmış kare görsel mevcut yükleme akışıyla gider
  const [cropFile, setCropFile] = useState<File | null>(null);
  const upload = async (f: File) => {
    setBusy(true); setUploaded(false);
    try { await uploadPhoto(f); setUploaded(true); setMessage(t(PENDING_PHOTO_MESSAGE)); } catch (err) { const m = (err as Error).message; setMessage(m.startsWith('photo.') ? t(m) : m); } finally { setBusy(false); }
  };
  const input = (
    <>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) setCropFile(f);
        }} />
      <PhotoCropper file={cropFile} onCancel={() => setCropFile(null)} onDone={(c) => { setCropFile(null); upload(c).catch(() => undefined); }} />
    </>
  );
  return { pick, input, message, busy, uploaded };
}

function Pencil() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>;
}

// Profilim ekranının en üstündeki büyük yuvarlak profil alanı: fotoğraf yoksa ad soyad kısaltması, çerçeve cinsiyet rengi,
// sağ altta palet renginde kalem ikonlu düzenleme butonu
// Onay bekleyen fotoğraf varsa (ya da şimdi yüklendiyse) dairenin altında küçük punto "Fotoğrafın onay sürecinde."; onay / retle kalkar
export function ProfilePhotoHeader({ photoUrl, initials, gender, kycApproved, pending }: { photoUrl?: string | null; initials: string; gender?: string | null; kycApproved: boolean; pending?: boolean }) {
  const t = useTranslations();
  const { pick, input, message, busy, uploaded } = useProfilePhotoPicker(kycApproved);
  const showPending = !!pending || uploaded;
  const SIZE = 112;
  const [viewer, setViewer] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        {/* Fotoğrafa basınca büyütülmüş görünüm (kendi fotoğrafı: koruma yok); kalem mevcut galeri → kırpma akışı */}
        <button type="button" disabled={!photoUrl} onClick={() => setViewer(true)} aria-label={t('masa.enlargePhoto')}
          style={{ width: SIZE, height: SIZE, padding: 0, borderRadius: '50%', border: `3px solid ${genderColor(gender)}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', cursor: photoUrl ? 'pointer' : 'default' }}>
          {photoUrl
            ? <img src={photoUrl} alt={t('photo.alt')} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <span style={{ fontSize: 32, fontWeight: 700, color: '#f5f5f5' }}>{initials}</span>}
        </button>
        <button type="button" onClick={pick} disabled={busy} aria-label={t('photo.edit')}
          style={{ position: 'absolute', right: -4, bottom: -4, width: 44, height: 44, borderRadius: '50%', background: '#c0392b', border: '2px solid #0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          <Pencil />
        </button>
      </div>
      {input}
      <PhotoViewer own url={viewer && photoUrl ? photoUrl : null} onClose={() => setViewer(false)} />
      {showPending && <p role="status" style={{ margin: '10px 0 0', fontSize: 12, color: '#a39c93', textAlign: 'center' }}>{t(PENDING_PHOTO_MESSAGE)}</p>}
      {message && message !== t(PENDING_PHOTO_MESSAGE) && <p role="alert" style={{ margin: '12px 0 0', fontSize: 13, color: '#ff6b6b', textAlign: 'center' }}>{message}</p>}
    </div>
  );
}
