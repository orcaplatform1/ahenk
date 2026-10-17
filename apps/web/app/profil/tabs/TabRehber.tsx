'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface ServerBlock { id: string; hashedPhone?: string; createdAt: string; }

const LS_KEY = 'ahenk_contact_block_map';

function loadHashMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'); } catch { return {}; }
}
function saveHashMap(map: Record<string, string>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)); } catch {}
}

async function sha256hex(text: string): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

export function TabRehber() {
  const [serverBlocks, setServerBlocks] = useState<ServerBlock[]>([]);
  const [hashMap, setHashMap] = useState<Record<string, string>>({});
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  function loadBlocks() {
    api.get<{ count: number; items: ServerBlock[] }>('/contact-blocks')
      .then(r => setServerBlocks(r.items ?? []))
      .catch(() => {});
  }

  useEffect(() => {
    setHashMap(loadHashMap());
    loadBlocks();
  }, []);

  async function handleAdd() {
    const digits = input.replace(/\D/g, '');
    if (digits.length !== 10) { setError('10 haneli numara girin.'); return; }
    if (serverBlocks.length >= 50) { setError('En fazla 50 numara ekleyebilirsiniz.'); return; }
    const display = `+90${digits}`;
    setAdding(true); setError('');
    try {
      const h = await sha256hex(display);
      if (!h) { setError("Hash'lenemedi. HTTPS bağlantısı gereklidir."); return; }
      const map = loadHashMap();
      map[h] = display;
      saveHashMap(map);
      setHashMap({ ...map });
      await api.post('/contact-blocks/sync', { hashedPhones: [h] });
      setInput('');
      loadBlocks();
    } catch (e) { setError((e as Error).message); }
    finally { setAdding(false); }
  }

  async function handleServerDelete(b: ServerBlock) {
    setDeleting(b.id);
    try {
      await api.delete(`/contact-blocks/${b.id}`);
      setServerBlocks(prev => prev.filter(x => x.id !== b.id));
      if (b.hashedPhone) {
const map = loadHashMap();
        delete map[b.hashedPhone!];
        saveHashMap(map);
        setHashMap({ ...map });
      }
    } catch (e) { setError((e as Error).message); }
    finally { setDeleting(null); }
  }

  function resolveDisplay(b: ServerBlock, i: number): string {
    if (b.hashedPhone && hashMap[b.hashedPhone]) return hashMap[b.hashedPhone];
    return `Engellenen Numara #${i + 1}`;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Sayaç */}
      <div className="glass-card p-5">
        <p className="text-sm text-[#888] mb-1">Engellenen numaralar</p>
        <p className="text-2xl font-semibold text-[#f5f5f5]">
          {serverBlocks.length}<span className="text-sm font-normal text-[#888]">/50</span>
        </p>
        <p className="text-xs text-[#888] mt-1">
          Numaralar SHA-256 ile hash'lenerek saklanır; ham numara sunucuda tutulmaz.
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
          disabled={adding || serverBlocks.length >= 50}
          className="px-4 py-3 text-sm btn-grad disabled:opacity-50"
        >
          {adding ? '…' : 'Ekle'}
        </button>
      </div>

      {error && <p className="text-[#ff6b6b] text-sm">{error}</p>}
      {serverBlocks.length >= 50 && <p className="text-[#ff6b6b] text-xs">Maksimum 50 numaraya ulaştınız.</p>}

      {/* Kaydedilmiş engeller */}
      {serverBlocks.length > 0 && (
        <div className="flex flex-col gap-2">
          {serverBlocks.map((b, i) => (
            <div key={b.id} className="flex items-center justify-between glass-card px-4 py-3">
              <div>
                <span className="text-sm text-[#f5f5f5]">{resolveDisplay(b, i)}</span>
                <span className="block text-xs text-[#555] mt-0.5">
                  {new Date(b.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <button
                onClick={() => handleServerDelete(b)}
                disabled={deleting === b.id}
                className="text-xs text-[#888] hover:text-[#ff6b6b] transition-colors disabled:opacity-40"
              >
                {deleting === b.id ? '…' : 'Sil'}
              </button>
            </div>
          ))}
        </div>
      )}

      {serverBlocks.length === 0 && (
        <p className="text-sm text-[#555] text-center py-4">Henüz engellenen numara yok.</p>
      )}
    </div>
  );
}
