'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export default function NavbarWrapper() {
  const path = usePathname();
  if (path.startsWith('/admin')) return null;
  return <Navbar />;
}
