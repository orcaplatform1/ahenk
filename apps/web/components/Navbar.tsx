'use client';

import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-bg/80 border-b border-border">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-serif text-2xl tracking-tight text-text">
          Ahenk
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/giris"
            className="px-4 py-2 text-sm text-muted hover:text-text transition-colors rounded-lg border border-border hover:border-muted"
          >
            Giriş Yap
          </Link>
          <Link
            href="/kayit"
            className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover transition-colors rounded-lg font-medium"
          >
            Başla
          </Link>
        </div>
      </div>
    </nav>
  );
}
