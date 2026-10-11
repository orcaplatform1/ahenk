'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface ServerBlock { id: string; createdAt: string; }
interface LocalBlock { id: string; display: string; }

async function sha256hex(text: string): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

export function TabRehber() {
  const [serverBlocks, setServerBlocks] = useState<ServerBlock[]>([]);
  const [localBlocks, setLocalBlocks] = useState<LocalBlock[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  function loadBlocks() {
    api.get<{ count: number; items: ServerBlock[] }>('/contact-blocks')
      .then(r => setServerBlocks(r.items ?? []))
      .catch(() => {});
  }

  useEffect(() => { loadBlocks(); }, []);

  const totalCount = serverBlocks.length + localBlocks.length;

  function handleAdd() {
    const digits = input.replace(/\D/g, '');
    if (digits.length !== 10) { setError('10 haneli numara girin.'); return; }
    if (totalCount >= 50) { setError('En fazla 50 numara ekleyebilirsiniz.'); return; }
    const display = `+90${digits}`;
    if (localBlocks.some(b => b.display === display)) { setError('Bu numara zaten eklendi.'); return; }
    setLocalBlocks(prev => [...prev, { id: `${Date.now()}`, display }]);
    setInput('');
    setError('');
    setSaved(false);
  }

  async function handleServerDelete(id: string) {
    setDeleting(id);
    try {
      await api.delete(`/contact-blocks/${id}`);
      setServerBlocks(prev => prev.filter(b => b.id !== id));
    } catch (e) { setError((e as Error).message); }
    finally { setDeleting(null); }
  }

  async function handleSave() {
    if (localBlocks.length === 0) { setError('Eklenecek numara yok.'); return; }
    setSaving(true); setError('');
    try {
      const hashes = (await Promise.all(
        localBlocks.map(b => sha256hex(b.display))
      )).filter((h): h is string => h !== null);

      if (hashes.length === 0) {
        setError("Numaralar hash'lenemedi. HTTPS bağlantısı gereklidir.");
        return;
      }

      await api.post('/contact-blocks/sync', { hashedPhones: hashes });
      setSaved(true);
      setLocalBlocks([]);
      loadBlocks();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Sayaç */}
      <div className="glass-card p-5">
        <p className="text-sm text-[#888] mb-1">Engellenen numaralar</p>
        <p className="text-2xl font-semibold text-[#f5f5f5]">
          {totalCount}<span className="text-sm font-normal text-[#888]">/50</span>
        </p>
        <p className="text-xs text-[#888] mt-1">
          Numaralar SHA-256 ile hash'lenerek saklanır; ham numara görüntülenemez.
        </p>
      </div>

      {/* Yeni numara girişi */}
      <div className="flex gap-2">
        <div
          className="flex items-center px-3 text-[#888] text-sm select-none flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
        >
          +90
        </div>
        <input
          type="tel"
          value={input}
          onChange={(e) => { setInput(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
          placeholder="5XX XXX XX XX"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="input-glass flex-1 px-4 py-3 text-sm"
        />
        <button
          onClick={handleAdd}
          disabled={totalCount >= 50}
          className="px-4 py-3 text-sm btn-grad disabled:opacity-50"
        >
          Ekle
        </button>
      </div>

      {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
      {totalCount >= 50 && <p className="text-[#ff6b6b] text-xs">Maksimum 50 numaraya ulaştınız.</p>}

      {/* Kaydedilmiş engeller (serverBlocks) */}
      {serverBlocks.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[#555] uppercase tracking-wide mb-1">Kayıtlı Engeller</p>
          {serverBlocks.map((b, i) => (
            <div key={b.id} className="flex items-center justify-between glass-card px-4 py-3">
              <div>
                <span className="text-sm text-[#f5f5f5]">Engellenen Numara #{i + 1}</span>
                <span className="block text-xs text-[#555] mt-0.5">
                  {new Date(b.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <button
                onClick={() => handleServerDelete(b.id)}
                disabled={deleting === b.id}
                className="text-xs text-[#888] hover:text-[#ff6b6b] transition-colors disabled:opacity-40"
              >
                {deleting === b.id ? '…' : 'Kaldır'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Yeni eklenenler (henüz kaydedilmedi) */}
      {localBlocks.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[#555] uppercase tracking-wide mb-1">Yeni Eklenenler</p>
          {localBlocks.map((b, i) => (
            <div key={b.id} className="flex items-center justify-between glass-card px-4 py-3" style={{ borderColor: 'rgba(192,57,43,0.2)' }}>
              <span className="text-sm text-[#888]">{b.display}</span>
              <button
                onClick={() => setLocalBlocks(prev => prev.filter(x => x.id !== b.id))}
                className="text-xs text-[#888] hover:text-[#ff6b6b] transition-colors"
              >
                Sil
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-[#555]">{localBlocks.length} numara bekliyor</p>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className="text-xs px-4 py-2 btn-grad disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor…' : saved ? '✓ Kaydedildi' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {serverBlocks.length === 0 && localBlocks.length === 0 && (
        <p className="text-sm text-[#555] text-center py-4">Henüz engellenen numara yok.</p>
      )}
    </div>
  );
}
