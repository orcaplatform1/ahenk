'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { GA_ID, gaConfigScript, gaConsentScript, isExcludedPath, trackPageView } from '@/lib/analytics';

export default function Analytics({ nonce }: { nonce?: string }) {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  if (!GA_ID || isExcludedPath(pathname)) return null;

  return (
    <>
      <Script id="ga-consent" strategy="afterInteractive" nonce={nonce}>{gaConsentScript()}</Script>
      <Script
        id="ga-loader"
        strategy="afterInteractive"
        nonce={nonce}
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`}
      />
      <Script id="ga-config" strategy="afterInteractive" nonce={nonce}>{gaConfigScript()}</Script>
    </>
  );
}
