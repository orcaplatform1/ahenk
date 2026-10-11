'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';

type VenuePreference = 'ALCOHOLIC' | 'NON_ALCOHOLIC' | 'NO_PREFERENCE';

const VENUE_OPTIONS: { value: VenuePreference; emoji: string; label: string; description: string }[] = [
  { value: 'ALCOHOLIC',     emoji: '🍷', label: 'Alkollü Mekan',  description: 'Alkollü içecek servisi olan restoran veya bar' },
  { value: 'NON_ALCOHOLIC', emoji: '☕', label: 'Alkolsüz Mekan', description: 'Kafe veya alkolsüz restoran' },
  { value: 'NO_PREFERENCE', emoji: '✨', label: 'Fark Etmez',     description: 'Her iki mekan türü de uygundur' },
];

const VENUE_LABELS: Record<VenuePreference, string> = {
  ALCOHOLIC:     '🍷 Alkollü Mekan',
  NON_ALCOHOLIC: '☕ Alkolsüz Mekan',
  NO_PREFERENCE: '✨ Fark Etmez',
};

const KYC_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING:    { label: 'Doğrulama Bekleniyor', cls: 'bg-surface text-muted border-border' },
  APPROVED:   { label: 'Doğrulandı ✓',        cls: 'bg-green-900/40 text-green-400 border-green-800' },
  REJECTED:   { label: 'Reddedildi',           cls: 'bg-red-900/40 text-accent border-red-800' },
  SUSPICIOUS: { label: 'İnceleniyor',          cls: 'bg-orange-900/40 text-orange-400 border-orange-800' },
};

interface City { id: string; name: string; }

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  activeCity?: string | null;
  profile?: {
    gender?: string;
    birthDate?: string;
    primaryCity?: City;
    secondaryCity?: City;
    venuePreference?: VenuePreference;
  };
  kyc?: { status: string };
}

interface Props {
  user: UserData;
  onGoKyc: () => void;
  cities: City[];
}

export function TabProfilim({ user, onGoKyc, cities }: Props) {
  const [editingCities, setEditingCities] = useState(false);
  const [editingVenue, setEditingVenue] = useState(false);
  const [primaryCityId, setPrimaryCityId] = useState(user.profile?.primaryCity?.id ?? '');
  const [secondaryCityId, setSecondaryCityId] = useState(user.profile?.secondaryCity?.id ?? '');
  const [venuePreference, setVenuePreference] = useState<VenuePreference>(user.profile?.venuePreference ?? 'NO_PREFERENCE');
  const [activeCity, setActiveCity] = useState<string>(user.activeCity ?? '');
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
      await api.post('/users/cities', { primaryCityId, secondaryCityId: secondaryCityId || undefined });
      setEditingCities(false);
    } catch (e) { setSaveError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function saveActiveCity(cityId: string | null) {
    setSavingActiveCity(true);
    try {
      await api.patch('/users/active-city', { activeCityId: cityId });
      setActiveCity(cityId ?? '');
    } catch (e) { setSaveError((e as Error).message); }
    finally { setSavingActiveCity(false); }
  }

  async function saveVenuePreference() {
    setSaving(true); setSaveError('');
    try {
      await api.patch('/users/venue-preference', { venuePreference });
      setEditingVenue(false);
    } catch (e) { setSaveError((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KYC banner */}
      {kycStatus !== 'APPROVED' && (
        <div className="flex items-center justify-between gap-4 bg-yellow-900/20 border border-yellow-800/40 rounded-2xl px-5 py-4">
          <p className="text-sm text-yellow-300">Masaya katılmak için kimlik doğrulaması gereklidir.</p>
          <button onClick={onGoKyc} className="text-sm text-yellow-300 hover:text-yellow-100 font-medium whitespace-nowrap">
            Doğrula →
          </button>
        </div>
      )}

      {/* Temel bilgiler */}
      <Card title="Hesap Bilgileri">
        <Row label="Ad Soyad" value={`${user.firstName} ${user.lastName}`} />

        {/* E-posta */}
        {emailMode ? (
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-xs text-[#555]">Yeni e-posta adresi</p>
            <input type="email" value={newEmail} onChange={e => { setNewEmail(e.target.value); setEmailError(''); }} placeholder="yeni@eposta.com" className="input-glass px-4 py-3 text-sm w-full" />
            <input type="password" value={emailPassword} onChange={e => { setEmailPassword(e.target.value); setEmailError(''); }} placeholder="Mevcut şifreniz" className="input-glass px-4 py-3 text-sm w-full" />
            {emailError && <p className="text-[#ff6b6b] text-xs">{emailError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setEmailMode(false); setEmailError(''); }} className="flex-1 py-2 text-xs text-[#888]" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9999 }}>İptal</button>
              <button onClick={saveEmail} disabled={emailSaving} className="flex-1 py-2 text-xs btn-grad">{emailSaving ? '…' : 'Kaydet'}</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">E-posta</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text">{currentEmail}</span>
              <button onClick={() => setEmailMode(true)} className="text-xs text-[#888] hover:text-[#f5f5f5] transition-colors px-2 py-0.5" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6 }}>Değiştir</button>
            </div>
          </div>
        )}

        {/* Telefon */}
        {phoneMode === 'idle' && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Telefon</span>
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
            <p className="text-xs text-[#555]">{currentPhone ? 'Yeni telefon numarası' : 'Telefon numarası ekle'}</p>
            <div className="flex gap-2">
              <div className="flex items-center px-3 text-[#555] text-sm select-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>+90</div>
              <input type="tel" value={newPhone} onChange={e => { setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setPhoneError(''); }} placeholder="5XX XXX XX XX" className="input-glass flex-1 px-4 py-3 text-sm" />
            </div>
            {phoneError && <p className="text-[#ff6b6b] text-xs">{phoneError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setPhoneMode('idle'); setPhoneError(''); setNewPhone(''); }} className="flex-1 py-2 text-xs text-[#888]" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9999 }}>İptal</button>
              <button onClick={sendPhoneOtp} disabled={phoneSaving} className="flex-1 py-2 text-xs btn-grad">{phoneSaving ? '…' : 'Kod Gönder'}</button>
            </div>
          </div>
        )}
        {phoneMode === 'otp' && (
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-xs text-[#555]">+90{newPhone} numarasına WhatsApp kodu gönderildi.</p>
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
              <button onClick={() => { setPhoneMode('enter'); setPhoneError(''); setPhoneOtp(['', '', '', '', '', '']); }} className="flex-1 py-2 text-xs text-[#888]" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9999 }}>← Geri</button>
              <button onClick={verifyPhoneOtp} disabled={phoneSaving || phoneOtp.join('').length !== 6} className="flex-1 py-2 text-xs btn-grad disabled:opacity-40">{phoneSaving ? '…' : 'Doğrula'}</button>
            </div>
          </div>
        )}

        {user.profile?.birthDate && (
          <Row label="Doğum Tarihi" value={new Date(user.profile.birthDate).toLocaleDateString('tr-TR')} />
        )}
        {user.profile?.gender && (
          <Row label="Cinsiyet" value={user.profile.gender === 'MALE' ? 'Erkek' : 'Kadın'} />
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-muted">KYC Durumu</span>
          <span className={`text-xs px-3 py-1 rounded-full border ${badge.cls}`}>{badge.label}</span>
        </div>
      </Card>

      {/* Bu hafta aktif şehir */}
      <Card title="Bu Hafta Hangi Şehirdesiniz?">
        <p className="text-xs text-[#555] mb-3">
          Her hafta Pazartesi sıfırlanır. Belirtmezseniz ana şehriniz kullanılır.
        </p>
        <div className="flex gap-2">
          <Select
            label=""
            value={activeCity}
            onChange={(v) => setActiveCity(v)}
            cities={cities}
            optional
            placeholder="Bu hafta şehir seç"
          />
          <button
            onClick={() => saveActiveCity(activeCity || null)}
            disabled={savingActiveCity}
            className="px-4 py-2 text-sm btn-grad disabled:opacity-50 whitespace-nowrap"
          >
            {savingActiveCity ? '…' : 'Kaydet'}
          </button>
        </div>
        {activeCity && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-[#555]">
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
        {saveError && <p className="text-accent text-sm mt-1">{saveError}</p>}
      </Card>

      {/* Şehir tercihleri */}
      <Card title="Şehir Tercihleri" action={!editingCities ? { label: 'Düzenle', onClick: () => setEditingCities(true) } : undefined}>
        {editingCities ? (
          <div className="flex flex-col gap-3">
            <Select label="Ana Şehir *" value={primaryCityId} onChange={setPrimaryCityId} cities={cities} />
            <Select
              label="İkinci Şehir (opsiyonel)"
              value={secondaryCityId}
              onChange={setSecondaryCityId}
              cities={cities.filter((c) => c.id !== primaryCityId)}
              optional
            />
            {saveError && <p className="text-accent text-sm">{saveError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setEditingCities(false)} className="flex-1 py-2 text-sm text-[#888] hover:text-[#f5f5f5] transition-colors" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9999 }}>İptal</button>
              <button onClick={saveCities} disabled={saving} className="flex-1 py-2 text-sm btn-grad">
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <Row label="Ana Şehir" value={user.profile?.primaryCity?.name ?? '—'} />
            <Row label="İkinci Şehir" value={user.profile?.secondaryCity?.name ?? 'Seçilmedi'} />
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
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{opt.emoji}</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: selected ? '#ff6b6b' : '#f5f5f5' }}>{opt.label}</p>
                      <p className="text-xs text-[#666] mt-0.5">{opt.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
            {saveError && <p className="text-accent text-sm">{saveError}</p>}
            <div className="flex gap-2 mt-1">
              <button onClick={() => setEditingVenue(false)} className="flex-1 py-2 text-sm text-[#888] hover:text-[#f5f5f5] transition-colors" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9999 }}>İptal</button>
              <button onClick={saveVenuePreference} disabled={saving} className="flex-1 py-2 text-sm btn-grad">
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        ) : (
          <Row
            label="Tercih"
            value={VENUE_LABELS[user.profile?.venuePreference ?? 'NO_PREFERENCE']}
          />
        )}
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
        <h3 className="font-medium text-sm text-[#888] uppercase tracking-wide">{title}</h3>
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
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm text-text">{value}</span>
    </div>
  );
}

function Select({ label, value, onChange, cities, optional, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; cities: City[]; optional?: boolean; placeholder?: string;
}) {
  return (
    <div className="flex-1">
      {label && <label className="block text-xs text-muted mb-1">{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-primary">
        {optional && <option value="">{placeholder ?? 'Seçmek istemiyorum'}</option>}
        {!optional && <option value="">Şehir seç</option>}
        {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  );
}
