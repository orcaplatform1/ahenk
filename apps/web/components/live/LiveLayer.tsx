'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { getNextTarget } from '@/components/HeroCountdown';
import { CLOSING_DAY, SCAN_START_DAY } from './useMasaTabs';
import type { MasaTuru } from '@ahenk/ui';
import LiveSonar from './LiveSonar';
import { LEVELS } from './levels';
import LiveFeed from './LiveFeed';
import LiveTabs, { type TabStatus } from './LiveTabs';
import type { LiveOverview, LivePulse, OceanKey } from './types';

const PULSE_MS = 15_000;
const OVERVIEW_MS = 60_000;
// Masa türüne göre kart metinleri
// Metinler çeviri anahtarı: live.until<TÜR>, live.closes<TÜR>, live.ocean<Boyut>
const oceanKey = (k: OceanKey) => `live.ocean${k[0].toUpperCase()}${k.slice(1)}`;

const pad = (n: number) => String(n).padStart(2, '0');
const num = (n: number, locale = 'tr') => n.toLocaleString(locale === 'en' ? 'en-GB' : 'tr-TR');

function useLivePoll<T>(path: string | null, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    const load = () => {
      if (document.hidden) return;
      // Başarısız ya da boş yanıt ekrandaki veriyi silmez
      api.get<T>(path).then((d) => { if (alive && d) setData(d); }).catch(() => undefined);
    };
    load();
    const id = setInterval(load, intervalMs);
    // Arka plandan dönüş, odak ve internetin geri gelmesinde yeniden çekilir
    document.addEventListener('visibilitychange', load);
    window.addEventListener('focus', load);
    window.addEventListener('online', load);
    return () => {
      alive = false; clearInterval(id);
      document.removeEventListener('visibilitychange', load);
      window.removeEventListener('focus', load);
      window.removeEventListener('online', load);
    };
  }, [path, intervalMs]);
  return data;
}

// targetAt verilirse o ana (buluşma), verilmezse günün bir sonraki 23:59'una sayar
export function Countdown({ day, targetAt }: { day: number; targetAt?: number | null }) {
  const t = useTranslations();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, (targetAt ?? getNextTarget(day).getTime()) - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [day, targetAt]);

  const ms = left ?? 0;
  const units = [
    { key: 'days', value: Math.floor(ms / 86_400_000) },
    { key: 'hours', value: Math.floor((ms % 86_400_000) / 3_600_000) },
    { key: 'minutes', value: Math.floor((ms % 3_600_000) / 60_000) },
    { key: 'seconds', value: Math.floor((ms % 60_000) / 1000) },
  ];
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 8, margin: '14px 0' }}>
      {units.map((u, i) => (
        <div key={u.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {i > 0 && <span className="ll-serif" style={{ fontSize: 40, lineHeight: 1, color: '#6e6860' }}>:</span>}
          <div style={{ textAlign: 'center', minWidth: 52 }}>
            <div className={`ll-serif${u.key === 'seconds' ? ' ll-blink' : ''}`} style={{ fontSize: 40, lineHeight: 1 }}>{pad(u.value)}</div>
            <div style={{ fontSize: 10, color: '#a39c93', marginTop: 6 }}>{t(`live.${u.key}`)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Seviye rengi: 1 en opak, 4 en soluk
const LEVEL_ALPHA = { 1: 'd9', 2: 'a6', 3: '73', 4: '4d' } as const;
// Tarama bekleme durumu: yoğunluk kartları "Düşük" kartının grisinde, yazı "Tarama bekleniyor"
const WAIT_CELL = `${LEVELS[4].color}${LEVEL_ALPHA[4]}`;

// Yoğunluk sırasına göre üç bant; bant içinde sıra ilerledikçe renk solar
function heatColor(index: number, count: number) {
  const band = count <= 1 ? 0 : Math.min(2, Math.floor((index / count) * 3));
  const start = Math.ceil((count * band) / 3);
  const end = Math.ceil((count * (band + 1)) / 3) - 1;
  const t = end > start ? (index - start) / (end - start) : 0;
  const mix = (a: number, b: number) => (a + (b - a) * t).toFixed(3);
  if (band === 0) return `rgba(214,69,58,${mix(0.78, 0.46)})`;
  if (band === 1) return `rgba(200,116,60,${mix(0.48, 0.24)})`;
  return `rgba(255,255,255,${mix(0.08, 0.045)})`;
}

export default function LiveLayer({ activePlan, hasTabTable, tabSeatsLeft, meetingAt, tab, statuses, tabPastClosing, noPackage = false, onTab, notice, afterTabs, participation }: {
  activePlan: string | null;
  hasTabTable: boolean; // Seçili türde kullanıcının masası var mı
  tabSeatsLeft: number | null; // Kullanıcının masasındaki boş sandalye; masası yoksa null
  meetingAt: string | null; // Kurulmuş aktif masanın buluşma anı (buluşmadan 3 saat sonrasına kadar); yoksa null
  tab: MasaTuru;
  statuses: Record<MasaTuru, TabStatus>;
  tabPastClosing: boolean; // Seçili türün bu haftaki kapanışı geçti mi
  noPackage?: boolean; // Hiç paketi yok ya da hakları bitmiş: sayaç kartı yerine paket alma kartı
  onTab: (tab: MasaTuru) => void;
  notice?: React.ReactNode; // Sekmelerin hemen üstü
  afterTabs?: React.ReactNode; // Sekmelerin (halkaların) hemen altı: seçim kartı (mobil ile aynı yer)
  participation: React.ReactNode;
}) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const WAIT_TEXT = t('live.waitScan');
  // Şehir backend'de activeCity → primaryCity sırasıyla çözülür
  const overview = useLivePoll<LiveOverview>('/meetings/live/overview', OVERVIEW_MS);
  const pulse = useLivePoll<LivePulse>('/meetings/live/pulse', PULSE_MS);
  const waitingScan = tabPastClosing && !hasTabTable;
  // Kurulmuş aktif masa: sayaç buluşmaya sayar, yeni haftaya geçmez
  const meetingTarget = hasTabTable && meetingAt ? Date.parse(meetingAt) : null;
  // PASİF: tarama başlamadı (geri sayım kartında "Yeni tarama başlamasına"); CANLI: tarama başlamış. Rozet, radar, semt noktaları ve
  // yoğunluk kartları yalnız bu tek durumdan okunur (mobil ile aynı)
  const scanIdle = meetingTarget === null && waitingScan;

  const seats = overview?.groupSeatsLeft ?? null;

  function primaryAction() {
    router.push(overview?.hasTable || activePlan ? '/profil?tab=masalar' : '/profil?tab=paket');
  }

  return (
    <div className="live-layer">
      <div className="ll-glow" aria-hidden="true" />
      <div className="ll-column">
        {notice}
        <LiveTabs tab={tab} statuses={statuses} onTab={onTab} noRings even />
        {afterTabs}

        {/* Geri sayım; hiç paketi olmayan ya da hakları biten kullanıcıda aynı yerde, aynı kart görünümünde paket alma kartı */}
        {noPackage ? (
          <section className="ll-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderColor: 'rgba(232,162,122,0.22)', background: 'linear-gradient(160deg, rgba(214,69,58,0.14), rgba(255,255,255,0.02) 60%)' }}>
            <h2 className="ll-title">{t('live.pkgCardTitle')}</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#c9c2b8', lineHeight: 1.5 }}>{t('live.pkgCardText')}</p>
            <button type="button" className="btn-primary w-full justify-center" style={{ minHeight: 44 }} onClick={() => router.push('/profil?tab=paket')}>
              {t('live.pkgCardBtn')}
            </button>
          </section>
        ) : (
        <section className="ll-card" style={{ borderColor: 'rgba(232,162,122,0.22)', background: 'linear-gradient(160deg, rgba(214,69,58,0.14), rgba(255,255,255,0.02) 60%)' }}>
          <p key={tab} className="ll-eyebrow ll-fade">{meetingTarget !== null ? t('live.untilMeeting') : waitingScan ? t('live.untilScan') : t(`live.until${tab}`)}</p>
          <Countdown day={waitingScan ? SCAN_START_DAY : CLOSING_DAY[tab]} targetAt={meetingTarget} />
          <p style={{ margin: 0, fontSize: 13, color: '#c9c2b8', lineHeight: 1.5 }}>
            {waitingScan ? t('live.scanStarts') : t(`live.closes${tab}`)}
            {!waitingScan && tabSeatsLeft !== null && !(meetingTarget !== null && tabSeatsLeft === 0) && (
              <span style={{ display: 'block' }}>
                {tabSeatsLeft > 0 ? t('live.seatsLeft', { count: num(tabSeatsLeft, locale) }) : t('live.tableFull')}
              </span>
            )}
          </p>
        </section>
        )}

        {/* PASİF: tarama dilimi bulunduğu açıda durur (ll-scan-idle, gizlenmez); CANLI: sürekli döner */}
        <div className={scanIdle ? 'll-scan-idle' : undefined}>
          <LiveSonar sonar={pulse?.sonar ?? null} idle={scanIdle} />
        </div>
        <div key={tab} className="ll-fade">{participation}</div>
        <LiveFeed feed={pulse?.feed ?? null} tz={overview?.timezone} />

        {/* Isı haritası */}
        <section>
          <div className="ll-head" style={{ alignItems: 'center' }}>
            <h2 className="ll-title">{t('live.heatTitle')}</h2>
            {scanIdle && <span style={{ fontSize: 13, color: '#FFFFFF', opacity: 0.6 }}>{WAIT_TEXT}</span>}
          </div>
          {overview?.density ? (
            <div className="ll-heat">
              {overview.density.districts.map((d) => (
                <div key={d.name} className="ll-heat-cell" style={{ background: scanIdle ? WAIT_CELL : `${LEVELS[d.level].color}${LEVEL_ALPHA[d.level]}` }}>
                  <span style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  {!scanIdle && <span className="ll-mono" style={{ fontSize: d.percent === null ? 11 : 15 }}>{d.percent === null ? t(LEVELS[d.level].label) : `%${d.percent}`}</span>}
                </div>
              ))}
            </div>
          ) : overview?.heatmap.length ? (
            <div className="ll-heat">
              {overview.heatmap.map((d, i) => (
                <div key={d.name} className="ll-heat-cell" style={{ background: scanIdle ? WAIT_CELL : heatColor(i, overview.heatmap.length) }}>
                  <span style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  {!scanIdle && <span className="ll-mono" style={{ fontSize: 15 }}>{`%${d.percent}`}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: '#a39c93' }}>{t('live.heatEmpty')}</p>
          )}
        </section>

        {/* Uyum sinyali */}
        {overview && (
          <section className="ll-card">
            <p className="ll-eyebrow">{t('live.signal')}</p>
            <p className="ll-serif" style={{ fontSize: 26, lineHeight: 1.25, margin: '10px 0 16px' }}>
              {t('live.signalPre')} <span style={{ color: '#ff8a7e' }}>{t('live.signalPeople', { count: num(overview.signal.closeCount, locale) })}</span> {t('live.signalPost')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {overview.signal.top.map((d) => (
                <div key={d.key} style={{ display: 'grid', gridTemplateColumns: '104px 1fr 28px', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#c9c2b8' }}>{t(oceanKey(d.key))}</span>
                  <div className="ll-bar" style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)' }}>
                    <span style={{ background: 'linear-gradient(90deg, #d6453a, #e8a27a)', transform: `scaleX(${d.score / 100})` }} />
                  </div>
                  <span className="ll-mono" style={{ fontSize: 11, textAlign: 'right' }}>{d.score}</span>
                </div>
              ))}
            </div>
            {overview.signal.commonDimension && (
              <p style={{ margin: '14px 0 0', fontSize: 13, color: '#c9c2b8' }}>
                {t('live.commonDim')} <strong style={{ color: '#f4f1ec' }}>{t(oceanKey(overview.signal.commonDimension))}</strong>
              </p>
            )}
          </section>
        )}

        <button type="button" className="ll-cta" onClick={primaryAction}>
          {overview?.hasTable ? t('live.seeTable') : seats !== null ? t('live.reserveSeats', { count: num(seats, locale) }) : t('live.reserve')}
        </button>
      </div>
    </div>
  );
}
