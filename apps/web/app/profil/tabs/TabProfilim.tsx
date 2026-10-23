'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';

type VenuePreference = 'ALCOHOLIC' | 'NON_ALCOHOLIC' | 'NO_PREFERENCE';

const VENUE_OPTIONS: { value: VenuePreference; label: string; description: string }[] = [
  { value: 'ALCOHOLIC',     label: 'Alkollü Mekan',      description: 'Alkollü içecek servisi olan restoran veya bar' },
  { value: 'NON_ALCOHOLIC', label: 'Alkolsüz Mekan',     description: 'Kafe veya alkolsüz restoran' },
  { value: 'NO_PREFERENCE', label: 'Her ikisi de uygun', description: 'Her iki mekan türü de uygundur' },
];

const VENUE_LABELS: Record<VenuePreference, string> = {
  ALCOHOLIC:     'Alkollü Mekan',
  NON_ALCOHOLIC: 'Alkolsüz Mekan',
  NO_PREFERENCE: 'Her ikisi de uygun',
};

const KYC_BADGE: Record<string, { label: string; approved: boolean }> = {
  PENDING:    { label: 'Doğrulanmamış', approved: false },
  APPROVED:   { label: 'Doğrulandı',   approved: true  },
  REJECTED:   { label: 'Doğrulanmamış', approved: false },
  SUSPICIOUS: { label: 'Doğrulanmamış', approved: false },
};

interface City { id: string; name: string; }

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  activeCity?: string | null;
  occupationSector?: string;
  profile?: {
    gender?: string;
    birthDate?: string;
    primaryCity?: City;

    venuePreference?: VenuePreference;
  };
  kyc?: { status: string };
}

interface Props {
  user: UserData;
  onGoKyc: () => void;
  cities: City[];
  activePlan?: 'MASADA' | 'KARSIMDA' | 'ICERDE' | null;
}

/* ─── Havuz Ekranı ─────────────────────────────────────────────────────────── */
interface PoolStatus {
  isSubscribed: boolean;
  activePlan: string | null;
  inPool: boolean;
  hasMeeting: boolean;
  poolSize: number;
  meetingScheduledAt: string | null;
}

function PoolScreen({ activePlan }: { activePlan: 'MASADA' | 'KARSIMDA' | 'ICERDE' }) {
  const [status, setStatus] = useState<PoolStatus | null>(null);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get<PoolStatus>('/matching/pool-status');
      setStatus(data);
    } catch { /* sessizce geç */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(() => {
      fetchStatus();
      setTick(t => t + 1);
    }, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchStatus]);

  /* Dönen halka animasyonu (CSS keyframe inline) */
  const PLAN_LABEL: Record<string, string> = {
    MASADA: 'Masada',
    KARSIMDA: 'Karşımda',
    ICERDE: 'İçerde',
  };

  if (!status) {
    return (
      <div className="glass-card p-5">
        <h3 className="font-medium text-sm text-[#f5f5f5] uppercase tracking-wide mb-4">Eşleşme Havuzu</h3>
        <div className="h-32 animate-pulse rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }} />
      </div>
    );
  }

  if (status.hasMeeting) {
    const date = status.meetingScheduledAt
      ? new Date(status.meetingScheduledAt).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
      : null;
    return (
      <div className="glass-card p-5">
        <h3 className="font-medium text-sm text-[#f5f5f5] uppercase tracking-wide mb-4">Eşleşme Havuzu</h3>
        <div className="flex flex-col items-center gap-4 py-4">
          <div style={{ position: 'relative', width: 80, height: 80 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'conic-gradient(#22c55e 0%, #22c55e 100%)',
              animation: 'spin 3s linear infinite',
            }} />
            <div style={{ position: 'absolute', inset: 4, borderRadius: '50%', background: '#0c0909', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 28 }}>✓</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[#4ade80]">Masanız Kuruldu!</p>
            {date && <p className="text-xs text-[rgba(255,255,255,0.62)] mt-1">{date}</p>}
            <p className="text-xs text-[rgba(255,255,255,0.62)] mt-1">Masalar sekmesinden detayları görebilirsiniz.</p>
          </div>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const size = status.poolSize ?? 0;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-sm text-[#f5f5f5] uppercase tracking-wide">Eşleşme Havuzu</h3>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', color: '#ff6b6b' }}>
          {PLAN_LABEL[activePlan] ?? activePlan}
        </span>
      </div>
      <div className="flex flex-col items-center gap-5 py-2">
        {/* Animasyonlu halka */}
        <div style={{ position: 'relative', width: 100, height: 100 }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: status.inPool
              ? 'conic-gradient(#c0392b 0%, #e74c3c 40%, transparent 40%)'
              : 'conic-gradient(rgba(192,57,43,0.3) 0%, rgba(192,57,43,0.3) 100%)',
            animation: status.inPool ? 'poolSpin 2.5s linear infinite' : undefined,
          }} />
          <div style={{
            position: 'absolute', inset: 6, borderRadius: '50%', background: '#0c0909',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#f5f5f5', lineHeight: 1 }}>{size}</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.50)', marginTop: 2 }}>KİŞİ</span>
          </div>
        </div>

        {/* Durum metni */}
        <div className="text-center">
          {status.inPool ? (
            <>
              <p className="text-sm font-semibold text-[#f5f5f5]">Havuzdasın</p>
              <p className="text-xs text-[rgba(255,255,255,0.62)] mt-1">Algoritma her saat eşleşme arıyor.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-[#f5f5f5]">Bekleme dışında</p>
              <p className="text-xs text-[rgba(255,255,255,0.62)] mt-1">OCEAN testi veya KYC eksik olabilir.</p>
            </>
          )}
        </div>

        {/* Darbe noktaları — aktifken titreşir */}
        {status.inPool && (
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#c0392b',
                animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        )}
      </div>
      <style>{`
        @keyframes poolSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,80%,100% { opacity:0.3; transform:scale(0.8); } 40% { opacity:1; transform:scale(1.2); } }
      `}</style>
    </div>
  );
}

export function TabProfilim({ user, onGoKyc, cities, activePlan }: Props) {
  const [editingCities, setEditingCities] = useState(false);
  const [editingVenue, setEditingVenue] = useState(false);

  /* Sadakat programı */
  const [referralStats, setReferralStats] = useState<{ totalInvites: number; availableDiscounts: number } | null>(null);
  const [referralStatsLoaded, setReferralStatsLoaded] = useState(false);
  const [referralPhone, setReferralPhone] = useState('');
  const [referralSending, setReferralSending] = useState(false);
  const [referralMsg, setReferralMsg] = useState('');
  const [primaryCityId, setPrimaryCityId] = useState(user.profile?.primaryCity?.id ?? '');
  const [displayPrimaryCity, setDisplayPrimaryCity] = useState<City | null>(user.profile?.primaryCity ?? null);
  const [venuePreference, setVenuePreference] = useState<VenuePreference>(user.profile?.venuePreference ?? 'NO_PREFERENCE');
  const [displayVenuePreference, setDisplayVenuePreference] = useState<VenuePreference>(user.profile?.venuePreference ?? 'NO_PREFERENCE');
  const [activeCity, setActiveCity] = useState<string>(user.activeCity ?? '');
  const [activeCityConfirm, setActiveCityConfirm] = useState(false);
  const [pendingActiveCity, setPendingActiveCity] = useState<string | null>(null);
  const [savingActiveCity, setSavingActiveCity] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  /* Telefon değiştirme */
  const [phoneMode, setPhoneMode] = useState<'idle' | 'enter' | 'otp'>('idle');
  const [newPhone, setNewPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState(['', '', '', '', '', '']);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [currentPhone, setCurrentPhone] = useState(user.phone ?? '');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  /* E-posta değiştirme */
  const [emailMode, setEmailMode] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [currentEmail, setCurrentEmail] = useState(user.email);

  useEffect(() => {
    if (referralStatsLoaded) return;
    api.get('/referral/my-stats').then((d) => { setReferralStats(d as { totalInvites: number; availableDiscounts: number }); setReferralStatsLoaded(true); }).catch(() => {});
  }, [referralStatsLoaded]);

  async function sendReferralInvite() {
    if (!referralPhone || referralPhone.length !== 10 || !referralPhone.startsWith('5')) {
      setReferralMsg('Geçerli bir numara girin (5 ile başlayan 10 hane).');
      return;
    }
    setReferralSending(true); setReferralMsg('');
    try {
      await api.post('/referral/invite', { phoneNumber: `+90${referralPhone}` });
      setReferralMsg('Davet başarıyla gönderildi!');
      setReferralPhone('');
      const d = await api.get('/referral/my-stats');
      setReferralStats(d as { totalInvites: number; availableDiscounts: number });
    } catch (e) { setReferralMsg((e as Error).message || 'Gönderilemedi.'); }
    finally { setReferralSending(false); }
  }

  async function sendPhoneOtp() {
    if (!newPhone || newPhone.length !== 10 || !newPhone.startsWith('5')) { setPhoneError('Geçerli bir numara girin (5 ile başlayan 10 hane).'); return; }
    setPhoneSaving(true); setPhoneError('');
    try {
      await api.post('/users/change-phone/request', { phone: `+90${newPhone}` });
      setPhoneMode('otp');
    } catch (e) { setPhoneError((e as Error).message); }
    finally { setPhoneSaving(false); }
  }

  async function verifyPhoneOtp() {
    const code = phoneOtp.join('');
    if (code.length !== 6) return;
    setPhoneSaving(true); setPhoneError('');
    try {
      await api.post('/users/change-phone/verify', { phone: `+90${newPhone}`, code });
      setCurrentPhone(`+90${newPhone}`);
      setPhoneMode('idle'); setNewPhone(''); setPhoneOtp(['', '', '', '', '', '']);
    } catch (e) { setPhoneError((e as Error).message); }
    finally { setPhoneSaving(false); }
  }

  function handleOtpInput(i: number, val: string) {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...phoneOtp]; next[i] = d;
    setPhoneOtp(next);
    if (d && i < 5) otpRefs.current[i + 1]?.focus();
  }

  async function saveEmail() {
    if (!newEmail.includes('@') || !newEmail.includes('.')) { setEmailError('Geçerli bir e-posta girin.'); return; }
    if (!emailPassword) { setEmailError('Mevcut şifrenizi girin.'); return; }
    setEmailSaving(true); setEmailError('');
    try {
      await api.patch('/users/change-email', { email: newEmail, currentPassword: emailPassword });
      api.clearMeCache();
      setCurrentEmail(newEmail);
      setEmailMode(false); setNewEmail(''); setEmailPassword('');
    } catch (e) { setEmailError((e as Error).message); }
    finally { setEmailSaving(false); }
  }

  const kycStatus = user.kyc?.status ?? 'PENDING';
  const badge = KYC_BADGE[kycStatus] ?? KYC_BADGE.PENDING;

  async function saveCities() {
    if (!primaryCityId) { setSaveError('Ana şehir zorunlu.'); return; }
    setSaving(true); setSaveError('');
    try {
      await api.post('/users/cities', { primaryCityId });
      api.clearMeCache();
      setDisplayPrimaryCity(cities.find(c => c.id === primaryCityId) ?? null);
      setEditingCities(false);
    } catch (e) { setSaveError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function saveActiveCity(cityId: string | null) {
    setSavingActiveCity(true);
    try {
      await api.patch('/users/active-city', { activeCityId: cityId });
      api.clearMeCache();
      setActiveCity(cityId ?? '');
    } catch (e) { setSaveError((e as Error).message); }
    finally { setSavingActiveCity(false); }
  }

  async function saveVenuePreference() {
    setSaving(true); setSaveError('');
    try {
      await api.patch('/users/venue-preference', { venuePreference });
      api.clearMeCache();
      setDisplayVenuePreference(venuePreference);
      setEditingVenue(false);
    } catch (e) { setSaveError((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Temel bilgiler */}
      <Card title="Hesap Bilgileri">
        {/* Kimlik Doğrulama durumu — en üstte */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#f5f5f5]">Kimlik Doğrulama</span>
          <span
            className="text-xs px-3 py-1 rounded-full"
            style={badge.approved
              ? { border: '1.5px solid #22c55e', color: '#4ade80', background: 'rgba(34,197,94,0.08)' }
              : { border: '1.5px solid #c0392b', color: '#ff6b6b', background: 'rgba(192,57,43,0.08)' }
            }
          >
            {badge.label}
          </span>
        </div>

        <Row label="Ad Soyad" value={`${user.firstName} ${user.lastName}`} />

        {/* E-posta */}
        {emailMode ? (
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-xs text-[rgba(255,255,255,0.62)]">Yeni e-posta adresi</p>
            <input type="email" value={newEmail} onChange={e => { setNewEmail(e.target.value); setEmailError(''); }} placeholder="yeni@eposta.com" className="input-glass px-4 py-3 text-sm w-full" />
            <input type="password" value={emailPassword} onChange={e => { setEmailPassword(e.target.value); setEmailError(''); }} placeholder="Mevcut şifreniz" className="input-glass px-4 py-3 text-sm w-full" />
            {emailError && <p className="text-[#ff6b6b] text-xs">{emailError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setEmailMode(false); setEmailError(''); }} className="flex-1 btn-ghost justify-center">İptal</button>
              <button onClick={saveEmail} disabled={emailSaving} className="flex-1 btn-primary">{emailSaving ? '…' : 'Kaydet'}</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#f5f5f5]">E-posta</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text">{currentEmail}</span>
              <button onClick={() => setEmailMode(true)} className="text-xs text-[#888] hover:text-[#f5f5f5] transition-colors px-2 py-0.5" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6 }}>Değiştir</button>
            </div>
          </div>
        )}

        {/* Telefon */}
        {phoneMode === 'idle' && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#f5f5f5]">Telefon</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text">{currentPhone || '—'}</span>
              <button onClick={() => setPhoneMode('enter')} className="text-xs text-[#888] hover:text-[#f5f5f5] transition-colors px-2 py-0.5" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6 }}>
                {currentPhone ? 'Değiştir' : 'Ekle'}
              </button>
            </div>
          </div>
        )}
        {phoneMode === 'enter' && (
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-xs text-[rgba(255,255,255,0.62)]">{currentPhone ? 'Yeni telefon numarası' : 'Telefon numarası ekle'}</p>
            <div className="flex gap-2">
              <div className="flex items-center px-3 text-[rgba(255,255,255,0.62)] text-sm select-none" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }}>+90</div>
              <input type="tel" value={newPhone} onChange={e => { setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setPhoneError(''); }} placeholder="5XX XXX XX XX" className="input-glass flex-1 px-4 py-3 text-sm" />
            </div>
            {phoneError && <p className="text-[#ff6b6b] text-xs">{phoneError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setPhoneMode('idle'); setPhoneError(''); setNewPhone(''); }} className="flex-1 btn-ghost justify-center">İptal</button>
              <button onClick={sendPhoneOtp} disabled={phoneSaving} className="flex-1 btn-primary">{phoneSaving ? '…' : 'Kod Gönder'}</button>
            </div>
          </div>
        )}
        {phoneMode === 'otp' && (
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-xs text-[rgba(255,255,255,0.62)]">+90{newPhone} numarasına WhatsApp kodu gönderildi.</p>
            <div className="flex gap-1.5 justify-center">
              {phoneOtp.map((d, i) => (
                <input key={i} ref={el => { otpRefs.current[i] = el; }} type="tel" inputMode="numeric" maxLength={1} value={d}
                  onChange={e => handleOtpInput(i, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Backspace' && !d && i > 0) otpRefs.current[i - 1]?.focus(); }}
                  autoFocus={i === 0}
                  className="text-center input-glass text-lg font-semibold"
                  style={{ borderRadius: 10, width: 40, height: 50 }}
                />
              ))}
            </div>
            {phoneError && <p className="text-[#ff6b6b] text-xs text-center">{phoneError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setPhoneMode('enter'); setPhoneError(''); setPhoneOtp(['', '', '', '', '', '']); }} className="flex-1 btn-ghost justify-center">Geri</button>
              <button onClick={verifyPhoneOtp} disabled={phoneSaving || phoneOtp.join('').length !== 6} className="flex-1 btn-primary disabled:opacity-40">{phoneSaving ? '…' : 'Doğrula'}</button>
            </div>
          </div>
        )}

        {user.occupationSector && (
          <Row label="Meslek" value={user.occupationSector} />
        )}
        {user.profile?.birthDate && (
          <Row label="Yaş" value={`${Math.floor((Date.now() - new Date(user.profile.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))}`} />
        )}
        {user.profile?.gender && (
          <Row label="Cinsiyet" value={user.profile.gender === 'MALE' ? 'Erkek' : 'Kadın'} />
        )}
      </Card>

      {/* Aktif şehir */}
      {activeCityConfirm && (
        <div onClick={() => setActiveCityConfirm(false)} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '24px 20px 36px' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f5', marginBottom: 10 }}>Dikkat</p>
            <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 20 }}>
              Eşleşme süreciniz <span style={{ color: '#f5f5f5' }}>{displayPrimaryCity?.name ?? 'ana şehriniz'}</span> üzerinden devam etmektedir. Şehri değiştirirseniz eşleşme sıranıza yeniden gireceksiniz.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setActiveCityConfirm(false); saveActiveCity(pendingActiveCity); }}
                className="btn-primary w-full justify-center"
              >
                Kabul Ediyorum
              </button>
              <button
                onClick={() => setActiveCityConfirm(false)}
                className="btn-ghost w-full justify-center"
              >
                Kabul Etmiyorum
              </button>
            </div>
          </div>
        </div>
      )}
      <Card title="Hangi Şehirdeki Masalara Katılmak İstersiniz?">
        <p className="text-xs text-[rgba(255,255,255,0.62)] mb-3">
          Bu şehirlerden birinde tatilde veya seyahatteyseniz, oradaki grup masası veya baş başa masasına katılabilirsiniz.
        </p>
        <div className="flex gap-2">
          <Select
            label=""
            value={activeCity}
            onChange={(v) => setActiveCity(v)}
            cities={cities}
            optional
            placeholder="Şehir seç"
            title="Hangi şehirdeki masalara katılmak istersiniz?"
          />
          <button
            onClick={() => { setPendingActiveCity(activeCity || null); setActiveCityConfirm(true); }}
            disabled={savingActiveCity}
            className="btn-primary disabled:opacity-50 whitespace-nowrap"
          >
            {savingActiveCity ? '…' : 'Kaydet'}
          </button>
        </div>
        {activeCity && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-[rgba(255,255,255,0.62)]">
              Aktif: <span className="text-[#f5f5f5]">{cities.find(c => c.id === activeCity)?.name ?? '—'}</span>
            </span>
            <button
              onClick={() => saveActiveCity(null)}
              disabled={savingActiveCity}
              className="text-xs text-[#888] hover:text-[#ff6b6b] transition-colors"
            >
              Temizle
            </button>
          </div>
        )}
        {activeCity && (
          <p className="text-xs text-[#888] mt-1.5">
            Siz iptal edene kadar bu şehirdeki masalarla eşleşirsiniz.
          </p>
        )}
        {saveError && <p className="text-accent text-sm mt-1">{saveError}</p>}
      </Card>

      {/* Şehir tercihleri */}
      <Card title="Şehir Tercihleri" action={!editingCities ? { label: 'Düzenle', onClick: () => setEditingCities(true) } : undefined}>
        {editingCities ? (
          <div className="flex flex-col gap-3">
            <Select label="Ana Şehir *" value={primaryCityId} onChange={setPrimaryCityId} cities={cities} title="Ana şehir seç" />
            {saveError && <p className="text-accent text-sm">{saveError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setEditingCities(false)} className="flex-1 btn-ghost justify-center">İptal</button>
              <button onClick={saveCities} disabled={saving} className="flex-1 btn-primary">
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <Row label="Ana Şehir" value={displayPrimaryCity?.name ?? '—'} />
          </>
        )}
      </Card>

      {/* Mekan tercihi */}
      <Card title="Mekan Tercihi" action={!editingVenue ? { label: 'Düzenle', onClick: () => setEditingVenue(true) } : undefined}>
        {editingVenue ? (
          <div className="flex flex-col gap-3">
            {VENUE_OPTIONS.map((opt) => {
              const selected = venuePreference === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVenuePreference(opt.value)}
                  className="w-full text-left rounded-xl p-4 transition-all"
                  style={selected ? {
                    background: 'rgba(192,57,43,0.10)',
                    border: '1.5px solid rgba(192,57,43,0.5)',
                  } : {
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium" style={{ color: selected ? '#ff6b6b' : '#f5f5f5' }}>{opt.label}</p>
                      <p className="text-xs text-[rgba(255,255,255,0.62)] mt-0.5">{opt.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
            {saveError && <p className="text-accent text-sm">{saveError}</p>}
            <div className="flex gap-2 mt-1">
              <button onClick={() => setEditingVenue(false)} className="flex-1 btn-ghost justify-center">İptal</button>
              <button onClick={saveVenuePreference} disabled={saving} className="flex-1 btn-primary">
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        ) : (
          <Row
            label="Tercih"
            value={VENUE_LABELS[displayVenuePreference]}
          />
        )}
      </Card>

      {/* Sadakat Programı */}
      <Card title="SADAKAT PROGRAMI">
        <div className="flex flex-col gap-2 mb-3">
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '0 14px' }}>
            <span style={{ color: 'rgba(255,255,255,0.62)', fontSize: 14, marginRight: 4 }}>+90</span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="5XX XXX XX XX"
              value={referralPhone}
              onChange={e => setReferralPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#f5f5f5', padding: '12px 0' }}
            />
          </div>
          <button
            onClick={sendReferralInvite}
            disabled={referralSending}
            className="w-full btn-primary disabled:opacity-50"
          >
            {referralSending ? '…' : 'Davet Gönder'}
          </button>
        </div>
        {referralMsg && (
          <p className="text-xs mb-3" style={{ color: referralMsg.includes('başarı') ? '#4ade80' : '#ff6b6b' }}>{referralMsg}</p>
        )}
        <div className="flex gap-6 pt-3 border-t border-white/5">
          <div>
            <p className="text-xs text-[#f5f5f5]">Davetli Arkadaş</p>
            <p className="text-base font-semibold text-text">{referralStats?.totalInvites ?? '—'} kişi</p>
          </div>
          <div>
            <p className="text-xs text-[#f5f5f5]">Toplam %10 İndirim Hakkı</p>
            <p className="text-base font-semibold text-text">{referralStats?.availableDiscounts ?? '—'} Adet</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Yardımcı alt bileşenler ──────────────────────────────────────────────

export function TabProfilimSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-16 bg-surface rounded-2xl animate-pulse" />
      <div className="bg-surface border border-border rounded-2xl p-6"><SkeletonBlock lines={4} /></div>
      <div className="bg-surface border border-border rounded-2xl p-6"><SkeletonBlock lines={2} /></div>
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: { label: string; onClick: () => void }; }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-sm text-[#f5f5f5] uppercase tracking-wide">{title}</h3>
        {action && (
          <button
            onClick={action.onClick}
            className="text-xs text-[#888] hover:text-[#f5f5f5] transition-colors px-3 py-1"
            style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
          >
            {action.label}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#f5f5f5]">{label}</span>
      <span className="text-sm text-text">{value}</span>
    </div>
  );
}

const CITY_ORDER_P = ['İstanbul', 'Ankara', 'İzmir', 'Antalya', 'Balıkesir', 'Aydın', 'Muğla'];

function cityLabelP(name: string) {
  return name === 'Balıkesir' ? 'Balıkesir (Ayvalık / Akçay)' : name;
}

function sortCitiesP(cities: City[]): City[] {
  return [...cities].sort((a, b) => {
    const ia = CITY_ORDER_P.indexOf(a.name);
    const ib = CITY_ORDER_P.indexOf(b.name);
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name, 'tr');
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function CityPickerModalP({ cities, value, onChange, onClose, optional, title }: {
  cities: City[]; value: string; onChange: (v: string) => void; onClose: () => void;
  optional?: boolean; title: string;
}) {
  const [tmp, setTmp] = useState(value);
  const sorted = sortCitiesP(cities);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '20px 16px 36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 13, color: '#888' }}>{title}</p>
          <button onClick={onClose} style={{ color: '#555', fontSize: 20, lineHeight: 1, background: 'none', outline: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 300, scrollbarWidth: 'none' }}>
          {optional && (
            <div onClick={() => setTmp('')} style={{ padding: '13px 14px', fontSize: 15, color: tmp === '' ? '#ff6b6b' : '#888', fontWeight: tmp === '' ? 600 : 400, background: tmp === '' ? 'rgba(192,57,43,0.12)' : 'transparent', borderRadius: 8, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', transition: 'color 0.1s, background 0.1s' }}>
              Seçmek istemiyorum
            </div>
          )}
          {sorted.map(c => {
            const isSel = c.id === tmp;
            return (
              <div key={c.id} onClick={() => setTmp(c.id)} style={{ padding: '13px 14px', fontSize: 15, color: isSel ? '#ff6b6b' : '#ccc', fontWeight: isSel ? 600 : 400, background: isSel ? 'rgba(192,57,43,0.12)' : 'transparent', borderRadius: 8, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', transition: 'color 0.1s, background 0.1s' }}>
                {cityLabelP(c.name)}
              </div>
            );
          })}
        </div>
        <button onClick={() => { onChange(tmp); onClose(); }} className="btn-primary w-full justify-center" style={{ marginTop: 16 }}>
          Seç
        </button>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, cities, optional, placeholder, title }: {
  label: string; value: string; onChange: (v: string) => void; cities: City[]; optional?: boolean; placeholder?: string; title?: string;
}) {
  const [open, setOpen] = useState(false);
  const found = cities.find(c => c.id === value);
  const display = found ? cityLabelP(found.name) : (optional ? (placeholder ?? 'Seçmek istemiyorum') : 'Şehir seç');
  return (
    <div className="flex-1">
      {label && <label className="block text-xs text-[#f5f5f5] mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ width: '100%', background: 'rgba(255,255,255,0.10)', border: `1px solid ${value ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 12, padding: '11px 14px', fontSize: 14, color: value ? '#f5f5f5' : 'rgba(255,255,255,0.55)', textAlign: 'left', cursor: 'pointer', outline: 'none', WebkitTapHighlightColor: 'transparent' }}
      >
        {display}
      </button>
      {open && <CityPickerModalP cities={cities} value={value} onChange={onChange} onClose={() => setOpen(false)} optional={optional} title={title ?? 'Şehir seç'} />}
    </div>
  );
}
