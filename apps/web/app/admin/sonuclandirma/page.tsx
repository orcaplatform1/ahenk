'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { BG, BORDER, TEXT, MUTED, RED, GREEN, AMBER, SANS, MONO } from '@/lib/adminTheme';

interface RefundRow {
  id: string; userName: string; phone: string | null; refundType: string; plan: string; status: string;
  createdAt: string; iyzicoPaymentId: string | null; amountKurus: number;
}
interface PaymentRow {
  id: string; userName: string; phone: string | null; plan: string; status: string;
  amountKurus: number; iyzicoPaymentId: string | null; failureReason: string | null; createdAt: string;
}
interface Settlements { refunds: RefundRow[]; payments: PaymentRow[] }

const tl = (k: number) => `₺${(k / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (d: string) => new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' });

const btn = (color: string, border: string, bg: string): React.CSSProperties => ({
  padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: SANS, background: bg, border: `1px solid ${border}`, color, cursor: 'pointer',
});
const OK_BTN = btn(GREEN, 'rgba(34,197,94,0.3)', 'rgba(34,197,94,0.1)');
const NO_BTN = btn(RED, 'rgba(239,68,68,0.3)', 'rgba(239,68,68,0.1)');

function Row({ title, lines, actions }: { title: string; lines: string[]; actions: { label: string; style: React.CSSProperties; run: (note?: string) => Promise<void> }[] }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(fn: (note?: string) => Promise<void>) {
    setBusy(true); setError('');
    try { await fn(note || undefined); } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <div style={{ padding: '14px 18px', borderTop: `1px solid ${BORDER}` }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT }}>{title}</p>
      {lines.map((l) => <p key={l} style={{ margin: '3px 0 0', fontSize: 11, color: MUTED, fontFamily: MONO, overflowWrap: 'anywhere' }}>{l}</p>)}
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Not (opsiyonel)" style={{ width: '100%', marginTop: 10, background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: TEXT, outline: 'none', fontFamily: SANS, boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {actions.map((a) => <button key={a.label} disabled={busy} onClick={() => run(a.run)} style={{ ...a.style, opacity: busy ? 0.5 : 1 }}>{a.label}</button>)}
      </div>
      {error && <p style={{ margin: '8px 0 0', fontSize: 12, color: RED }}>{error}</p>}
    </div>
  );
}

// iyzico sonucu belirsiz kalan kayıtlar: SUPERADMIN iyzico panelinden kontrol edip sonucu işler. Buradan para gönderilmez.
export default function AdminSonuclandirma() {
  const [data, setData] = useState<Settlements | null>(null);
  const [error, setError] = useState('');

  function load() {
    api.get<Settlements>('/admin/settlements').then((d) => { setData(d); setError(''); }).catch((e: Error) => setError(e.message));
  }
  useEffect(load, []);

  const settleRefund = (id: string, status: string) => async (note?: string) => {
    await api.patch(`/admin/settlements/refunds/${id}`, { status, note });
    load();
  };
  const settlePayment = (id: string, status: string) => async (note?: string) => {
    await api.patch(`/admin/settlements/payments/${id}`, { status, note });
    load();
  };

  return (
    <div className="adm-page" style={{ maxWidth: 760, margin: '0 auto', fontFamily: SANS }}>
      <h1 className="ll-title" style={{ margin: '0 0 8px' }}>İade ve Ödeme Sonuçlandırma</h1>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: AMBER, lineHeight: 1.5 }}>
        Bu ekrandan iyzico&apos;ya istek gitmez, para gönderilmez. Önce iyzico panelinden sonucu kontrol edin, sonra işleyin.
      </p>
      {error && <p style={{ margin: '0 0 16px', fontSize: 13, color: RED }}>{error}</p>}

      <div className="ll-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '12px 18px' }}><h2 className="ll-title">İşleniyor Durumundaki İadeler</h2></div>
        {data?.refunds.length === 0 && <p style={{ margin: 0, padding: '0 18px 16px', fontSize: 13, color: MUTED }}>Kayıt yok.</p>}
        {data?.refunds.map((r) => (
          <Row
            key={r.id}
            title={r.userName}
            lines={[`${r.plan} · ${r.refundType} · ${tl(r.amountKurus)}`, `${when(r.createdAt)}${r.phone ? ` · ${r.phone}` : ''}`, `iyzico: ${r.iyzicoPaymentId ?? '—'}`]}
            actions={[
              { label: 'Para İade Edildi (Onayla)', style: OK_BTN, run: settleRefund(r.id, 'APPROVED') },
              { label: 'Para Çıkmadı (Reddet)', style: NO_BTN, run: settleRefund(r.id, 'REJECTED') },
            ]}
          />
        ))}
      </div>

      <div className="ll-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px' }}><h2 className="ll-title">İade Bekleyen Fazla Ödemeler</h2></div>
        {data?.payments.length === 0 && <p style={{ margin: 0, padding: '0 18px 16px', fontSize: 13, color: MUTED }}>Kayıt yok.</p>}
        {data?.payments.map((p) => (
          <Row
            key={p.id}
            title={p.userName}
            lines={[`${p.plan} · ${tl(p.amountKurus)}`, `${when(p.createdAt)}${p.phone ? ` · ${p.phone}` : ''}`, `iyzico: ${p.iyzicoPaymentId ?? '—'}`, p.failureReason ?? '']}
            actions={[
              { label: 'İade Edildi', style: OK_BTN, run: settlePayment(p.id, 'REFUNDED') },
              { label: 'Başarısız (Para Çekilmedi)', style: NO_BTN, run: settlePayment(p.id, 'FAILED') },
            ]}
          />
        ))}
      </div>
    </div>
  );
}
