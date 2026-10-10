'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';

interface ContactBlock { id: string; phoneHash: string; }

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function TabRehber() {
  const [blocks, setBlocks] = useState<ContactBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  useEffect(() => {
    api.get<ContactBlock[]>('/contact-blocks')
      .then(setBlocks)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    const digits = input.replace(/\D/g, '');
    if (digits.length !== 10) { setError('10 haneli numara girin.'); return; }
    if (blocks.length >= 50) { setError('En fazla 50 numara ekleyebilirsiniz.'); return; }
    setAdding(true); setError('');
    try {
      const hash = await sha256(`+90${digits}`);
      await api.post('/contact-blocks/sync', { phoneHashes: [hash] });
      const updated = await api.get<ContactBlock[]>('/contact-blocks');
      setBlocks(updated);
      setInput('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id); setError('');
    try {
      await api.delete(`/contact-blocks/${id}`);
      setBlocks((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId('');
    }
  }

  if (loading) return <SkeletonBlock lines={4} />;

  return (
    <div className="flex flex-col gap-5">
      <div className="glass-card p-5">
        <p className="text-sm text-[#888] mb-1">Engellenen numaralar</p>
        <p className="text-2xl font-semibold text-[#f5f5f5]">{blocks.length}<span className="text-sm font-normal text-[#888]">/50</span></p>
        <p className="text-xs text-[#888] mt-1">Numaralar şifrelenmiş olarak saklanır; ham numara görüntülenemez.</p>
      </div>

      <div className="flex gap-2">
        <div className="flex items-center input-glass px-3 text-[#888] text-sm select-none w-auto" style={{ borderRadius: 12 }}>+90</div>
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
          disabled={adding || blocks.length >= 50}
          className="px-4 py-3 text-sm btn-grad"
        >
          {adding ? '…' : 'Ekle'}
        </button>
      </div>

      {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
      {blocks.length >= 50 && <p className="text-[#ff6b6b] text-xs">Maksimum 50 numaraya ulaştınız.</p>}

      {blocks.length > 0 && (
        <div className="flex flex-col gap-2">
          {blocks.map((b, i) => (
            <div key={b.id} className="flex items-center justify-between glass-card px-4 py-3">
              <span className="text-sm text-[#888] font-mono">#{i + 1} — {b.phoneHash.slice(0, 16)}…</span>
              <button
                onClick={() => handleDelete(b.id)}
                disabled={deletingId === b.id}
                className="text-xs text-[#888] hover:text-[#ff6b6b] transition-colors disabled:opacity-50"
              >
                {deletingId === b.id ? '…' : 'Sil'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
