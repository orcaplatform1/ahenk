'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BG, SURFACE, CARD, BORDER, TEXT, MUTED, RED, GREEN, AMBER, SANS, MONO, LABEL } from '@/lib/adminTheme';


type PlanKey = 'MASADA' | 'KARSIMDA' | 'ICERDE' | 'KANKAMLA';
interface CurrentPrice {
  plan: PlanKey; name: string;
  netKurus: number; webKurus: number; mobileKurus: number;
  webDiscountKurus: number; mobileDiscountKurus: number; updatedAt: string;
}
interface HistoryRow {
  plan: PlanKey; netKurus: number; webKurus: number; mobileKurus: number; createdAt: string;
  createdBy: { profile: { firstName: string; lastName: string } | null } | null;
}
interface PricesResponse { current: CurrentPrice[]; history: HistoryRow[] }

// backend/src/payment/pricing.ts ile aynı formül: web = ham × 1,20; mobil = ham × 1,20 ÷ 0,85; indirimli = × 0,90; tam TL
const roundTL = (k: number) => Math.round(k / 100) * 100;
function compute(netKurus: number) {
  const web = roundTL(netKurus * 1.2);
  const mobile = roundTL((netKurus * 1.2) / 0.85);
  return { web, mobile, webDiscount: roundTL(web * 0.9), mobileDiscount: roundTL(mobile * 0.9) };
}

const tl = (k: number) => `${(k / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`;
// "290,83" → 29083 kuruş
function parseNet(v: string): number | null {
  const n = Number(v.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 1 ? Math.round(n * 100) : null;
}
const PLAN_NAME: Record<PlanKey, string> = { MASADA: 'Masada', KARSIMDA: 'Karşımda', ICERDE: 'İçerde', KANKAMLA: 'Kankamla' };
// Paket hakları (her kısım 4 döngü geçerli)
const PLAN_RIGHTS: Record<PlanKey, string> = { MASADA: '2 grup masası', KARSIMDA: '1 başbaşa masası', ICERDE: '2 grup + 1 başbaşa masası', KANKAMLA: '2 Kankamla masası (kanka ücretsiz)' };

// Geri kazanım indirimi: sabit TL + indirimin uygulanacağı paketler (AppConfig)
function WinbackSettings() {
  const [amount, setAmount] = useState('');
  const [plans, setPlans] = useState<PlanKey[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.get<{ amountTL: number; plans: PlanKey[] }>('/admin/winback')
      .then((d) => { setAmount(String(d.amountTL)); setPlans(d.plans); })
      .catch((e: Error) => setMsg({ ok: false, text: e.message }));
  }, []);

  const toggle = (p: PlanKey) => setPlans((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  async function save() {
    setBusy(true); setMsg(null);
    try {
      await api.patch('/admin/winback', { amountTL: Number(amount), plans });
      setMsg({ ok: true, text: 'İndirim ayarları güncellendi' });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  }

  return (
    <div className="ll-card" style={{ marginTop: 20 }}>
      <h2 className="ll-title" style={{ marginBottom: 10 }}>Geri Kazanım İndirimi</h2>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: MUTED, marginBottom: 12 }}>
        İndirim tutarı
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} inputMode="numeric"
          style={{ width: 90, background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 10px', fontSize: 13, color: TEXT, fontFamily: MONO, outline: 'none' }} />
        ₺
      </label>
      <p style={{ margin: '0 0 6px', fontSize: 12, color: MUTED }}>Uygulanacak paketler</p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        {(Object.keys(PLAN_NAME) as PlanKey[]).map((p) => (
          <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: TEXT, cursor: 'pointer' }}>
            <input type="checkbox" checked={plans.includes(p)} onChange={() => toggle(p)} />
            {PLAN_NAME[p]}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={save} disabled={busy || !amount} style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: SANS, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', color: GREEN, cursor: 'pointer', opacity: busy || !amount ? 0.5 : 1 }}>
          Kaydet
        </button>
        {msg && <span style={{ fontSize: 13, color: msg.ok ? GREEN : RED }}>{msg.text}</span>}
      </div>
    </div>
  );
}

export default function AdminFiyatlar() {
  const [data, setData] = useState<PricesResponse | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function apply(d: PricesResponse) {
    setData(d);
    setInputs(Object.fromEntries(d.current.map((c) => [c.plan, (c.netKurus / 100).toFixed(2).replace('.', ',')])));
  }
  useEffect(() => { api.get<PricesResponse>('/admin/prices').then(apply).catch((e: Error) => setError(`Fiyatlar yüklenemedi: ${e.message}`)); }, []);

  const changes = (data?.current ?? [])
    .map((c) => ({ c, net: parseNet(inputs[c.plan] ?? '') }))
    .filter(({ c, net }) => net !== null && net !== c.netKurus) as { c: CurrentPrice; net: number }[];
  const invalid = (data?.current ?? []).some((c) => parseNet(inputs[c.plan] ?? '') === null);

  async function save() {
    setSaving(true); setError('');
    try {
      const d = await api.patch<PricesResponse>('/admin/prices', { prices: changes.map(({ c, net }) => ({ plan: c.plan, netKurus: net })) });
      apply(d);
      setConfirmOpen(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(`Kaydedilemedi: ${(e as Error).message}`); }
    finally { setSaving(false); }
  }

  const cell: React.CSSProperties = { padding: '8px 10px', fontSize: 13, color: TEXT, fontFamily: MONO, whiteSpace: 'nowrap' };

  return (
    <div className="adm-page" style={{ maxWidth: 900, margin: '0 auto', fontFamily: SANS }}>
      <h1 className="ll-title" style={{ margin: '0 0 14px' }}>Paket Fiyatları</h1>
      {/* Hesaplama notu */}
      <div className="ll-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <h2 className="ll-title">Not</h2>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
          Ham fiyat (KDV hariç) girin. Web fiyatı = ham + %20 KDV. Mobil fiyat = ham + %20 KDV, %15 mağaza komisyonu dahil (÷ 0,85).
          Davet indirimi %10. Tüm fiyatlar tam TL&apos;ye yuvarlanır. Paketler tek seferlik; yeni fiyat sadece bundan sonraki satın almalarda geçerli olur.
        </p>
      </div>
      {error && <p style={{ margin: '0 0 16px', fontSize: 13, color: RED }}>{error}</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {(data?.current ?? []).map((c) => {
          const net = parseNet(inputs[c.plan] ?? '');
          const p = net !== null ? compute(net) : null;
          const changed = net !== null && net !== c.netKurus;
          return (
            <div key={c.plan} className="ll-card" style={{ borderColor: changed ? 'rgba(245,158,11,0.5)' : BORDER }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: TEXT, minWidth: 80 }}>{c.name}</span>
                <span style={{
                  ...LABEL, padding: '2px 8px', borderRadius: 99,
                  background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.25)',
                }}>Tek Seferlik</span>
                <span style={{ fontSize: 10, color: MUTED }}>{PLAN_RIGHTS[c.plan]}</span>
                <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: MUTED }}>
                  Ham fiyat
                  <input
                    value={inputs[c.plan] ?? ''}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [c.plan]: e.target.value.replace(/[^\d.,]/g, '') }))}
                    inputMode="decimal"
                    style={{ width: 110, background: BG, border: `1px solid ${net === null ? RED : BORDER}`, borderRadius: 8, padding: '7px 10px', fontSize: 13, color: TEXT, fontFamily: MONO, outline: 'none' }}
                  />
                  ₺
                </label>
              </div>
              {p && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                  {[
                    ['Web (KDV dahil)', p.web, c.webKurus],
                    ['Web indirimli', p.webDiscount, c.webDiscountKurus],
                    ['Mobil (KDV + %15)', p.mobile, c.mobileKurus],
                    ['Mobil indirimli', p.mobileDiscount, c.mobileDiscountKurus],
                  ].map(([label, now, old]) => (
                    <div key={label as string} style={{ background: SURFACE, borderRadius: 8, padding: '8px 10px' }}>
                      <p style={{ margin: 0, fontSize: 9, color: MUTED, letterSpacing: '0.08em' }}>{label}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: now !== old ? AMBER : TEXT, fontFamily: MONO }}>{tl(now as number)}</p>
                      {now !== old && <p style={{ margin: 0, fontSize: 10, color: MUTED, textDecoration: 'line-through', fontFamily: MONO }}>{tl(old as number)}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={changes.length === 0 || invalid}
          style={{
            padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: SANS,
            background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', color: GREEN,
            cursor: changes.length === 0 || invalid ? 'not-allowed' : 'pointer', opacity: changes.length === 0 || invalid ? 0.5 : 1,
          }}
        >
          Kaydet
        </button>
        {saved && <span style={{ fontSize: 13, color: GREEN }}>Fiyatlar güncellendi</span>}
      </div>

      <WinbackSettings />

      {/* Onay */}
      {confirmOpen && (
        <div onClick={() => !saving && setConfirmOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} className="ll-card" style={{ width: '100%', maxWidth: 640 }}>
            <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: TEXT }}>Fiyat değişikliğini onayla</p>
            <div style={{ overflowX: 'auto' }}>
              <table className="adm-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Paket', 'Ham', 'Web', 'Web indirimli', 'Mobil'].map((h) => (
                    <th key={h} style={{ ...cell, fontSize: 9, color: MUTED, textAlign: 'left', fontFamily: SANS }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {changes.map(({ c, net }) => {
                    const p = compute(net);
                    return (
                      <tr key={c.plan} style={{ borderTop: `1px solid ${BORDER}` }}>
                        <td data-label="Paket" style={{ ...cell, fontFamily: SANS }}>{c.name}</td>
                        <td data-label="Ham" style={cell}>{tl(c.netKurus)} → {tl(net)}</td>
                        <td data-label="Web" style={cell}>{tl(c.webKurus)} → <strong style={{ color: AMBER }}>{tl(p.web)}</strong></td>
                        <td data-label="Web indirimli" style={cell}>{tl(c.webDiscountKurus)} → {tl(p.webDiscount)}</td>
                        <td data-label="Mobil" style={cell}>{tl(c.mobileKurus)} → {tl(p.mobile)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
              Yeni fiyat sadece bundan sonraki satın almalarda geçerli olur; satın alınmış paketler etkilenmez.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={save} disabled={saving}
                style={{ flex: 1, padding: '9px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: SANS, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', color: GREEN, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                {saving ? 'Kaydediliyor…' : 'Onayla ve uygula'}
              </button>
              <button onClick={() => setConfirmOpen(false)} disabled={saving}
                style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontFamily: SANS, background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, cursor: 'pointer' }}>
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Geçmiş */}
      {(data?.history.length ?? 0) > 0 && (
        <div style={{ marginTop: 28 }}>
          <p style={{ margin: '0 0 8px', ...LABEL, color: MUTED }}>FİYAT GEÇMİŞİ</p>
          <div className="ll-card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="adm-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {data!.history.map((h, i) => (
                  <tr key={i} style={{ borderTop: i ? `1px solid ${BORDER}` : 'none' }}>
                    <td data-label="Tarih" style={{ ...cell, fontFamily: SANS, color: MUTED }}>{new Date(h.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td data-label="Paket" style={{ ...cell, fontFamily: SANS }}>{PLAN_NAME[h.plan]}</td>
                    <td data-label="Ham" style={cell}>ham {tl(h.netKurus)}</td>
                    <td data-label="Web" style={cell}>web {tl(h.webKurus)}</td>
                    <td data-label="Mobil" style={cell}>mobil {tl(h.mobileKurus)}</td>
                    <td data-label="Yapan" style={{ ...cell, fontFamily: SANS, color: MUTED }}>{h.createdBy?.profile ? `${h.createdBy.profile.firstName} ${h.createdBy.profile.lastName}` : 'Başlangıç'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
