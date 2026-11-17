import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/kayit',
    title: 'Kayıt Ol',
    description: 'Ahenk hesabını oluştur, OCEAN kişilik testini tamamla ve kişilik profiline uygun insanlarla yüz yüze buluşmalara katılmak için ilk adımı at.',
    locale,
    en: { title: 'Sign Up', description: 'Create your Ahenk account, take the OCEAN personality test and take the first step toward meeting people who match your personality face to face.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
