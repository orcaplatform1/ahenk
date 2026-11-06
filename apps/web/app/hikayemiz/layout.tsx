import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/hikayemiz',
  title: 'Hikayemiz',
  description: 'Ahenk, ekran arkasındaki bağların yerini tutmayan yüz yüze buluşmalar için kuruldu. OCEAN kişilik modeline dayalı eşleştirme ve güvenlik yaklaşımımızı keşfedin.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
