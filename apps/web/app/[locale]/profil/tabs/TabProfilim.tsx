'use client';

import { gColor } from '@ahenk/ui';
import { KankaSection } from '@/components/KankaSection';
import { useMasaTabs } from '@/components/live/useMasaTabs';
import { useState, useRef, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ENGLISH_ENABLED, LANGS, occupationLabel, splitE164, toE164, type Lang } from '@ahenk/shared';
import { CountryCodeButton } from '@/components/PhoneCountryField';
import { usePathname } from '@/i18n/navigation';
import { switchLocale } from '@/lib/locale';
import { api } from '@/lib/api';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { ProblemReportModal } from '@/components/ProblemReportModal';
import { OtpCountdown, useOtpCountdown } from '@/lib/otpCountdown';

type VenuePreference = 'ALCOHOLIC' | 'NON_ALCOHOLIC' | 'NO_PREFERENCE';

const VENUE_OPTIONS: { value: VenuePreference; label: string; description: string }[] = [
  { value: 'ALCOHOLIC',     label: 'venue.alcoholic',    description: 'venue.alcoholicDesc' },
  { value: 'NON_ALCOHOLIC', label: 'venue.nonAlcoholic', description: 'venue.nonAlcoholicDesc' },
  { value: 'NO_PREFERENCE', label: 'venue.both',         description: 'venue.bothDesc' },
];

const VENUE_LABELS: Record<VenuePreference, string> = {
  ALCOHOLIC:     'venue.alcoholic',
  NON_ALCOHOLIC: 'venue.nonAlcoholic',
  NO_PREFERENCE: 'venue.both',
};

const KYC_BADGE: Record<string, { label: string; approved: boolean }> = {
  PENDING:    { label: 'prof.unverified', approved: false },
  APPROVED:   { label: 'prof.verified',   approved: true  },
  REJECTED:   { label: 'prof.unverified', approved: false },
  SUSPICIOUS: { label: 'prof.unverified', approved: false },
};

interface City { id: string; name: string; isActive?: boolean; countryCode?: string; }

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
  language?: string;
  nativeLanguage?: string;
  speaksEnglish?: boolean;
  speaksTurkish?: boolean;
  noShowWarning?: { count: number; remaining: number } | null;
}

// Sıra sayıları: çeviri anahtarı
const ORDINAL = ['prof.ordinal1', 'prof.ordinal2', 'prof.ordinal3'];

interface Props {
  user: UserData;
  onGoKyc: () => void;
  onGoTest: () => void;
  onGoRehber: () => void;
  cities: City[];
  activePlan?: 'MASADA' | 'KARSIMDA' | 'ICERDE' | null;
}

// Tüm Cihazlardan Çıkış Yap / Hesabımı Sil: yazı dar ekranda da tek satıra sığar
const ACCOUNT_BTN: React.CSSProperties = { width: '72%', justifyContent: 'center', whiteSpace: 'nowrap', padding: '9px 10px', fontSize: 'clamp(8px, 2.5vw, 10px)', letterSpacing: '0.04em' };

export function TabProfilim({ user, onGoKyc, onGoTest, onGoRehber, cities, activePlan }: Props) {
  const t = useTranslations();
  const locale = useLocale() as Lang;
  const pathname = usePathname();
  // Dil bazlı eşleşme (mobil ProfilimTab ile aynı): kayıt dili ana dildir (kilitli, alanı hep true); "Başka konuştuğun diller"
  // satırlarından diğer diller işaretlenir (birden fazla seçilebilir) → speaksEnglish / speaksTurkish
  const nativeLang: Lang = user.nativeLanguage === 'en' ? 'en' : 'tr';
  const [spoken, setSpoken] = useState<Record<Lang, boolean>>({ tr: user.speaksTurkish !== false, en: !!user.speaksEnglish });
  async function toggleSpoken(l: Lang) {
    if (l === nativeLang) return;
    const v = !spoken[l];
    setSpoken((p) => ({ ...p, [l]: v }));
    try { await api.patch('/users/me/spoken-languages', l === 'en' ? { speaksEnglish: v } : { speaksTurkish: v }); } catch (e) { setSaveError((e as Error).message); }
  }
  function chooseLanguage(lang: Lang) {
    if (lang === locale) return;
    switchLocale(lang, pathname);
  }
  // Pasif bölgeler için "Haber ver" (aynı bölgeye bir kez)
  const [notified, setNotified] = useState<string[]>([]);
  useEffect(() => { api.silentGet<string[]>('/users/me/region-waitlist').then((r) => setNotified(Array.isArray(r) ? r : [])).catch(() => {}); }, []);
  const notifyRegion = (id: string) => { setNotified((p) => (p.includes(id) ? p : [...p, id])); api.post(`/users/me/region-waitlist/${id}`, {}).catch(() => undefined); };
  const [editingVenue, setEditingVenue] = useState(false);

  // Ana şehir üye tarafından değiştirilemez; yalnız admin panelinden düzeltilir
  const displayPrimaryCity: City | null = user.profile?.primaryCity ?? null;
  const [venuePreference, setVenuePreference] = useState<VenuePreference>(user.profile?.venuePreference ?? 'NO_PREFERENCE');
  const [displayVenuePreference, setDisplayVenuePreference] = useState<VenuePreference>(user.profile?.venuePreference ?? 'NO_PREFERENCE');
  const [activeCity, setActiveCity] = useState<string>(user.activeCity ?? '');
  const [activeCityConfirm, setActiveCityConfirm] = useState(false);
  // t('prof.attention') penceresinde Kabul Ediyorum'a basılınca yapılacak kayıt
  const confirmAction = useRef<(() => void) | null>(null);
  const askConfirm = (fn: () => void) => { confirmAction.current = fn; setActiveCityConfirm(true); };
  // Aktif masa (Masa Kuruldu / Masa Oluşturuluyor) veya eşleşme süreci (Taramada / sonraki döngü bekleniyor) var mı
  const { statuses } = useMasaTabs();
  const inMatching = Object.values(statuses).some(st => st === 'TABLE' || st === 'FORMING' || st === 'SCANNING' || st === 'PENDING');
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
  // Ülke kodu: varsayılan kayıtlı telefonun ülkesi; gönderim E.164 (libphonenumber-js)
  const [phoneCountry, setPhoneCountry] = useState(() => splitE164(user.phone).country);
  const newPhoneE164 = toE164(phoneCountry, newPhone);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  /* E-posta değiştirme */
  const [emailMode, setEmailMode] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [currentEmail, setCurrentEmail] = useState(user.email);

  /* Oturum ve hesap */
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deletePending, setDeletePending] = useState(false);

  useEffect(() => {
    api.silentGet<{ request: { id: string } | null }>('/users/me/deletion-request').then((r) => setDeletePending(!!r?.request?.id)).catch(() => {});
  }, []);

  async function logoutAll() {
    setLogoutAllBusy(true);
    try {
      await api.post('/auth/logout-all', {});
      api.clearSession();
      window.location.href = `${locale === 'en' ? '/en' : ''}/giris`;
    } catch (e) { setSaveError((e as Error).message); setLogoutAllBusy(false); }
  }

  async function confirmDelete() {
    setDeleteBusy(true); setDeleteError('');
    try {
      await api.post('/users/me/deletion-request', {});
      setDeletePending(true);
      setDeleteOpen(false);
    } catch (e) { setDeleteError((e as Error).message); }
    finally { setDeleteBusy(false); }
  }

  // Yeni kod isteme bekleme süresi backend'den gelir (ortak sayaç)
  const phoneCountdown = useOtpCountdown();

  async function sendPhoneOtp() {
    if (!newPhoneE164) { setPhoneError(t('phone.invalid')); return; }
    setPhoneSaving(true); setPhoneError('');
    try {
      const r = await api.post<{ resendSeconds?: number }>('/users/change-phone/request', { phone: newPhoneE164 });
      setPhoneMode('otp'); setPhoneOtp(['', '', '', '', '', '']); phoneCountdown.start(r.resendSeconds);
    } catch (e) {
      // Bekleme süresi dolmadan istendi: sayaç sunucunun döndüğü kalan saniyeden başlar
      if (phoneCountdown.startFromError(e)) setPhoneMode('otp');
      setPhoneError((e as Error).message);
    }
    finally { setPhoneSaving(false); }
  }

  async function verifyPhoneOtp() {
    const code = phoneOtp.join('');
    if (code.length !== 6) return;
    setPhoneSaving(true); setPhoneError('');
    try {
      await api.post('/users/change-phone/verify', { phone: newPhoneE164, code });
      setCurrentPhone(newPhoneE164 ?? '');
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
    if (!newEmail.includes('@') || !newEmail.includes('.')) { setEmailError(t('reg.validEmail')); return; }
    if (!emailPassword) { setEmailError(t('prof.enterCurrentPw')); return; }
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
      <Card title={t('prof.accountInfo')}>
        {/* Gelmedi uyarısı — en üstte, net görünsün */}
        {user.noShowWarning && (
          <p className="text-sm font-medium leading-relaxed" style={{ color: '#facc15' }}>
            {t('prof.noShow', { ordinal: ORDINAL[user.noShowWarning.count - 1] ? t(ORDINAL[user.noShowWarning.count - 1]) : `${user.noShowWarning.count}.`, remaining: user.noShowWarning.remaining })}
          </p>
        )}

        {/* Kimlik Doğrulama durumu */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[#c9c2b8]">{t('prof.identity')}</span>
          <span
            className="text-xs px-3 py-1 rounded-full"
            style={badge.approved
              ? { border: '1.5px solid #22c55e', color: '#4ade80', background: 'rgba(34,197,94,0.08)' }
              : { border: '1.5px solid #c0392b', color: '#ff6b6b', background: 'rgba(192,57,43,0.08)' }
            }
          >
            {t(badge.label)}
          </span>
        </div>

        <Row label={t('prof.fullName')} value={`${user.firstName} ${user.lastName}`} />

        {/* E-posta */}
        {emailMode ? (
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-xs text-[#a39c93]">{t('prof.newEmail')}</p>
            <input type="email" value={newEmail} onChange={e => { setNewEmail(e.target.value); setEmailError(''); }} placeholder="yeni@eposta.com" className="input-glass px-4 py-3 text-sm w-full" />
            <input type="password" value={emailPassword} onChange={e => { setEmailPassword(e.target.value); setEmailError(''); }} placeholder={t('prof.currentPw')} className="input-glass px-4 py-3 text-sm w-full" />
            {emailError && <p className="text-[#ff6b6b] text-xs">{emailError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setEmailMode(false); setEmailError(''); }} className="flex-1 btn-ghost justify-center">{t('prof.cancel')}</button>
              <button onClick={saveEmail} disabled={emailSaving} className="flex-1 btn-primary">{emailSaving ? '…' : t('prof.save')}</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#c9c2b8]">{t('login.email')}</span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[#f4f1ec]">{currentEmail}</span>
              <button onClick={() => setEmailMode(true)} className="text-xs text-[#a39c93] hover:text-[#f5f5f5] transition-colors px-2 py-0.5" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6 }}>{t('prof.change')}</button>
            </div>
          </div>
        )}

        {/* Telefon */}
        {phoneMode === 'idle' && (
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#c9c2b8]">{t('prof.phone')}</span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[#f4f1ec]">{currentPhone || '—'}</span>
              <button onClick={() => setPhoneMode('enter')} className="text-xs text-[#a39c93] hover:text-[#f5f5f5] transition-colors px-2 py-0.5" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6 }}>
                {currentPhone ? t('prof.change') : t('prof.add')}
              </button>
            </div>
          </div>
        )}
        {phoneMode === 'enter' && (
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-xs text-[#a39c93]">{currentPhone ? t('prof.newPhone') : t('prof.addPhone')}</p>
            <div className="flex gap-2">
              <CountryCodeButton country={phoneCountry} onChange={(c) => { setPhoneCountry(c); setPhoneError(''); }} />
              <input type="tel" value={newPhone} onChange={e => { setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 15)); setPhoneError(''); }} placeholder={phoneCountry === 'TR' ? '5XX XXX XX XX' : ''} className="input-glass flex-1 px-4 py-3 text-sm" />
            </div>
            {phoneError && <p className="text-[#ff6b6b] text-xs">{phoneError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setPhoneMode('idle'); setPhoneError(''); setNewPhone(''); }} className="flex-1 btn-ghost justify-center">{t('prof.cancel')}</button>
              <button onClick={sendPhoneOtp} disabled={phoneSaving} className="flex-1 btn-primary">{phoneSaving ? '…' : t('prof.sendCode')}</button>
            </div>
          </div>
        )}
        {phoneMode === 'otp' && (
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-xs text-[#a39c93]">{t('prof.codeSent', { phone: newPhoneE164 ?? '' })}</p>
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
            <OtpCountdown seconds={phoneCountdown.seconds} className="text-xs text-[#a39c93] text-center" />
            {phoneError && <p className="text-[#ff6b6b] text-xs text-center">{phoneError}</p>}
            <button type="button" onClick={sendPhoneOtp} disabled={phoneCountdown.waiting || phoneSaving} className="text-xs text-[#a39c93] hover:text-[#888] transition-colors text-center disabled:opacity-40 disabled:cursor-not-allowed">{t('prof.resend')}</button>
            <div className="flex gap-2">
              <button onClick={() => { setPhoneMode('enter'); setPhoneError(''); setPhoneOtp(['', '', '', '', '', '']); phoneCountdown.start(0); }} className="flex-1 btn-ghost justify-center">{t('prof.back')}</button>
              <button onClick={verifyPhoneOtp} disabled={phoneSaving || phoneOtp.join('').length !== 6} className="flex-1 btn-primary disabled:opacity-40">{phoneSaving ? '…' : t('prof.verify')}</button>
            </div>
          </div>
        )}

        {user.occupationSector && (
          <Row label={t('prof.occupation')} value={occupationLabel(user.occupationSector, t)} />
        )}
        {user.profile?.birthDate && (
          <Row label={t('prof.age')} value={`${Math.floor((Date.now() - new Date(user.profile.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))}`} />
        )}
        {user.profile?.gender && (
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#c9c2b8]">{t('prof.gender')}</span>
            {/* Kayıt formundaki seçili cinsiyet etiketiyle aynı görünüm (app/kayit/page.tsx) */}
            <span
              className="flex items-center"
              style={{
                padding: '6px 16px', borderRadius: 9999,
                border: `1.5px solid ${gColor(user.profile.gender)}`,
                boxShadow: `0 0 12px ${gColor(user.profile.gender)}55`,
              }}
            >
              <span className="text-[13px]" style={{ color: gColor(user.profile.gender) }}>{user.profile.gender === 'MALE' ? t('reg.male') : t('reg.female')}</span>
            </span>
          </div>
        )}
        {/* Dil / Language (ENGLISH_ENABLED = false iken gizli) */}
        {ENGLISH_ENABLED && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-[#c9c2b8]">{t('common.language')}</span>
            <div className="flex gap-2">
              {(['tr', 'en'] as const).map((lang) => (
                <button key={lang} type="button" onClick={() => chooseLanguage(lang)} aria-pressed={locale === lang}
                  className="text-xs rounded-lg px-3" style={{ minHeight: 36, border: `1px solid ${locale === lang ? 'rgba(192,57,43,0.5)' : 'rgba(255,255,255,0.08)'}`, color: locale === lang ? '#ff6b6b' : '#c9c2b8', background: 'transparent' }}>
                  {lang === 'tr' ? t('common.turkish') : t('common.english')}{locale === lang ? ' ✓' : ''}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Ana dil (kayıt dili): kilitli, değiştirilemez */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-[#c9c2b8]">{t('prof.nativeLanguage')}</span>
          <span className="flex items-center gap-1.5 text-[13px] text-[#f4f1ec]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a39c93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            {nativeLang === 'tr' ? t('common.turkish') : t('common.english')}
          </span>
        </div>
        {/* Başka konuştuğun diller: seçilebilir satırlar, birden fazla dil işaretlenebilir */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[#a39c93]">{t('prof.otherLanguages')}</span>
          {LANGS.filter((l) => l !== nativeLang).map((l) => (
            <button key={l} type="button" role="checkbox" aria-checked={spoken[l]} onClick={() => toggleSpoken(l)}
              className="flex items-center justify-between rounded-lg px-3 text-left text-sm" style={{ minHeight: 44, border: 'none', cursor: 'pointer', background: spoken[l] ? 'rgba(192,57,43,0.18)' : 'transparent', color: spoken[l] ? '#f4f1ec' : '#c9c2b8' }}>
              <span>{l === 'tr' ? t('common.turkish') : t('common.english')}</span>
              {spoken[l] && <span style={{ color: '#d6453a' }}>✓</span>}
            </button>
          ))}
        </div>
        {/* Kankamla: Aktif Kankanız (davet et / davet var / kankan) + kısa açıklama */}
        <KankaSection />
        {/* Kankamla notunun hemen altında: Kişilik Ağacım ve Numara Engelleme sayfaları (mobille aynı) */}
        <div className="flex gap-2">
          <button onClick={onGoTest} className="flex-1 btn-ghost justify-center">{t('prof.tree')}</button>
          <button onClick={onGoRehber} className="flex-1 btn-ghost justify-center">{t('prof.blocking')}</button>
        </div>
      </Card>

      {/* Aktif şehir */}
      {activeCityConfirm && (
        <div onClick={() => setActiveCityConfirm(false)} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '24px 20px 36px' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f5', marginBottom: 10 }}>{t('prof.attention')}</p>
            <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 20 }}>
              {t('prof.cityWarnPre')} <span style={{ color: '#f5f5f5' }}>{displayPrimaryCity?.name ?? t('prof.yourMainCity')}</span> {t('prof.cityWarnPost')}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setActiveCityConfirm(false); confirmAction.current?.(); confirmAction.current = null; }}
                className="btn-primary w-full justify-center"
              >
                {t('prof.accept')}
              </button>
              <button
                onClick={() => setActiveCityConfirm(false)}
                className="btn-ghost w-full justify-center"
              >
                {t('prof.decline')}
              </button>
            </div>
          </div>
        </div>
      )}
      <Card title={t('prof.activeCityTitle')}>
        <p className="text-xs text-[#a39c93] mb-3">
          {t('prof.activeCityInfo')}
        </p>
        <div className="flex gap-2">
          <Select
            label=""
            value={activeCity}
            onChange={(v) => setActiveCity(v)}
            cities={cities}
            optional
            placeholder={t('reg.pickCityShort')}
            title={t('prof.activeCityQuestion')}
            notified={notified}
            onNotify={notifyRegion}
          />
          <button
            onClick={() => { const v = activeCity || null; askConfirm(() => saveActiveCity(v)); }}
            disabled={savingActiveCity}
            className="btn-primary disabled:opacity-50 whitespace-nowrap"
          >
            {savingActiveCity ? '…' : t('prof.save')}
          </button>
        </div>
        {activeCity && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-[#a39c93]">
              {t('prof.activeLabel')} <span className="text-[#f5f5f5]">{cities.find(c => c.id === activeCity)?.name ?? '—'}</span>
            </span>
            <button
              onClick={() => (inMatching ? askConfirm(() => saveActiveCity(null)) : saveActiveCity(null))}
              disabled={savingActiveCity}
              className="text-xs text-[#a39c93] hover:text-[#f5f5f5] transition-colors px-3 py-1"
              style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
            >
              {t('prof.clear')}
            </button>
          </div>
        )}
        {activeCity && (
          <p className="text-xs text-[#a39c93] mt-1.5">
            {t('prof.untilCancel')}
          </p>
        )}
        {saveError && <p className="text-accent text-sm mt-1">{saveError}</p>}
      </Card>

      {/* Şehir: ana şehir yalnız gösterilir (düzenleme yok) */}
      <Card title={t('prof.city')}>
        <Row label={t('prof.mainCity')} value={displayPrimaryCity?.name ?? '—'} />
      </Card>

      {/* Mekan tercihi */}
      <Card title={t('prof.venueTitle')} action={!editingVenue ? { label: t('prof.edit'), onClick: () => setEditingVenue(true) } : undefined}>
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
                      <p className="text-sm font-medium" style={{ color: selected ? '#ff6b6b' : '#f5f5f5' }}>{t(opt.label)}</p>
                      <p className="text-xs text-[#a39c93] mt-0.5">{t(opt.description)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
            {saveError && <p className="text-accent text-sm">{saveError}</p>}
            <div className="flex gap-2 mt-1">
              <button onClick={() => setEditingVenue(false)} className="flex-1 btn-ghost justify-center">{t('prof.cancel')}</button>
              <button onClick={saveVenuePreference} disabled={saving} className="flex-1 btn-primary">
                {saving ? 'Kaydediliyor…' : t('prof.save')}
              </button>
            </div>
          </div>
        ) : (
          <Row
            label={t('prof.preference')}
            value={t(VENUE_LABELS[displayVenuePreference])}
          />
        )}
      </Card>

      {/* Oturum ve hesap */}
      <div className="flex flex-col items-center gap-3 pb-2">
        <button onClick={() => setReportOpen(true)} className="mx-auto block btn-ghost" style={ACCOUNT_BTN}>
          {t('report.title')}
        </button>
        <button onClick={logoutAll} disabled={logoutAllBusy} className="mx-auto block btn-ghost disabled:opacity-40" style={ACCOUNT_BTN}>
          {logoutAllBusy ? t('prof.loggingOut') : t('prof.logoutAll')}
        </button>
        {deletePending ? (
          <p className="text-xs text-[#a39c93] text-center">{t('prof.deletePending')}</p>
        ) : (
          <button onClick={() => { setDeleteError(''); setDeleteOpen(true); }} className="mx-auto block btn-ghost btn-ghost-red-dot" style={ACCOUNT_BTN}>
            {t('prof.deleteMine')}
          </button>
        )}
      </div>

      <ProblemReportModal open={reportOpen} onClose={() => setReportOpen(false)} screen="Profilim" />

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title={t('prof.deleteMine')}>
        <p className="text-sm text-[#c9c2b8] leading-relaxed">
          {t('prof.deleteBody')}
        </p>
        {deleteError && <p className="text-[#ff6b6b] text-sm mt-3">{deleteError}</p>}
        <div className="mt-5 flex flex-col gap-3">
          <button type="button" onClick={confirmDelete} disabled={deleteBusy} className="mx-auto block btn-primary btn-tone-danger disabled:opacity-40" style={{ width: '72%' }}>
            {deleteBusy ? t('phone.sending') : t('prof.deleteConfirm')}
          </button>
          <button type="button" onClick={() => setDeleteOpen(false)} className="mx-auto block btn-primary btn-tone-safe" style={{ width: '72%' }}>
            {t('prof.keep')}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Yardımcı alt bileşenler ──────────────────────────────────────────────

export function TabProfilimSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="ll-card h-16 animate-pulse" />
      <div className="ll-card"><SkeletonBlock lines={4} /></div>
      <div className="ll-card"><SkeletonBlock lines={2} /></div>
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: { label: string; onClick: () => void }; }) {
  return (
    <div className="ll-card">
      <div className="ll-head">
        <h3 className="ll-title">{title}</h3>
        {action && (
          <button
            onClick={action.onClick}
            className="text-xs text-[#a39c93] hover:text-[#f5f5f5] transition-colors px-3 py-1"
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

// Açık / kapalı anahtar satırı
function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-[#c9c2b8]">{label}</span>
      <span className="text-[13px] text-[#f4f1ec]" style={color ? { color } : undefined}>{value}</span>
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

function CityPickerModalP({ cities, value, onChange, onClose, optional, title, notified, onNotify }: {
  cities: City[]; value: string; onChange: (v: string) => void; onClose: () => void;
  optional?: boolean; title: string; notified?: string[]; onNotify?: (id: string) => void;
}) {
  const t = useTranslations();
  const [tmp, setTmp] = useState(value);
  // Üst grup seçilebilir bölgeler; "Yakında" grubu pasif bölgeler (soluk, seçilemez, sağda "Haber ver")
  const sorted = sortCitiesP(cities.filter((c) => c.isActive !== false));
  const soon = cities.filter((c) => c.isActive === false);
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
              {t('reg.noCity')}
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
          {soon.length > 0 && (
            <>
              <div role="separator" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 4px', color: '#8f887f', fontSize: 11 }}>
                <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />{t('common.comingSoon')}<span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
              </div>
              {soon.map((c) => {
                const done = notified?.includes(c.id);
                return (
                  <div key={c.id} aria-disabled="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 14px', fontSize: 15, color: 'rgba(204,204,204,0.4)' }}>
                    <span>{c.name}<span style={{ marginLeft: 8, padding: '1px 7px', borderRadius: 999, border: '1px solid rgba(143,136,127,0.4)', fontSize: 10, color: '#8f887f' }}>{t('common.comingSoon')}</span></span>
                    {onNotify && (
                      <button type="button" disabled={done} onClick={() => onNotify(c.id)}
                        style={{ minHeight: 32, padding: '0 10px', fontSize: 11, borderRadius: 999, border: '1px solid rgba(192,57,43,0.5)', background: done ? 'transparent' : 'rgba(192,57,43,0.10)', color: done ? '#8f887f' : '#ff6b6b', cursor: done ? 'default' : 'pointer' }}>
                        {done ? t('common.notified') : t('common.notifyMe')}
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
        <button onClick={() => { onChange(tmp); onClose(); }} className="btn-primary w-full justify-center" style={{ marginTop: 16 }}>
          {t('reg.select')}
        </button>
      </div>
    </div>
  );
}
function Select({ label, value, onChange, cities, optional, placeholder, title, notified, onNotify }: {
  label: string; value: string; onChange: (v: string) => void; cities: City[]; optional?: boolean; placeholder?: string; title?: string; notified?: string[]; onNotify?: (id: string) => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const found = cities.find(c => c.id === value);
  const display = found ? cityLabelP(found.name) : (optional ? (placeholder ?? t('reg.noCity')) : t('reg.pickCityShort'));
  return (
    <div className="flex-1">
      {label && <label className="block text-xs text-[#c9c2b8] mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ width: '100%', background: 'rgba(255,255,255,0.10)', border: `1px solid ${value ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 12, padding: '11px 14px', fontSize: 14, color: value ? '#f5f5f5' : 'rgba(255,255,255,0.55)', textAlign: 'left', cursor: 'pointer', outline: 'none', WebkitTapHighlightColor: 'transparent' }}
      >
        {display}
      </button>
      {open && <CityPickerModalP cities={cities} value={value} onChange={onChange} onClose={() => setOpen(false)} optional={optional} title={title ?? t('reg.pickCityShort')} notified={notified} onNotify={onNotify} />}
    </div>
  );
}
