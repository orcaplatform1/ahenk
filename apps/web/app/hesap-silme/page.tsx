'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';

// Herkese açık hesap silme sayfası (Google Play hesap silme bağlantısı). Bilgi herkese görünür; talep için giriş gerekir:
// giriş yapmamış kişi mevcut giriş akışına gider, giriş sonrası buraya döner (giris?donus=/hesap-silme) ve
// Profilim'deki mevcut talep akışını (POST /users/me/deletion-request) başlatır.
// Metin backend/src/users/account-deletion.service.ts approve() kurallarına göre yazılmıştır.

const DELETED = [
  'Profil bilgilerin (ad, soyad, doğum tarihi, cinsiyet, şehir ve diğer profil alanları)',
  'Kişilik testi (OCEAN) cevapların ve sonuçların',
  'Kimlik doğrulama (KYC) kaydın; kimlik ön ve arka yüz görselleri ile canlılık videosu sunucudan silinir',
  'Rehber engelleme için eklediğin telefon numaraları ve kullanıcı engellemelerin',
  'Gönderdiğin sohbet mesajları',
  'Bildirimlerin, oturumların ve bekleme listesi kayıtların',
  'İndirim teklifleri; davet kaydındaki telefon numaran',
  'Hesabındaki e-posta adresi, telefon numarası, şifre, meslek sektörü ve bildirim cihaz bilgisi hesaptan kaldırılır, hesap anonimleştirilir',
];

const ANONYMIZED = [
  'Masa geçmişi ve yaptığın değerlendirmeler kimliğinle bağı koparılarak kimliksiz bir kayda taşınır; diğer katılımcıların masa geçmişi bozulmaz.',
  'Aktif paketlerin iptal edilir; kullanılmamış hakların iade edilmez ve kullanılamaz hâle gelir.',
  'Kankalık bağın sona erer; kankana bilgi verilir.',
];

const RETAINED: [string, string][] = [
  ['Ödeme ve abonelik (satın alma) kayıtları', '10 yıl, Vergi Usul Kanunu'],
  ['Acil yardım talebi, şikâyet ya da yaptırım (uyarı, askı, ban) kaydına karışmış kişinin ad, soyad, e-posta ve telefonu', 'Hesap silindikten sonra 2 yıl; yasal yükümlülükler, olası hukuki uyuşmazlıklar ve resmi makam talepleri için. Yalnız yetkili yönetici görür'],
  ['Kalıcı olarak banlanmış hesabın telefon numarasının tek yönlü özeti (hash)', 'Banlı kişinin yeniden kayıt olmasını engellemek için saklanır'],
];

export default function HesapSilmePage() {
  const [session, setSession] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const has = api.hasSession();
    setSession(has);
    if (!has) return;
    api.silentGet<{ request: { id: string } | null }>('/users/me/deletion-request')
      .then((r) => { if (r === null) setSession(false); else setPending(!!r?.request?.id); })
      .catch(() => {});
  }, []);

  async function confirmDelete() {
    setBusy(true); setError('');
    try {
      await api.post('/users/me/deletion-request', {});
      setPending(true);
      setOpen(false);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const card = (title: string, body: React.ReactNode, i: number) => (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.06 * i }} className="ll-card">
      <h2 className="ll-title" style={{ marginBottom: '1rem' }}>{title}</h2>
      <div style={{ color: '#c9c2b8', fontSize: 13, lineHeight: 1.75 }}>{body}</div>
    </motion.div>
  );
  const list = (items: string[]) => (
    <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {items.map((t) => <li key={t}>{t}</li>)}
    </ul>
  );

  return (
    <main className="live-layer" style={{ minHeight: '100vh' }}>
      <div className="ll-glow" aria-hidden="true" />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <h1 className="ll-title">Hesap Silme</h1>
          <p style={{ marginTop: '0.6rem', color: '#8f887f', fontSize: 13, letterSpacing: '0.03em' }}>
            Ahenk hesabını web sitesinden ya da mobil uygulamada Profilim → Hesabımı Sil adımından silebilirsin.
          </p>
        </motion.div>

        <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {card('Talep Oluştur', (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {session === null ? null : !session ? (
                <>
                  <p>Silme talebi oluşturmak için hesabına giriş yapman gerekir. Giriş yaptıktan sonra bu sayfaya geri dönersin.</p>
                  <a href="/giris?donus=/hesap-silme" className="mx-auto block btn-primary justify-center" style={{ width: '72%', textAlign: 'center' }}>Giriş Yap</a>
                </>
              ) : pending ? (
                <p style={{ textAlign: 'center', color: '#a39c93' }}>Hesap silme talebin alındı, en geç 48 saat içinde sonuçlanır.</p>
              ) : (
                <button type="button" onClick={() => { setError(''); setOpen(true); }} className="mx-auto block btn-ghost btn-ghost-red-dot" style={{ width: '72%' }}>
                  Hesabımı Sil
                </button>
              )}
            </div>
          ), 0)}

          {card('Talep Ne Kadar Sürede İşlenir?', (
            <>
              <p>Talebin en geç 48 saat içinde işleme alınır ve hesabın kalıcı olarak silinir. Bu işlem geri alınamaz.</p>
              <p style={{ marginTop: '0.6rem' }}>Bu hafta kurulmuş bir masan varsa buluşma bitene kadar silme talebi veremezsin.</p>
            </>
          ), 1)}

          {card('Silinen Veriler', list(DELETED), 2)}
          {card('Anonimleştirilen ve Sona Eren Kayıtlar', list(ANONYMIZED), 3)}

          {card('Yasal Zorunluluk Nedeniyle Saklanan Veriler', (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {RETAINED.map(([label, value], i) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', padding: '0.85rem 0', borderBottom: i < RETAINED.length - 1 ? '1px solid rgba(255,255,255,0.10)' : 'none' }}>
                  <span style={{ color: '#c9c2b8', fontSize: 13, flex: 1 }}>{label}</span>
                  <span style={{ color: '#a39c93', fontSize: 13, textAlign: 'right', flex: 1 }}>{value}</span>
                </div>
              ))}
            </div>
          ), 4)}

          {card('İletişim', (
            <p>Sorun yaşarsan <a href="mailto:bilgi@ahenk.co" style={{ color: '#c0392b' }}>bilgi@ahenk.co</a> adresine yazabilirsin.</p>
          ), 5)}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Hesabımı Sil">
        <p className="text-sm text-[#c9c2b8] leading-relaxed">
          Hesabını silmek üzeresin. Bu işlem geri alınamaz. Talebin onaylandıktan sonra hesabın en geç 48 saat içinde kalıcı olarak silinir. Profilin, kişilik testi sonuçların, kimlik doğrulama bilgilerin ve masa geçmişin sistemden kaldırılır. Kullanılmamış paket hakların iade edilmez ve kullanılamaz hâle gelir. Yasal zorunluluk gereği ödeme ve fatura kayıtların mevzuatta belirtilen süre boyunca saklanır.
        </p>
        {error && <p className="text-[#ff6b6b] text-sm mt-3">{error}</p>}
        <div className="mt-5 flex flex-col gap-3">
          <button type="button" onClick={confirmDelete} disabled={busy} className="mx-auto block btn-primary btn-tone-danger disabled:opacity-40" style={{ width: '72%' }}>
            {busy ? 'Gönderiliyor…' : 'Hesabı Sil'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="mx-auto block btn-primary btn-tone-safe" style={{ width: '72%' }}>
            Vazgeç
          </button>
        </div>
      </Modal>
    </main>
  );
}
