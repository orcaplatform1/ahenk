'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const SURFACE = '#0a1628';
const CARD    = '#0d1f3c';
const BORDER  = '#1a3a5c';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const RED     = '#ef4444';
const AMBER   = '#f59e0b';
const MALE_C   = '#4fc3f7';
const FEMALE_C = '#f48fb1';
const SANS    = 'Inter, system-ui, sans-serif';
const MONO    = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

const REFRESH_SEC = 30;

interface OpenParticipant { userId: string; initials: string; gender: string | null; age: number | null; isBot?: boolean; }
interface OpenTable {
  id: string; type: 'GROUP' | 'ONE_ON_ONE'; scheduledAt: string; city: string | null;
  maxParticipants: number; males: number; females: number; emptySeats: number;
  missing: { male: number; female: number };
  participants: OpenParticipant[];
}
interface WaitingUser { userId: string; initials: string; gender: string | null; age: number | null; city: string | null; cycleNo: number; }
interface OpenResponse { group: OpenTable[]; oneOnOne: OpenTable[]; kanka?: OpenTable[]; waiting: WaitingUser[]; }
interface BotOption { id: string; name: string; gender: string | null; age: number | null; }

const genderColor = (g: string | null) => (g === 'MALE' ? MALE_C : g === 'FEMALE' ? FEMALE_C : MUTED);
const genderShort = (g: string | null) => (g === 'MALE' ? 'E' : g === 'FEMALE' ? 'K' : '—');

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
}

const sectionTitle: React.CSSProperties = { margin: '0 0 10px', fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: MUTED };
const selectStyle: React.CSSProperties = {
  background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 10px',
  fontSize: 12, color: TEXT, outline: 'none', fontFamily: SANS, flex: 1, minWidth: 0,
};
const btnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
  fontSize: 11, fontWeight: 600, color: '#93c5fd', fontFamily: SANS, opacity: disabled ? 0.5 : 1, flexShrink: 0,
});

// Masaya / bekleyen kişiye bot ekleme (sadece SUPERADMIN): liste backend'de eksik cinsiyete göre süzülür
function BotPicker({ listUrl, placeUrl, onPlaced, onError }: { listUrl: string; placeUrl: string; onPlaced: () => void; onError: (m: string) => void }) {
  const [bots, setBots] = useState<BotOption[] | null>(null);
  const [botId, setBotId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get<BotOption[]>(listUrl).then(setBots).catch((e: Error) => { setBots([]); onError(e.message); }); }, [listUrl, onError]);

  async function place() {
    if (!botId) return;
    setSaving(true);
    try { await api.post(placeUrl, { botUserId: botId }); onPlaced(); }
    catch (e) { onError((e as Error).message); }
    finally { setSaving(false); }
  }

  if (bots === null) return <p style={{ margin: 0, fontSize: 11, color: MUTED }}>Botlar yükleniyor…</p>;
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <select value={botId} onChange={e => setBotId(e.target.value)} style={selectStyle}>
        <option value="">{bots.length ? 'Bot seçin' : 'Uygun bot yok'}</option>
        {bots.map(b => (
          <option key={b.id} value={b.id}>{b.name || b.id} ({genderShort(b.gender)}{b.age !== null ? `, ${b.age}` : ''})</option>
        ))}
      </select>
      <button onClick={place} disabled={saving || !botId} style={btnStyle(saving || !botId)}>{saving ? '…' : 'Ekle'}</button>
    </div>
  );
}

function TableCard({ t, isSuperadmin, onUserClick, onChanged, onError }: {
  t: OpenTable; isSuperadmin: boolean; onUserClick: (id: string) => void; onChanged: () => void; onError: (m: string) => void;
}) {
  const [botOpen, setBotOpen] = useState(false);
  const missing = [t.missing.male ? `${t.missing.male} E` : '', t.missing.female ? `${t.missing.female} K` : ''].filter(Boolean).join(' + ');
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{t.city ?? 'Şehir yok'} · {fmtDate(t.scheduledAt)}</span>
        <span style={{ fontSize: 11, fontFamily: MONO, color: MUTED }}>
          <span style={{ color: MALE_C }}>{t.males}E</span> · <span style={{ color: FEMALE_C }}>{t.females}K</span> · {t.participants.length}/{t.maxParticipants}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {t.participants.map(p => (
          <button
            key={p.userId}
            onClick={() => onUserClick(p.userId)}
            title="Kullanıcı detayı"
            style={{
              padding: '4px 10px', borderRadius: 99, cursor: 'pointer', fontSize: 11, fontFamily: MONO,
              background: 'transparent', border: `1px solid ${genderColor(p.gender)}`, color: TEXT,
            }}
          >
            {p.initials}{p.age !== null ? ` ${p.age}` : ''}{p.isBot ? ' · bot' : ''}
          </button>
        ))}
        {Array.from({ length: t.emptySeats }, (_, i) => (
          <span key={`e${i}`} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, color: MUTED, border: `1px dashed ${BORDER}` }}>boş</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: MUTED, flexWrap: 'wrap', alignItems: 'center' }}>
        <span>{t.emptySeats > 0 ? `${t.emptySeats} boş koltuk` : 'Dolu'}</span>
        {missing && <span style={{ color: AMBER }}>Eksik: {missing}</span>}
        {isSuperadmin && t.emptySeats > 0 && (
          <button onClick={() => setBotOpen(o => !o)} style={{ ...btnStyle(false), marginLeft: 'auto' }}>{botOpen ? 'Kapat' : 'Bot ekle'}</button>
        )}
      </div>
      {botOpen && (
        <div style={{ marginTop: 10 }}>
          <BotPicker
            listUrl={`/admin/matches/${t.id}/bots`}
            placeUrl={`/admin/matches/${t.id}/bot`}
            onPlaced={() => { setBotOpen(false); onChanged(); }}
            onError={onError}
          />
        </div>
      )}
    </div>
  );
}

function WaitingRow({ w, isSuperadmin, onUserClick, onChanged, onError }: {
  w: WaitingUser; isSuperadmin: boolean; onUserClick: (id: string) => void; onChanged: () => void; onError: (m: string) => void;
}) {
  const [botOpen, setBotOpen] = useState(false);
  const first = w.cycleNo === 1;
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => onUserClick(w.userId)}
          style={{ padding: '4px 10px', borderRadius: 99, cursor: 'pointer', fontSize: 11, fontFamily: MONO, background: 'transparent', border: `1px solid ${genderColor(w.gender)}`, color: TEXT }}
        >
          {w.initials} {genderShort(w.gender)}{w.age !== null ? ` ${w.age}` : ''}
        </button>
        <span style={{ fontSize: 11, color: MUTED }}>{w.city ?? 'Şehir yok'}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: first ? AMBER : TEXT }}>
          {w.cycleNo}. döngü{first ? ' — ilk döngüde bot eklenmez' : ''}
        </span>
        {isSuperadmin && (
          <button onClick={() => setBotOpen(o => !o)} style={{ ...btnStyle(false), marginLeft: 'auto' }}>{botOpen ? 'Kapat' : 'Bot ile masa kur'}</button>
        )}
      </div>
      {botOpen && (
        <div style={{ marginTop: 10 }}>
          <BotPicker
            listUrl={`/admin/matches/waiting/${w.userId}/bots`}
            placeUrl={`/admin/matches/waiting/${w.userId}/bot`}
            onPlaced={() => { setBotOpen(false); onChanged(); }}
            onError={onError}
          />
        </div>
      )}
    </div>
  );
}

// Bu haftanın kapanmamış grup ve başbaşa masaları + başbaşada eşi bekleyenler; 30 sn'de bir yenilenir
export function AdminOpenTables({ isSuperadmin, onUserClick }: { isSuperadmin: boolean; onUserClick: (userId: string) => void }) {
  const [data, setData] = useState<OpenResponse | null>(null);
  const [error, setError] = useState('');
  const [left, setLeft] = useState(REFRESH_SEC);

  const load = useCallback(() => {
    api.get<OpenResponse>('/admin/matches/open')
      .then(d => { setData(d); setError(''); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLeft(REFRESH_SEC));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => setLeft(s => s - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (left <= 0) load(); }, [left, load]);

  const onError = useCallback((m: string) => setError(m), []);
  const common = { isSuperadmin, onUserClick, onChanged: load, onError };

  return (
    <div style={{ fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>Yenileme: {Math.max(0, left)} sn</span>
        <div style={{ flex: 1, height: 3, background: SURFACE, borderRadius: 99, overflow: 'hidden', maxWidth: 160 }}>
          <div style={{ width: `${(Math.max(0, left) / REFRESH_SEC) * 100}%`, height: '100%', background: '#3b82f6', transition: 'width 1s linear' }} />
        </div>
        <button onClick={load} style={btnStyle(false)}>Şimdi yenile</button>
      </div>

      {error && <p style={{ margin: '0 0 12px', fontSize: 12, color: RED }}>{error}</p>}
      {!data ? (
        <p style={{ fontSize: 12, color: MUTED }}>Yükleniyor…</p>
      ) : (
        <>
          <p style={sectionTitle}>GRUP MASALARI ({data.group.length})</p>
          <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
            {data.group.length === 0 && <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Açık grup masası yok</p>}
            {data.group.map(t => <TableCard key={t.id} t={t} {...common} />)}
          </div>

          <p style={sectionTitle}>BAŞBAŞA MASALARI ({data.oneOnOne.length})</p>
          <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
            {data.oneOnOne.length === 0 && <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Kurulmuş başbaşa masası yok</p>}
            {data.oneOnOne.map(t => <TableCard key={t.id} t={t} {...common} />)}
          </div>

          {/* Kankamla: 4 kişi (2E + 2K) — bot eklenmez */}
          <p style={sectionTitle}>KANKAMLA MASALARI ({data.kanka?.length ?? 0})</p>
          <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
            {(data.kanka?.length ?? 0) === 0 && <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Kurulmuş Kankamla masası yok</p>}
            {(data.kanka ?? []).map(t => <TableCard key={t.id} t={t} {...common} />)}
          </div>

          <p style={sectionTitle}>BAŞBAŞA — EŞİ BEKLEYENLER ({data.waiting.length})</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {data.waiting.length === 0 && <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Eşi bekleyen yok</p>}
            {data.waiting.map(w => <WaitingRow key={w.userId} w={w} {...common} />)}
          </div>
        </>
      )}
    </div>
  );
}
