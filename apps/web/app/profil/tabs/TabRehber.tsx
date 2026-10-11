'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface LocalBlock { id: string; display: string; hashed?: string; }

async function sha256hex(text: string): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

export function TabRehber() {
  const [blocks, setBlocks] = useState<LocalBlock[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverCount, setServerCount] = useState<number | null>(null);

  useEffect(() => {
    api.get<{ count: number }>('/contact-blocks')
      .then(r => setServerCount(r.count))
      .catch(() => {});
  }, []);

  function handleAdd() {
    const digits = input.replace(/\D/g, '');
    if (digits.length !== 10) { setError('10 haneli numara girin.'); return; }
    if (blocks.length >= 50) { setError('En fazla 50 numara ekleyebilirsiniz.'); return; }
    const display = `+90${digits}`;
    if (blocks.some(b => b.display === display)) { setError('Bu numara zaten eklenmiş.'); return; }
    setBlocks(prev => [...prev, { id: `${Date.now()}`, display }]);
    setInput('');
    setError('');
    setSaved(false);
  }

  function handleDelete(id: string) {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setSaved(false);
  }

  async function handleSave() {
    if (blocks.length === 0) { setError('Eklenecek numara yok.'); return; }
    setSaving(true); setError('');
    try {
      const hashes = (await Promise.all(
        blocks.map(b => sha256hex(b.display))
      )).filter((h): h is string => h !== null);

      if (hashes.length === 0) {
        setError('Numaralar hash\'lenemedi. HTTPS bağlantısı gereklidir.');
        return;
      }

      await api.post('/contact-blocks/sync', { hashedPhones: hashes });
      setSaved(true);
      const r = await api.get<{ count: number }>('/contact-blocks');
      setServerCount(r.count);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  const displayCount = serverCount !== null ? serverCount : blocks.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="glass-card p-5">
        <p className="text-sm text-[#888] mb-1">Engellenen numaralar</p>
        <p className="text-2xl font-semibold text-[#f5f5f5]">
          {displayCount}<span className="text-sm font-normal text-[#888]">/50</span>
        </p>
        <p className="text-xs text-[#888] mt-1">
          Numaralar SHA-256 ile hash'lenerek saklanır; ham numara görüntülenemez.
        </p>
      </div>

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
          disabled={blocks.length >= 50}
          className="px-4 py-3 text-sm btn-grad disabled:opacity-50"
        >
          Ekle
        </button>
      </div>

      {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
      {blocks.length >= 50 && <p className="text-[#ff6b6b] text-xs">Maksimum 50 numaraya ulaştınız.</p>}

      {blocks.length > 0 && (
        <div className="flex flex-col gap-2">
          {blocks.map((b, i) => (
            <div key={b.id} className="flex items-center justify-between glass-card px-4 py-3">
              <span className="text-sm text-[#888]">#{i + 1} — {b.display}</span>
              <button
                onClick={() => handleDelete(b.id)}
                className="text-xs text-[#888] hover:text-[#ff6b6b] transition-colors"
              >
                Sil
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#555]">{blocks.length} numara listeye eklendi (henüz kaydedilmedi)</p>
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
    </div>
  );
}
