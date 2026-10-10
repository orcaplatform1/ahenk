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
      <div className="bg-surface border border-border rounded-2xl p-5">
        <p className="text-sm text-muted mb-1">Engellenen numaralar</p>
        <p className="text-2xl font-semibold text-text">{blocks.length}<span className="text-sm font-normal text-muted">/50</span></p>
        <p className="text-xs text-muted mt-1">Numaralar şifrelenmiş olarak saklanır; ham numara görüntülenemez.</p>
      </div>

      <div className="flex gap-2">
        <div className="flex items-center bg-surface border border-border rounded-xl px-3 text-muted text-sm select-none">+90</div>
        <input
          type="tel"
          value={input}
          onChange={(e) => { setInput(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
          placeholder="5XX XXX XX XX"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-primary"
        />
        <button
          onClick={handleAdd}
          disabled={adding || blocks.length >= 50}
          className="px-4 py-3 bg-primary hover:bg-primary-hover rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          {adding ? '…' : 'Ekle'}
        </button>
      </div>

      {error && <p className="text-accent text-sm">{error}</p>}
      {blocks.length >= 50 && <p className="text-accent text-xs">Maksimum 50 numaraya ulaştınız.</p>}

      {blocks.length > 0 && (
        <div className="flex flex-col gap-2">
          {blocks.map((b, i) => (
            <div key={b.id} className="flex items-center justify-between bg-surface border border-border rounded-xl px-4 py-3">
              <span className="text-sm text-muted font-mono">#{i + 1} — {b.phoneHash.slice(0, 16)}…</span>
              <button
                onClick={() => handleDelete(b.id)}
                disabled={deletingId === b.id}
                className="text-xs text-muted hover:text-accent transition-colors disabled:opacity-50"
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
