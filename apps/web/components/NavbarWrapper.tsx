'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export default function NavbarWrapper() {
  const path = usePathname();
  // Mekân paneli İngilizcede /en/mekan/panel
  const bare = path.replace(/^\/en(?=\/|$)/, '') || '/';
  if (bare.startsWith('/admin') || bare.startsWith('/mekan/panel')) return null;
  return <Navbar />;
}
