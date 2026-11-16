'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { API_PREFIX, langHeaders } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';

// Web t('report.title') formu: otomatik ekran görüntüsü yok, en fazla 3 görsel (jpg/png/webp, 5 MB)
const MAX_IMAGES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

export function ProblemReportModal({ open, onClose, screen }: { open: boolean; onClose: () => void; screen: string }) {
  const t = useTranslations();
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  useEffect(() => {
    if (open) return;
    setDescription(''); setFiles([]); setError(''); setDone(false);
  }, [open]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError('');
    const picked = Array.from(list);
    if (picked.some((f) => !ACCEPT.includes(f.type))) { setError(t('report.badType')); return; }
    if (picked.some((f) => f.size > MAX_BYTES)) { setError(t('report.tooBig')); return; }
    if (files.length + picked.length > MAX_IMAGES) { setError(t('report.maxImages', { max: MAX_IMAGES })); return; }
    setFiles((prev) => [...prev, ...picked]);
  }

  async function submit() {
    if (!description.trim()) { setError(t('report.descRequired')); return; }
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('platform', 'WEB');
      fd.append('screen', screen);
      fd.append('description', description.trim());
      files.forEach((f) => fd.append('images', f));
      const res = await fetch(`${API_PREFIX}/problem-reports`, { method: 'POST', body: fd, credentials: 'include', headers: langHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = (err as { message?: string | string[] }).message;
        throw new Error(Array.isArray(msg) ? msg[0] : msg ?? t('report.sendFailed'));
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('report.sendFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('report.title')}>
      {done ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[#c9c2b8]">{t('report.thanks')}</p>
          <button type="button" onClick={onClose} className="mx-auto block btn-ghost" style={{ width: '72%' }}>{t('report.close')}</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="block text-xs text-[#c9c2b8]">{t('report.description')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
            rows={5}
            placeholder={t('report.placeholder')}
            style={{ width: '100%', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '11px 14px', fontSize: 14, color: '#f5f5f5', outline: 'none', resize: 'vertical' }}
          />
          {previews.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {previews.map((src, i) => (
                <div key={src} style={{ position: 'relative' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={t('report.imageAlt', { n: i + 1 })} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
                  <button
                    type="button"
                    aria-label={t('report.removeImage')}
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, background: '#1a1a1a', color: '#f5f5f5', border: '1px solid rgba(255,255,255,0.2)', fontSize: 12, lineHeight: '18px' }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {files.length < MAX_IMAGES && (
            <>
              <input ref={inputRef} type="file" accept={ACCEPT.join(',')} multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              <button type="button" onClick={() => inputRef.current?.click()} className="btn-ghost justify-center">
                {t('report.addImage', { count: files.length, max: MAX_IMAGES })}
              </button>
            </>
          )}
          {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
          <div className="mt-2 flex flex-col gap-3">
            <button type="button" onClick={submit} disabled={busy} className="mx-auto block btn-primary disabled:opacity-40" style={{ width: '72%' }}>
              {busy ? t('report.sending') : t('report.send')}
            </button>
            <button type="button" onClick={onClose} className="mx-auto block btn-ghost" style={{ width: '72%' }}>
              {t('report.cancel')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
