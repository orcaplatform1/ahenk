'use client';

import { useEffect, useState } from 'react';
import { startCheckout } from '@/lib/checkout';
import TcknModal from '@/components/paket/TcknModal';
import { clockHMS, type WinbackState } from './useWinback';

interface Props {
  state: WinbackState;
  remaining: number;
  merged: boolean;
  onMerge: () => void;
  onClose: () => void;
}

// Geri kazanım indirimi: tam ekran teklif
export function WinbackScreen({ state, remaining, merged, onMerge, onClose }: Props) {
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tcOpen, setTcOpen] = useState(false);
  const plans = state.plans ?? [];

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  async function apply() {
    if (!selected || busy) return;
    if (!state.kycApproved) { window.location.href = '/profil?tab=kyc'; return; }
    const plan = plans.find((p) => p.plan === selected);
    if (!plan) return;
    // Kankamla kanka seçmeden alınamaz
    if (plan.needsKanka) { window.location.href = '/profil?tab=profil'; return; }
    // Web ödemesinde T.C. No istenir (yalnız iyzico'ya gider)
    setError('');
    setTcOpen(true);
  }

  async function pay(identityNumber: string) {
    const plan = plans.find((p) => p.plan === selected);
    if (!plan) return;
    setBusy(true); setError('');
    try {
      await startCheckout(plan.plan, plan.name, identityNumber);
      setTcOpen(false);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wb-screen" role="dialog" aria-modal="true">
      <style>{`
        .wb-screen{position:fixed;inset:0;z-index:1000;background:#0a0a0a;color:#f5f5f5;overflow-y:auto;font-family:var(--font-sans),Inter,system-ui,sans-serif;}
        .wb-screen::before{content:'';position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse 70% 45% at 50% 30%,rgba(214,69,58,.16),transparent 70%);}
        .wb-in{position:relative;max-width:440px;min-height:100%;margin:0 auto;padding:22px 20px 32px;display:flex;flex-direction:column;align-items:center;}
        .wb-top{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:22px;}
        .wb-pill{font-size:11px;font-weight:700;letter-spacing:.14em;padding:7px 16px;border-radius:999px;color:#ff8a7e;background:rgba(214,69,58,.12);border:1px solid rgba(214,69,58,.45);}
        .wb-x{width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#a39c93;font-size:14px;line-height:1;cursor:pointer;}
        .wb-title{font-family:var(--font-serif),'DM Serif Display',serif;font-size:34px;line-height:1.15;text-align:center;margin:0 0 16px;}
        .wb-strip{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:11px 16px;border-radius:12px;border:1px solid rgba(214,69,58,.75);background:rgba(214,69,58,.08);}
        .wb-strip span:first-child{font-size:11px;font-weight:700;letter-spacing:.12em;color:#ff8a7e;}
        .wb-clock{font-variant-numeric:tabular-nums;font-size:19px;font-weight:700;letter-spacing:.04em;}
        .wb-sub{margin:18px 0 6px;font-size:14px;color:#c9c2b8;text-align:center;}
        .wb-rings{position:relative;width:250px;height:190px;margin:4px 0 8px;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent;}
        .wb-rings[disabled]{cursor:default;}
        .wb-ring{position:absolute;top:50%;left:50%;width:148px;height:148px;margin:-74px 0 0 -74px;border-radius:50%;border:10px solid #d6453a;box-shadow:0 0 26px rgba(214,69,58,.35);transition:transform .9s cubic-bezier(.65,0,.25,1),border-color .9s ease,box-shadow .9s ease;}
        .wb-ring.a{transform:translateX(-46px);}
        .wb-ring.b{transform:translateX(46px);}
        .wb-rings.m .wb-ring{transform:none;border-color:#c8743c;box-shadow:0 0 34px rgba(200,116,60,.5);}
        .wb-amt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity .4s ease .7s;}
        .wb-rings.m .wb-amt{opacity:1;}
        .wb-amt b{font-family:var(--font-serif),'DM Serif Display',serif;font-weight:400;font-size:36px;line-height:1;color:#f5f5f5;}
        .wb-amt i{font-style:normal;font-size:11px;font-weight:700;letter-spacing:.16em;color:#e8a27a;margin-top:5px;}
        .wb-pick{width:100%;animation:wbUp .5s ease both;}
        @keyframes wbUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        .wb-pick h3{font-size:12px;font-weight:700;letter-spacing:.14em;color:#a39c93;margin:12px 0 10px;text-align:center;}
        .wb-card{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:14px 16px;margin-bottom:10px;border-radius:14px;text-align:left;color:#f5f5f5;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);cursor:pointer;transition:border-color .2s,background .2s;}
        .wb-card.on{background:rgba(200,116,60,.12);border-color:#c8743c;}
        .wb-card .n{font-family:var(--font-serif),'DM Serif Display',serif;font-size:18px;}
        .wb-card .old{font-size:12px;color:#8f887f;text-decoration:line-through;margin-right:8px;}
        .wb-card .new{font-size:20px;font-weight:700;}
        .wb-note{font-size:11px;color:#8f887f;text-align:center;margin:2px 0 14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .wb-cta{position:relative;overflow:hidden;width:100%;padding:16px;border:0;border-radius:999px;color:#fff;font-size:16px;font-weight:700;letter-spacing:.02em;cursor:pointer;background:linear-gradient(100deg,#c0392b 0%,#d6453a 40%,#c8743c 100%);box-shadow:0 10px 30px rgba(200,84,50,.4);transition:filter .2s,opacity .2s;}
        .wb-cta:hover:not(:disabled){filter:brightness(1.1);}
        .wb-cta:disabled{opacity:.55;cursor:not-allowed;}
        .wb-cta::after{content:'';position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.4),transparent);transform:skewX(-20deg);animation:wbShine 2.8s ease-in-out infinite;}
        @keyframes wbShine{0%{left:-60%}60%,100%{left:130%}}
        .wb-hint{font-size:12px;color:#a39c93;text-align:center;margin:10px 0 0;}
        .wb-err{font-size:13px;color:#ff6b6b;text-align:center;margin:10px 0 0;}
        @media (prefers-reduced-motion:reduce){.wb-ring,.wb-amt{transition:none}.wb-cta::after,.wb-pick{animation:none}}
      `}</style>
      <div className="wb-in">
        <div className="wb-top">
          <span className="wb-pill">SANA ÖZEL İNDİRİM</span>
          <button type="button" className="wb-x" aria-label="Kapat" onClick={onClose}>×</button>
        </div>
        <h1 className="wb-title">{state.lapsed ? 'Birkaç masa daha?' : 'Uyumlu bir masa?'}</h1>
        <div className="wb-strip">
          <span>TEKLİFİN BİTMESİNE</span>
          <span className="wb-clock">{clockHMS(remaining)}</span>
        </div>
        <p className="wb-sub">{merged ? 'İndirimin tanımlandı, şimdi eşleşme zamanı.' : 'Halkalara dokun, indirimini ortaya çıkar.'}</p>

        <button type="button" className={`wb-rings${merged ? ' m' : ''}`} disabled={merged} onClick={onMerge} aria-label="Halkalar">
          <span className="wb-ring a" />
          <span className="wb-ring b" />
          <span className="wb-amt"><b>{state.amountTL}₺</b><i>İNDİRİM</i></span>
        </button>

        {merged && (
          <div className="wb-pick">
            <h3>PAKETİNİ SEÇ</h3>
            {plans.map((p) => (
              <button key={p.plan} type="button" className={`wb-card${selected === p.plan ? ' on' : ''}`} onClick={() => setSelected(p.plan)}>
                <span className="n">{p.name}</span>
                <span><span className="old">{p.listTL}₺</span><span className="new">{p.discountedTL}₺</span></span>
              </button>
            ))}
            <p className="wb-note">Referans indirimi bu indirimle birleşmez.</p>
            <button type="button" className="wb-cta" disabled={!selected || busy} onClick={apply}>İndirimi Uygula</button>
            {!selected && <p className="wb-hint">Önce paketini seç</p>}
            {error && <p className="wb-err">{error}</p>}
          </div>
        )}
      </div>
      <TcknModal open={tcOpen} busy={busy} error={error} onCancel={() => setTcOpen(false)} onSubmit={pay} />
    </div>
  );
}
