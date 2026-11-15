import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/hesap-silme',
  title: 'Hesap Silme',
  description: 'Ahenk hesabını silme talebi oluşturma, silinen ve yasal zorunluluk nedeniyle saklanan veriler ve talebin işlenme süresi hakkında bilgi.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
