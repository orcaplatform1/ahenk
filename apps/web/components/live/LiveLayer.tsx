'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getNextTarget } from '@/components/HeroCountdown';
import type { MasaTuru } from '@ahenk/ui';
import LiveSonar from './LiveSonar';
import { LEVELS } from './levels';
import LiveFeed from './LiveFeed';
import LiveTabs, { type TabStatus } from './LiveTabs';
import type { LiveFill, LiveOverview, LivePulse, OceanKey } from './types';

const PULSE_MS = 15_000;
const OVERVIEW_MS = 60_000;
// Masa türüne göre kapanış günü ve kart metinleri (0=Pazar … 6=Cumartesi, 23:59)
const TABLE_TEXT: Record<MasaTuru, { day: number; title: string; note: string }> = {
  GROUP: { day: 4, title: 'Grup masası kurulmasına', note: "Perşembe 23:59'da masalar kapanır." },
  ONE_ON_ONE: { day: 5, title: 'Baş Başa masası kurulmasına', note: "Cuma 23:59'da masalar kapanır." },
  KANKA: { day: 6, title: 'Kankamla masası kurulmasına', note: "Cumartesi 23:59'da masalar kapanır." },
};

// Yeni tarama her Pazar 23:59'da başlar (getNextTarget ile aynı döngü)
const SCAN_START_DAY = 0;

// Türün bu haftaki kapanışı geçti mi: bir sonraki tarama başlangıcı bir sonraki kapanıştan önce geliyorsa
export function isPastClosing(tab: MasaTuru) {
  return getNextTarget(SCAN_START_DAY).getTime() < getNextTarget(TABLE_TEXT[tab].day).getTime();
}

const MASA_TURLERI: MasaTuru[] = ['GROUP', 'ONE_ON_ONE', 'KANKA'];

const OCEAN_LABEL: Record<OceanKey, string> = {
  openness: 'Açıklık',
  conscientiousness: 'Sorumluluk',
  extraversion: 'Dışadönüklük',
  agreeableness: 'Uyumluluk',
  neuroticism: 'Duygusal Denge',
};

const pad = (n: number) => String(n).padStart(2, '0');
const num = (n: number) => n.toLocaleString('tr-TR');

// Şehir adına bulunma eki: İstanbul'da, İzmir'de
function locative(name: string) {
  const vowels = name.toLocaleLowerCase('tr-TR').match(/[aıoueiöü]/g) ?? [];
  const back = 'aıou'.includes(vowels[vowels.length - 1] ?? 'e');
  const hard = /[fstkçşhp]$/i.test(name);
  return `${name}'${hard ? 't' : 'd'}${back ? 'a' : 'e'}`;
}

function useLivePoll<T>(path: string | null, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    const load = () => {
      if (document.hidden) return;
      api.get<T>(path).then((d) => { if (alive) setData(d); }).catch(() => undefined);
    };
    load();
    const id = setInterval(load, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [path, intervalMs]);
  return data;
}

function Countdown({ day }: { day: number }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, getNextTarget(day).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [day]);

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

function FillRow({ label, fill, gradient }: { label: string; fill: LiveFill; gradient: string }) {
  const ratio = fill.total ? Math.min(1, fill.filled / fill.total) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 13 }}>{label}</span>
        <span className="ll-mono" style={{ fontSize: 12, color: '#c9c2b8' }}>{num(fill.filled)} / {num(fill.total)}</span>
      </div>
      <div className="ll-bar" style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.07)' }}>
        <span style={{ background: gradient, transform: `scaleX(${ratio})` }} />
      </div>
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

export default function LiveLayer({ activePlan, hasTabTable, tab, rights, tables, onTab, notice, participation }: {
  activePlan: string | null;
  hasTabTable: boolean; // Seçili türde kullanıcının masası var mı
  tab: MasaTuru;
  rights: Record<MasaTuru, boolean>; // Türde aktif paket hakkı
  tables: Record<MasaTuru, boolean>; // Türde bu hafta masa
  onTab: (tab: MasaTuru) => void;
  notice?: React.ReactNode; // Sekmelerin hemen üstü
  participation: React.ReactNode;
}) {
  const router = useRouter();
  // Şehir backend'de activeCity → primaryCity sırasıyla çözülür
  const overview = useLivePoll<LiveOverview>('/meetings/live/overview', OVERVIEW_MS);
  const pulse = useLivePoll<LivePulse>('/meetings/live/pulse', PULSE_MS);
  const pastList = () => MASA_TURLERI.filter(isPastClosing).join();
  const [pastClosed, setPastClosed] = useState(pastList);

  // Tarama başlayınca/kapanınca kart sayfa yenilenmeden değişsin
  useEffect(() => {
    const id = setInterval(() => setPastClosed(pastList()), 1000);
    return () => clearInterval(id);
  }, []);

  const statusOf = (t: MasaTuru): TabStatus => {
    if (tables[t]) return 'TABLE';
    if (!rights[t]) return 'NONE';
    return pastClosed.split(',').includes(t) ? 'FAILED' : 'SCANNING';
  };
  const statuses = { GROUP: statusOf('GROUP'), ONE_ON_ONE: statusOf('ONE_ON_ONE'), KANKA: statusOf('KANKA') };
  const waitingScan = pastClosed.split(',').includes(tab) && !hasTabTable;

  const city = overview?.city;
  const seats = overview?.groupSeatsLeft ?? null;
  const tabFill = overview ? { GROUP: overview.fill.group, ONE_ON_ONE: overview.fill.oneOnOne, KANKA: overview.fill.kanka }[tab] : null;
  const tabSeats = tabFill && tabFill.total ? Math.max(0, tabFill.total - tabFill.filled) : null;

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
          <p key={tab} className="ll-eyebrow ll-fade">{waitingScan ? 'Yeni tarama başlamasına' : TABLE_TEXT[tab].title}</p>
          <Countdown day={waitingScan ? SCAN_START_DAY : TABLE_TEXT[tab].day} />
          <p style={{ margin: 0, fontSize: 13, color: '#c9c2b8', lineHeight: 1.5 }}>
            {waitingScan ? "Pazar 23:59'da yeni tarama başlar." : TABLE_TEXT[tab].note}
            {!waitingScan && city && tabSeats !== null && (
              <> {locative(city.name)} <strong style={{ color: '#fff' }}>{num(tabSeats)} koltuk</strong> kaldı.</>
            )}
          </p>
        </section>

        {/* Metrikler */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }} aria-label="Bu hafta özet">
          {[
            { label: 'şu an havuzda', value: overview ? num(overview.metrics.pool) : '–', color: '#f4f1ec' },
            { label: 'bu hafta masa', value: overview ? num(overview.metrics.tables) : '–', color: '#f4f1ec' },
            { label: 'doluluk', value: overview ? `%${overview.metrics.fillPercent}` : '–', color: '#ff8a7e' },
          ].map((m) => (
            <div key={m.label} className="ll-metric">
              <div className="ll-mono" style={{ fontSize: 20, fontWeight: 600, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 11, color: '#a39c93', marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </section>

        <LiveSonar sonar={pulse?.sonar ?? null} />
        <div key={tab} className="ll-fade">{participation}</div>
        <LiveFeed feed={pulse?.feed ?? null} />

        {/* Isı haritası */}
        <section>
          <div className="ll-head">
            <h2 className="ll-title">Semt Isı Haritası</h2>
            <span className="ll-note">bu hafta talep</span>
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

        {/* Dolum */}
        {overview && (
          <section>
            <div className="ll-head"><h2 className="ll-title">Bu Hafta Dolum</h2></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FillRow label="Grup Masası · Cuma" fill={overview.fill.group} gradient="linear-gradient(90deg, #d6453a, #ff8a7e)" />
              <FillRow label="Baş Başa · Cumartesi" fill={overview.fill.oneOnOne} gradient="linear-gradient(90deg, #c8743c, #e8a27a)" />
              <FillRow label="Kankamla" fill={overview.fill.kanka} gradient="linear-gradient(90deg, #8f887f, #c9c2b8)" />
            </div>
          </section>
        )}

        <button type="button" className="ll-cta" onClick={primaryAction}>
          {overview?.hasTable ? 'Masanı Gör' : seats !== null ? `Masanı Ayır · ${num(seats)} koltuk kaldı` : 'Masanı Ayır'}
        </button>
      </div>
    </div>
  );
}
