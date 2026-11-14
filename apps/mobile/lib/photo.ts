// Profil fotoğrafı boyutları: sunucu her fotoğrafı iki boyutta saklar — büyük (uzun kenar 1080 px, tam ekran görünüm ve Profilim'deki
// büyük daire) p-….webp, küçük (uzun kenar 200 px; alt menü, liste, küçük daireler) aynı adın .s.webp uzantılısı.
import { BASE } from './config';

const abs = (u: string) => (u.startsWith('/') ? `${BASE}${u}` : u);
export const largePhotoUrl = (u: string) => abs(u);
export const smallPhotoUrl = (u: string) => abs(u.replace(/\.webp$/, '.s.webp'));
