'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-bg/80 border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Ahenk" width={36} height={36} className="rounded-full" />
          <span className="font-sans font-semibold text-lg tracking-[0.12em] text-text">AHENK</span>
        </Link>

        {/* Orta linkler */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: 'Nasıl Çalışır?', href: '#how-it-works' },
            { label: 'Buluşmalar', href: '#cities' },
            { label: 'Test', href: '/kayit' },
            { label: 'Hakkımızda', href: '#faq' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm text-muted hover:text-text transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Sağ butonlar */}
        <div className="flex items-center gap-3">
          <Link
            href="/giris"
            className="hidden sm:block px-4 py-2 text-sm text-muted hover:text-text transition-colors"
          >
            Giriş Yap
          </Link>
          <Link
            href="/kayit"
            className="px-5 py-2 text-sm bg-primary hover:bg-primary-hover transition-colors rounded-full font-medium text-white"
          >
            Kayıt Ol
          </Link>
        </div>
      </div>
    </nav>
  );
}
