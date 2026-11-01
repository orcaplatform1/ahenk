'use client';

import { usePathname } from 'next/navigation';

// Navbar'lı sayfalarda başlıklar navbarın bir satır altından başlar; landing tam ekran hero ile açılır
export default function PageOffset({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const off = path === '/' || path.startsWith('/admin') || path.startsWith('/mekan/panel');
  return <div className={off ? undefined : 'page-top-gap'}>{children}</div>;
}
