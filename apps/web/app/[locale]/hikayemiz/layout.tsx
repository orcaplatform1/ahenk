import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/hikayemiz',
    title: 'Hikayemiz',
    description: 'Ahenk, ekran arkasındaki bağların yerini tutmayan yüz yüze buluşmalar için kuruldu. OCEAN kişilik modeline dayalı eşleştirme ve güvenlik yaklaşımımı keşfet.',
    locale,
    en: { title: 'Our Story', description: 'Ahenk was founded for face-to-face meetups that screens can’t replace. Discover our OCEAN personality–based matching and our approach to safety.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
