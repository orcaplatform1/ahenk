'use client';

import Link from 'next/link';

// KYC onaylanmamış kullanıcıda kullanıcı paneli sayfalarının en üstünde; basınca KYC ekranı açılır, onaylanınca kaybolur
export default function KycNoticeCard({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Link
      href="/profil?tab=kyc"
      className="ll-card flex items-center justify-between gap-3 mb-4"
      style={{ textDecoration: 'none', border: '1px solid rgba(214,69,58,0.45)', background: 'rgba(214,69,58,0.08)', minHeight: 44 }}
    >
      <span className="text-sm text-[#f4f1ec]" style={{ lineHeight: 1.5 }}>
        Kullanıcı güvenliği sebebiyle masaya katılım için lütfen kimliğinizi doğrulayın.
      </span>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ff8a7e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}
