'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';

// Profilim → "Aktif Kankanız" (Kankamla). Davet telefonla yapılır; davet linki her zaman kopyalanabilir gösterilir
// (WhatsApp ulaşmazsa davet eden kendisi iletebilir). Pencereler sayfanın üst katmanında açılır.

const MALE_CLR = '#4fc3f7';
const FEMALE_CLR = '#f48fb1';

type Gender = 'MALE' | 'FEMALE' | null;
interface KankaState {
  kanka: { initials: string; gender: Gender; since: string; locked: boolean; lockReason: string | null } | null;
  outgoingInvite: { link: string; expiresAt: string; expired: boolean } | null;
  incomingInvites: { id: string; inviterInitials: string; inviterGender: Gender; expiresAt: string }[];
  kankamla: { role: 'BUYER' | 'KANKA'; rightsLeft: number; cycles: number; packageCycles: number } | null;
  canInvite: boolean;
  kycApproved: boolean;
}

function Bubble({ initials, gender, size = 40 }: { initials: string; gender: Gender; size?: number }) {
  const clr = gender === 'FEMALE' ? FEMALE_CLR : MALE_CLR;
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', border: `2px solid ${clr}`, display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center', fontSize: size > 40 ? 15 : 12, fontWeight: 700, color: '#f5f5f5',
      background: 'rgba(255,255,255,0.06)', flexShrink: 0,
    }}>{initials}</span>
  );
}

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '24px 20px 36px', maxWidth: 560, margin: '0 auto' }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(link); } catch {
      const t = document.createElement('textarea'); t.value = link; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch { /* */ } t.remove();
    }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 12px' }}>
      <span style={{ flex: 1, fontSize: 12, color: '#bbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link}</span>
      <button onClick={copy} aria-label="Linki kopyala" style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#4ade80' : '#f5f5f5', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: 2 }}>
        {copied ? 'Kopyalandı ✓' : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}

function hoursLeft(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3600000));
}

export function KankaSection() {
  const [state, setState] = useState<KankaState | null>(null);
  const [sheet, setSheet] = useState<'invite' | 'incoming' | 'kanka' | null>(null);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [sentLink, setSentLink] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<KankaState>('/kanka/me').then(setState).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!state) return null;
  const incoming = state.incomingInvites[0];

  async function sendInvite() {
    if (phone.length !== 10 || !phone.startsWith('5')) { setMsg('5 ile başlayan 10 haneli numara girin.'); return; }
    setBusy(true); setMsg('');
    try {
      const r = await api.post<{ link: string }>('/kanka/invite', { phone: `+90${phone}` });
      setSentLink(r.link); setPhone(''); load();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  async function respond(action: 'accept' | 'decline') {
    if (!incoming) return;
    setBusy(true); setMsg('');
    try {
      await api.post(`/kanka/invites/${incoming.id}/${action}`, {});
      setSheet(null); load();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  async function unlink() {
    setBusy(true); setMsg('');
    try { await api.post('/kanka/unlink', {}); setSheet(null); load(); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  const open = (s: 'invite' | 'incoming' | 'kanka') => { setMsg(''); setSentLink(null); setSheet(s); };

  const pillBtn = 'px-4 py-1.5 rounded-full text-xs font-semibold';

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#f5f5f5]">Aktif Kankanız</span>
        {state.kanka ? (
          <button onClick={() => open('kanka')} aria-label="Kanka" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <Bubble initials={state.kanka.initials} gender={state.kanka.gender} />
          </button>
        ) : incoming ? (
          <button onClick={() => open('incoming')} className={pillBtn} style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.45)', color: '#4ade80' }}>
            Davet Var
          </button>
        ) : (
          <button onClick={() => open('invite')} className={pillBtn} style={{ background: 'rgba(192,57,43,0.18)', border: '1px solid rgba(192,57,43,0.5)', color: '#ff6b6b' }}>
            Davet Et
          </button>
        )}
      </div>

      {!state.kanka && state.outgoingInvite && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[#888]">
            {state.outgoingInvite.expired
              ? 'Gönderdiğin davetin süresi doldu. "Davet Et" ile tekrar gönderebilirsin.'
              : `Davetin gönderildi · ${hoursLeft(state.outgoingInvite.expiresAt)} saat geçerli. WhatsApp ulaşmazsa linki kendin ilet:`}
          </p>
          {!state.outgoingInvite.expired && <CopyLink link={state.outgoingInvite.link} />}
        </div>
      )}

      {state.kankamla && (
        <p className="text-xs text-[#888]">
          Kankamla: {state.kankamla.rightsLeft} masa hakkı kaldı · {state.kankamla.cycles}/{state.kankamla.packageCycles} döngü
          {state.kankamla.role === 'KANKA' ? ' (paket kankanda, sen ücretsiz katılıyorsun)' : ''}
        </p>
      )}

      {/* Sistemi anlatan kart */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#c0392b', margin: '0 0 6px' }}>KANKAMLA NASIL İŞLER?</p>
        <p style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6, margin: 0 }}>
          Aynı cinsiyetten, kimliği doğrulanmış bir arkadaşını kanka olarak davet et. Kankamla paketini <strong style={{ color: '#f5f5f5' }}>sadece birinizin alması yeterli</strong>; kankan ücretsiz katılır.
          Paket 2 masa hakkı verir ve her hak 4 döngü geçerlidir. İkiniz, karşı cinsten bir kanka çiftiyle Pazar akşamı 4 kişilik masada buluşursunuz.
          Davet 48 saat geçerlidir; kanka seçildiği hafta değiştirilemez.
        </p>
      </div>

      {sheet === 'invite' && (
        <Sheet onClose={() => setSheet(null)}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f5', marginBottom: 8 }}>Kanka Davet Et</p>
          {!state.kycApproved ? (
            <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>Kanka davet etmek için önce kimlik doğrulamanı (KYC) tamamlamalısın.</p>
          ) : sentLink ? (
            <div className="flex flex-col gap-3">
              <p style={{ fontSize: 13, color: '#4ade80' }}>Davet gönderildi. 48 saat geçerli.</p>
              <p style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>Davet WhatsApp ile iletildi. Ulaşmazsa bu linki kopyalayıp kankana kendin gönder:</p>
              <CopyLink link={sentLink} />
              <button onClick={() => setSheet(null)} className="btn-ghost justify-center">Tamam</button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>Kankan aynı cinsiyetten olmalı ve kimliğini doğrulamış olmalı. Davet 48 saat geçerlidir.</p>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '0 14px' }}>
                <span style={{ color: '#555', fontSize: 14, marginRight: 4 }}>+90</span>
                <input type="tel" inputMode="numeric" placeholder="5XX XXX XX XX" value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#f5f5f5', padding: '11px 0' }} />
              </div>
              {msg && <p style={{ fontSize: 12, color: '#ff6b6b' }}>{msg}</p>}
              <div className="flex gap-2">
                <button onClick={() => setSheet(null)} className="flex-1 btn-ghost justify-center">Vazgeç</button>
                <button onClick={sendInvite} disabled={busy} className="flex-1 btn-primary justify-center disabled:opacity-50">{busy ? '…' : 'Davet Gönder'}</button>
              </div>
            </div>
          )}
        </Sheet>
      )}

      {sheet === 'incoming' && incoming && (
        <Sheet onClose={() => setSheet(null)}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f5', marginBottom: 14 }}>{state.incomingInvites.length} aktif davetiniz var.</p>
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <Bubble initials={incoming.inviterInitials} gender={incoming.inviterGender} size={48} />
            <p style={{ fontSize: 14, color: '#ccc', lineHeight: 1.5 }}>
              <strong style={{ color: '#f5f5f5' }}>{incoming.inviterInitials}</strong> sizi kanka olmak için davet etti.
            </p>
          </div>
          {!state.kycApproved && <p style={{ fontSize: 12, color: '#f59e0b', marginBottom: 10 }}>Kabul etmek için önce kimlik doğrulamanı (KYC) tamamlamalısın.</p>}
          {msg && <p style={{ fontSize: 12, color: '#ff6b6b', marginBottom: 10 }}>{msg}</p>}
          <div className="flex flex-col gap-2">
            <button onClick={() => respond('accept')} disabled={busy} className="btn-primary justify-center disabled:opacity-50">{busy ? '…' : 'Kabul Et'}</button>
            <button onClick={() => respond('decline')} disabled={busy} className="btn-ghost justify-center">Vazgeç</button>
          </div>
        </Sheet>
      )}

      {sheet === 'kanka' && state.kanka && (
        <Sheet onClose={() => setSheet(null)}>
          <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
            <Bubble initials={state.kanka.initials} gender={state.kanka.gender} size={48} />
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f5' }}>Kankan</p>
              <p style={{ fontSize: 12, color: '#888' }}>{new Date(state.kanka.since).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' })} tarihinden beri</p>
            </div>
          </div>
          {state.kanka.locked ? (
            <p style={{ fontSize: 12, color: '#f59e0b', marginBottom: 12, lineHeight: 1.5 }}>{state.kanka.lockReason}</p>
          ) : (
            <p style={{ fontSize: 12, color: '#888', marginBottom: 12, lineHeight: 1.5 }}>Kankalıktan çıkarsan Kankamla masalarına birlikte katılamazsınız. İstersen daha sonra tekrar kanka olabilirsiniz.</p>
          )}
          {msg && <p style={{ fontSize: 12, color: '#ff6b6b', marginBottom: 10 }}>{msg}</p>}
          <div className="flex gap-2">
            <button onClick={() => setSheet(null)} className="flex-1 btn-ghost justify-center">Kapat</button>
            {!state.kanka.locked && (
              <button onClick={unlink} disabled={busy}
                className="flex-1 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
                style={{ border: '1px solid rgba(192,57,43,0.6)', color: '#e74c3c', background: 'rgba(192,57,43,0.06)' }}>
                {busy ? '…' : 'Kankalıktan Çıkar'}
              </button>
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}
