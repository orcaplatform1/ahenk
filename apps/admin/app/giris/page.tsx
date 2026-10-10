'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface LoginResponse { accessToken: string; user: { role: string } }

export default function GirisPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email || !password) { setError('E-posta ve şifre girin.'); return; }
    setLoading(true); setError('');
    try {
      const data = await api.post<LoginResponse>('/auth/login', { email, password });
      if (data.user.role !== 'ADMIN' && data.user.role !== 'SUPERADMIN') {
        setError('Bu panele erişim yetkiniz yok.');
        return;
      }
      api.setToken(data.accessToken);
      router.push('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-3xl mb-1">Ahenk Admin</h1>
        <p className="text-muted text-sm mb-8">Yönetim paneliyle devam edin.</p>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-muted mb-2">E-posta</label>
            <input
              type="email" value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-text"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-2">Şifre</label>
            <input
              type="password" value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-text"
            />
          </div>
          {error && <p className="text-accent text-sm">{error}</p>}
          <button
            onClick={handleLogin} disabled={loading}
            className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </div>
      </div>
    </div>
  );
}
