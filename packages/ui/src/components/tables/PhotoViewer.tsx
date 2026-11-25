'use client';

import { useTranslations } from 'next-intl';
import { useEffect, type CSSProperties } from 'react';

// Profil fotoğrafı tam ekran büyük görünüm (Instagram profil fotoğrafı gibi); onEdit verilirse sağ altta palet renginde kalem butonu
// own: kullanıcının kendi fotoğrafı → koruma (sağ tık / sürükleme engeli) yok
export function PhotoViewer({ url, onClose, onEdit, own = false }: { url: string | null; onClose: () => void; onEdit?: () => void; own?: boolean }) {
  const t = useTranslations();
  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [url, onClose]);
  if (!url) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={t('photo.alt')} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 'min(86vw, 86vh, 520px)', aspectRatio: '1 / 1' }}>
        {/* Büyütülmüş görünüm açıkken fotoğrafta sağ tık menüsü ve sürükleyerek kaydetme kapalı */}
        <img src={url} alt={t('photo.alt')} draggable={own} onContextMenu={own ? undefined : (e) => e.preventDefault()} onDragStart={own ? undefined : (e) => e.preventDefault()}
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block', ...(own ? {} : { WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }) } as CSSProperties} />
        {onEdit && (
          <button type="button" onClick={onEdit} aria-label={t('photo.edit')}
            style={{ position: 'absolute', right: '8%', bottom: '8%', width: 48, height: 48, borderRadius: '50%', background: '#c0392b', border: '2px solid #0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}
