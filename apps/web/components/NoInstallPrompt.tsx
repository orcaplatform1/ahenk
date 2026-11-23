'use client';

import { useEffect } from 'react';

// Tarayicinin "uygulamayi yukle" (PWA kurulum) onerisini engeller
export default function NoInstallPrompt() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    window.addEventListener('beforeinstallprompt', block);
    return () => window.removeEventListener('beforeinstallprompt', block);
  }, []);
  return null;
}
