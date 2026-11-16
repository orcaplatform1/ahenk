import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Kullanıcı sayfalarında bağlantı / yönlendirme bunlardan yapılır: seçili dil (/en öneki) korunur
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
