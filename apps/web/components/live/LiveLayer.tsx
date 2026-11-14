'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
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
const TABLE_TEXT: Record<MasaTuru, { title: string; note: string }> = {
  GROUP: { title: 'Grup masası kurulmasına', note: "Perşembe 23:59'da masa kapanır." },
  ONE_ON_ONE: { title: 'Baş Başa masası kurulmasına', note: "Cuma 23:59'da masa kapanır." },
  KANKA: { title: 'Kankamla masası kurulmasına', note: "Cumartesi 23:59'da masa kapanır." },
};

const OCEAN_LABEL: Record<OceanKey, string> = {
  openness: 'Açıklık',
  conscientiousness: 'Sorumluluk',
  extraversion: 'Dışadönüklük',
  agreeableness: 'Uyumluluk',
  neuroticism: 'Duygusal Denge',
};

const pad = (n: number) => String(n).padStart(2, '0');
const num = (n: number) => n.toLocaleString('tr-TR');

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
function Countdown({ day, targetAt }: { day: number; targetAt?: number | null }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, (targetAt ?? getNextTarget(day).getTime()) - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [day, targetAt]);

  const ms = left ?? 0;
  const units = [
    { label: 'GÜN', value: Math.floor(ms / 86_400_000) },
    { label: 'SAAT', value: Math.floor((ms % 86_400_000) / 3_600_000) },
    { label: 'DAKİKA', value: Math.floor((ms % 3_600_000) / 60_000) },
    { label: 'SANİYE', value: Math.floor((ms % 60_000) / 1000) },
  ];
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 8, margin: '14px 0' }}>
      {units.map((u, i) => (
        <div key={u.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {i > 0 && <span className="ll-serif" style={{ fontSize: 40, lineHeight: 1, color: '#6e6860' }}>:</span>}
          <div style={{ textAlign: 'center', minWidth: 52 }}>
            <div className={`ll-serif${u.label === 'SANİYE' ? ' ll-blink' : ''}`} style={{ fontSize: 40, lineHeight: 1 }}>{pad(u.value)}</div>
            <div style={{ fontSize: 10, color: '#a39c93', marginTop: 6 }}>{u.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Seviye rengi: 1 en opak, 4 en soluk
const LEVEL_ALPHA = { 1: 'd9', 2: 'a6', 3: '73', 4: '4d' } as const;

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

export default function LiveLayer({ activePlan, hasTabTable, tabSeatsLeft, meetingAt, scanOff, tab, statuses, tabPastClosing, onTab, notice, participation }: {
  activePlan: string | null;
  hasTabTable: boolean; // Seçili türde kullanıcının masası var mı
  tabSeatsLeft: number | null; // Kullanıcının masasındaki boş sandalye; masası yoksa null
  scanOff?: boolean; // Kurulmuş masası admin tarafından iptal edildi: tarama animasyonu başlamaz
  meetingAt: string | null; // Kurulmuş aktif masanın buluşma anı (buluşmadan 3 saat sonrasına kadar); yoksa null
  tab: MasaTuru;
  statuses: Record<MasaTuru, TabStatus>;
  tabPastClosing: boolean; // Seçili türün bu haftaki kapanışı geçti mi
  onTab: (tab: MasaTuru) => void;
  notice?: React.ReactNode; // Sekmelerin hemen üstü
  participation: React.ReactNode;
}) {
  const router = useRouter();
  // Şehir backend'de activeCity → primaryCity sırasıyla çözülür
  const overview = useLivePoll<LiveOverview>('/meetings/live/overview', OVERVIEW_MS);
  const pulse = useLivePoll<LivePulse>('/meetings/live/pulse', PULSE_MS);
  const waitingScan = tabPastClosing && !hasTabTable;
  // Kurulmuş aktif masa: sayaç buluşmaya sayar, yeni haftaya geçmez
  const meetingTarget = hasTabTable && meetingAt ? Date.parse(meetingAt) : null;

  const seats = overview?.groupSeatsLeft ?? null;

  function primaryAction() {
    router.push(overview?.hasTable || activePlan ? '/profil?tab=masalar' : '/profil?tab=paket');
  }

  return (
    <div className="live-layer">
      <div className="ll-glow" aria-hidden="true" />
      <div className="ll-column">
        {notice}
        <LiveTabs tab={tab} statuses={statuses} onTab={onTab} />

        {/* Geri sayım */}
        <section className="ll-card" style={{ borderColor: 'rgba(232,162,122,0.22)', background: 'linear-gradient(160deg, rgba(214,69,58,0.14), rgba(255,255,255,0.02) 60%)' }}>
          {hasTabTable && statuses[tab] === 'FORMING' && (
            <Image src="/maskot/jantihaydar_run.webp" alt="Janti Haydar" width={960} height={1639} className="block mx-auto h-auto w-[80px] md:w-[100px]" />
          )}
          {!hasTabTable && (
            <Image src="/maskot/jantihaydar_stop.webp" alt="Janti Haydar" width={960} height={1639} className="block mx-auto h-auto w-[80px] md:w-[100px]" />
          )}
          <p key={tab} className="ll-eyebrow ll-fade">{meetingTarget !== null ? 'Buluşmanıza kalan süre' : waitingScan ? 'Yeni tarama başlamasına' : TABLE_TEXT[tab].title}</p>
          <Countdown day={waitingScan ? SCAN_START_DAY : CLOSING_DAY[tab]} targetAt={meetingTarget} />
          <p style={{ margin: 0, fontSize: 13, color: '#c9c2b8', lineHeight: 1.5 }}>
            {waitingScan ? "Pazar 23:59'da yeni tarama başlar." : TABLE_TEXT[tab].note}
            {!waitingScan && tabSeatsLeft !== null && !(meetingTarget !== null && tabSeatsLeft === 0) && (
              <span style={{ display: 'block' }}>
                {tabSeatsLeft > 0 ? `Masanızda ${num(tabSeatsLeft)} boş koltuk kaldı.` : 'Masanızda kontenjan doldu.'}
              </span>
            )}
          </p>
        </section>

        <div className={scanOff || statuses[tab] === 'KYC' || statuses[tab] === 'KANKA' ? 'll-scan-off' : undefined}>
          <LiveSonar sonar={pulse?.sonar ?? null} />
        </div>
        <div key={tab} className="ll-fade">{participation}</div>
        <LiveFeed feed={pulse?.feed ?? null} />

        {/* Isı haritası */}
        <section>
          <div className="ll-head">
            <h2 className="ll-title">Semt Masa Yoğunluğu</h2>
          </div>
          {overview?.density ? (
            <div className="ll-heat">
              {overview.density.districts.map((d) => (
                <div key={d.name} className="ll-heat-cell" style={{ background: `${LEVELS[d.level].color}${LEVEL_ALPHA[d.level]}` }}>
                  <span style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  <span className="ll-mono" style={{ fontSize: d.percent === null ? 11 : 15 }}>{d.percent === null ? LEVELS[d.level].label : `%${d.percent}`}</span>
                </div>
              ))}
            </div>
          ) : overview?.heatmap.length ? (
            <div className="ll-heat">
              {overview.heatmap.map((d, i) => (
                <div key={d.name} className="ll-heat-cell" style={{ background: heatColor(i, overview.heatmap.length) }}>
                  <span style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  <span className="ll-mono" style={{ fontSize: 15 }}>%{d.percent}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: '#a39c93' }}>Bu hafta için ilçe verisi henüz yok.</p>
          )}
        </section>

        {/* Uyum sinyali */}
        {overview && (
          <section className="ll-card">
            <p className="ll-eyebrow">UYUM SİNYALİ</p>
            <p className="ll-serif" style={{ fontSize: 26, lineHeight: 1.25, margin: '10px 0 16px' }}>
              Profiline yakın <span style={{ color: '#ff8a7e' }}>{num(overview.signal.closeCount)} kişi</span> bu hafta havuzda.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {overview.signal.top.map((d) => (
                <div key={d.key} style={{ display: 'grid', gridTemplateColumns: '104px 1fr 28px', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#c9c2b8' }}>{OCEAN_LABEL[d.key]}</span>
                  <div className="ll-bar" style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)' }}>
                    <span style={{ background: 'linear-gradient(90deg, #d6453a, #e8a27a)', transform: `scaleX(${d.score / 100})` }} />
                  </div>
                  <span className="ll-mono" style={{ fontSize: 11, textAlign: 'right' }}>{d.score}</span>
                </div>
              ))}
            </div>
            {overview.signal.commonDimension && (
              <p style={{ margin: '14px 0 0', fontSize: 13, color: '#c9c2b8' }}>
                Masandaki kişilerle en güçlü ortak noktan: <strong style={{ color: '#f4f1ec' }}>{OCEAN_LABEL[overview.signal.commonDimension]}</strong>
              </p>
            )}
          </section>
        )}

        <button type="button" className="ll-cta" onClick={primaryAction}>
          {overview?.hasTable ? 'Masanı Gör' : seats !== null ? `Masanı Ayır · ${num(seats)} koltuk kaldı` : 'Masanı Ayır'}
        </button>
      </div>
    </div>
  );
}
