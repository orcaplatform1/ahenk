'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

const TOPICS_LIST = ['Teknoloji','Sanat','Spor','Seyahat','Müzik','Sinema','Edebiyat','Gastronomi','Girişimcilik','Bilim'];

interface Bot {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  profile?: { gender?: string; primaryCity?: { name: string } };
  oceanScore?: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number };
}

interface City { id: string; name: string; }

interface BotForm {
  firstName: string; lastName: string; gender: string; cityId: string;
  openness: string; conscientiousness: string; extraversion: string; agreeableness: string; neuroticism: string;
  topics: string[];
}

const EMPTY: BotForm = { firstName: '', lastName: '', gender: 'MALE', cityId: '', openness: '50', conscientiousness: '50', extraversion: '50', agreeableness: '50', neuroticism: '50', topics: [] };

export default function BotlarPage() {
  const toast = useToast();
  const [bots, setBots] = useState<Bot[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<BotForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<Bot[]>('/matching/admin/bots'),
      api.get<City[]>('/admin/cities'),
    ]).then(([b, c]) => { setBots(b); setCities(c); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function set<K extends keyof BotForm>(k: K, v: BotForm[K]) { setForm((p) => ({ ...p, [k]: v })); }

  async function handleCreate() {
    if (!form.firstName || !form.lastName || !form.cityId) { toast.error('Ad, soyad ve şehir zorunlu.'); return; }
    setSaving(true);
    try {
      await api.post('/matching/admin/bots', {
        firstName: form.firstName, lastName: form.lastName,
        gender: form.gender, primaryCityId: form.cityId,
        oceanScore: {
          openness: Number(form.openness), conscientiousness: Number(form.conscientiousness),
          extraversion: Number(form.extraversion), agreeableness: Number(form.agreeableness),
          neuroticism: Number(form.neuroticism),
        },
        topics: form.topics,
      });
      toast.success('Bot oluşturuldu.');
      setModal(false); setForm(EMPTY); load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  async function toggleStatus(bot: Bot) {
    setToggling(bot.id);
    try {
      await api.patch(`/matching/admin/bots/${bot.id}/status`, { isActive: !bot.isActive });
      toast.success(bot.isActive ? 'Bot pasife alındı.' : 'Bot aktif edildi.');
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setToggling(''); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu botu silmek istiyor musunuz?')) return;
    try {
      await api.delete(`/matching/admin/bots/${id}`);
      toast.success('Bot silindi.'); load();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl">Botlar</h1>
        <button onClick={() => { setModal(true); setForm(EMPTY); }}
          className="px-4 py-2 bg-primary hover:bg-primary-hover rounded-xl text-sm font-medium transition-colors">
          + Yeni Bot
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-surface rounded-xl animate-pulse" />)}</div>
      ) : bots.length === 0 ? <p className="text-muted text-sm">Bot yok.</p> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted text-xs uppercase">
              <th className="text-left py-3 px-2">Ad Soyad</th>
              <th className="text-left py-3 px-2">Cinsiyet</th>
              <th className="text-left py-3 px-2">Şehir</th>
              <th className="text-left py-3 px-2">Durum</th>
              <th className="py-3 px-2" />
            </tr>
          </thead>
          <tbody>
            {bots.map((b) => (
              <tr key={b.id} className="border-b border-border hover:bg-surface/50 transition-colors">
                <td className="py-3 px-2">{b.firstName} {b.lastName}</td>
                <td className="py-3 px-2 text-muted">{b.profile?.gender === 'MALE' ? 'Erkek' : 'Kadın'}</td>
                <td className="py-3 px-2 text-muted">{b.profile?.primaryCity?.name ?? '—'}</td>
                <td className="py-3 px-2">
                  <button onClick={() => toggleStatus(b)} disabled={toggling === b.id}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors disabled:opacity-50 ${b.isActive ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-bg text-muted border-border'}`}>
                    {toggling === b.id ? '…' : b.isActive ? 'Aktif' : 'Pasif'}
                  </button>
                </td>
                <td className="py-3 px-2 text-right">
                  <button onClick={() => handleDelete(b.id)} className="text-xs text-muted hover:text-accent transition-colors">Sil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Yeni Bot">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <F label="Ad" value={form.firstName} onChange={(v) => set('firstName', v)} />
            <F label="Soyad" value={form.lastName} onChange={(v) => set('lastName', v)} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Cinsiyet</label>
            <select value={form.gender} onChange={(e) => set('gender', e.target.value)} className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none">
              <option value="MALE">Erkek</option>
              <option value="FEMALE">Kadın</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Şehir</label>
            <select value={form.cityId} onChange={(e) => set('cityId', e.target.value)} className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none">
              <option value="">Seç</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <p className="text-xs text-muted uppercase mt-1">OCEAN Skorları (0-100)</p>
          <div className="grid grid-cols-5 gap-2">
            {(['openness','conscientiousness','extraversion','agreeableness','neuroticism'] as const).map((k) => (
              <div key={k}>
                <label className="block text-xs text-muted mb-1 truncate">{k.slice(0,3).toUpperCase()}</label>
                <input type="number" min={0} max={100} value={form[k]} onChange={(e) => set(k, e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text focus:outline-none" />
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs text-muted mb-2">Konu Tercihleri</p>
            <div className="flex flex-wrap gap-1.5">
              {TOPICS_LIST.map((t) => (
                <button key={t} type="button" onClick={() => set('topics', form.topics.includes(t) ? form.topics.filter((x) => x !== t) : [...form.topics, t])}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${form.topics.includes(t) ? 'bg-primary border-primary text-white' : 'bg-bg border-border text-muted'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleCreate} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-sm font-medium disabled:opacity-50">
            {saving ? 'Kaydediliyor…' : 'Oluştur'}
          </button>
        </div>
      </Modal>
    </AdminShell>
  );
}

function F({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary" />
    </div>
  );
}
