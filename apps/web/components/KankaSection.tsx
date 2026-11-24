'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DEFAULT_PHONE_COUNTRY, formatNamed, toE164, type Lang } from '@ahenk/shared';
import { CountryCodeButton } from '@/components/PhoneCountryField';
import { api } from '@/lib/api';
import { StdButton } from '@ahenk/ui';

// Profilim → t('kanka.activeKanka') (Kankamla). Davet telefonla yapılır; davet linki her zaman kopyalanabilir gösterilir
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
  const t = useTranslations();
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
      <button onClick={copy} aria-label={t('kanka.copyLink')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#4ade80' : '#f5f5f5', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: 2 }}>
        {copied ? t('kanka.copied') : (
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
  const t = useTranslations();
  const locale = useLocale() as Lang;
  const [state, setState] = useState<KankaState | null>(null);
  const [sheet, setSheet] = useState<'invite' | 'incoming' | 'kanka' | null>(null);
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [sentLink, setSentLink] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<KankaState>('/kanka/me').then(setState).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  // Bekleyen davetin 48 saati dolunca buton kendiliğinden t('kanka.invite') olur (süre bitiminde durum yeniden yüklenir)
  const pendingUntil = state?.outgoingInvite && !state.outgoingInvite.expired ? state.outgoingInvite.expiresAt : null;
  useEffect(() => {
    if (!pendingUntil) return;
    const t = setTimeout(load, Math.max(0, new Date(pendingUntil).getTime() - Date.now()) + 1000);
    return () => clearTimeout(t);
  }, [pendingUntil, load]);

  if (!state) return null;
  const incoming = state.incomingInvites[0];

  async function sendInvite() {
    const phoneE164 = toE164(country, phone);
    if (!phoneE164) { setMsg(t('phone.invalid')); return; }
    setBusy(true); setMsg('');
    try {
      const r = await api.post<{ link: string }>('/kanka/invite', { phone: phoneE164 });
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
  async function cancelInvite() {
    setBusy(true);
    try { await api.post('/kanka/invite/cancel', {}); } catch { /* durum yeniden yüklenir */ } finally { setBusy(false); load(); }
  }
  const open = (s: 'invite' | 'incoming' | 'kanka') => { setMsg(''); setSentLink(null); setSheet(s); };

  const pillBtn = 'px-4 py-1.5 rounded-full text-xs font-semibold';

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#f5f5f5]">{t('kanka.activeKanka')}</span>
        {state.kanka ? (
          <button onClick={() => open('kanka')} aria-label={t('kanka.ariaKanka')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <Bubble initials={state.kanka.initials} gender={state.kanka.gender} />
          </button>
        ) : incoming ? (
          <button onClick={() => open('incoming')} className={pillBtn} style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.45)', color: '#4ade80' }}>
            {t('kanka.hasInvite')}
          </button>
        ) : pendingUntil ? (
          <button onClick={cancelInvite} disabled={busy} className={`${pillBtn} disabled:opacity-50`} style={{ background: 'rgba(192,57,43,0.18)', border: '1px solid rgba(192,57,43,0.5)', color: '#ff6b6b' }}>
            {t('kanka.cancelInvite')}
          </button>
        ) : (
          <button onClick={() => open('invite')} className={pillBtn} style={{ background: 'rgba(192,57,43,0.18)', border: '1px solid rgba(192,57,43,0.5)', color: '#ff6b6b' }}>
            {t('kanka.invite')}
          </button>
        )}
      </div>

      {!state.kanka && state.outgoingInvite && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[#888]">
            {state.outgoingInvite.expired
              ? t('kanka.inviteExpired')
              : t('kanka.inviteSent', { hours: hoursLeft(state.outgoingInvite.expiresAt) })}
          </p>
          {!state.outgoingInvite.expired && <CopyLink link={state.outgoingInvite.link} />}
        </div>
      )}

      {state.kankamla && (
        <p className="text-xs text-[#888]">
          {t('kanka.rightsLeft', { count: state.kankamla.rightsLeft })}
          {state.kankamla.role === 'KANKA' ? ` ${t('kanka.freeRider')}` : ''}
        </p>
      )}

      {/* Sistemi anlatan kart */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#c0392b', margin: '0 0 6px' }}>{t('kanka.howTitle')}</p>
        <p style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6, margin: 0 }}>
          {t('kanka.howBody')}
        </p>
      </div>

      {sheet === 'invite' && (
        <Sheet onClose={() => setSheet(null)}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f5', marginBottom: 8 }}>{t('kanka.inviteTitle')}</p>
          {!state.kycApproved ? (
            <div className="flex flex-col gap-3">
              <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>{t('kanka.verifyFirst')}</p>
              <StdButton variant="primary" as={Link} href="/profil?tab=kyc" onClick={() => setSheet(null)} className="justify-center">{t('kanka.verifyMe')}</StdButton>
            </div>
          ) : sentLink ? (
            <div className="flex flex-col gap-3">
              <p style={{ fontSize: 13, color: '#4ade80' }}>{t('kanka.sentOk')}</p>
              <p style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{t('kanka.sentShare')}</p>
              <CopyLink link={sentLink} />
              <StdButton variant="ghost" onClick={() => setSheet(null)} className="justify-center">{t('kanka.ok')}</StdButton>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{t('kanka.rules')}</p>
              <div className="flex gap-2">
                <CountryCodeButton country={country} onChange={(c) => { setCountry(c); setMsg(''); }} />
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '0 14px' }}>
                  <input type="tel" inputMode="numeric" placeholder={country === 'TR' ? '5XX XXX XX XX' : ''} value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
                    style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#f5f5f5', padding: '11px 0' }} />
                </div>
              </div>
              {msg && <p style={{ fontSize: 12, color: '#ff6b6b' }}>{msg}</p>}
              <div className="flex gap-2">
                <StdButton variant="ghost" onClick={() => setSheet(null)} className="flex-1 justify-center">{t('kanka.cancel')}</StdButton>
                <StdButton variant="primary" onClick={sendInvite} disabled={busy} className="flex-1 justify-center disabled:opacity-50">{busy ? '…' : t('kanka.sendInvite')}</StdButton>
              </div>
            </div>
          )}
        </Sheet>
      )}

      {sheet === 'incoming' && incoming && (
        <Sheet onClose={() => setSheet(null)}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f5', marginBottom: 14 }}>{t('kanka.activeInvites', { count: state.incomingInvites.length })}</p>
          <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
            <Bubble initials={incoming.inviterInitials} gender={incoming.inviterGender} size={48} />
            <p style={{ fontSize: 14, color: '#ccc', lineHeight: 1.5 }}>
              {t('kanka.invitedYouPre')} <strong style={{ color: '#f5f5f5' }}>{incoming.inviterInitials}</strong> {t('kanka.invitedYouPost')}
            </p>
          </div>
          {msg && <p style={{ fontSize: 12, color: '#ff6b6b', marginBottom: 10 }}>{msg}</p>}
          <div className="flex flex-col gap-2">
            <StdButton variant="primary" onClick={() => respond('accept')} disabled={busy} className="justify-center disabled:opacity-50">{busy ? '…' : t('kanka.accept')}</StdButton>
            <StdButton variant="ghost" onClick={() => respond('decline')} disabled={busy} className="justify-center">{t('kanka.cancel')}</StdButton>
          </div>
        </Sheet>
      )}

      {sheet === 'kanka' && state.kanka && (
        <Sheet onClose={() => setSheet(null)}>
          <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
            <Bubble initials={state.kanka.initials} gender={state.kanka.gender} size={48} />
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f5' }}>{t('kanka.yourKanka')}</p>
              <p style={{ fontSize: 12, color: '#888' }}>{t('kanka.since', { date: formatNamed(state.kanka.since, locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>
            </div>
          </div>
          {state.kanka.locked ? (
            <p style={{ fontSize: 12, color: '#f59e0b', marginBottom: 12, lineHeight: 1.5 }}>{state.kanka.lockReason}</p>
          ) : (
            <p style={{ fontSize: 12, color: '#888', marginBottom: 12, lineHeight: 1.5 }}>{t('kanka.leaveInfo')}</p>
          )}
          {msg && <p style={{ fontSize: 12, color: '#ff6b6b', marginBottom: 10 }}>{msg}</p>}
          <div className="flex gap-2">
            <StdButton variant="ghost" onClick={() => setSheet(null)} className="flex-1 justify-center">{t('kanka.close')}</StdButton>
            {!state.kanka.locked && (
              <button onClick={unlink} disabled={busy}
                className="flex-1 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
                style={{ border: '1px solid rgba(192,57,43,0.6)', color: '#e74c3c', background: 'rgba(192,57,43,0.06)' }}>
                {busy ? '…' : t('kanka.leave')}
              </button>
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}
