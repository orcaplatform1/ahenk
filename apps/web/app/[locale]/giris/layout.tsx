import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/giris',
    title: 'Giriş Yap',
    description: 'Ahenk hesabına WhatsApp kodu veya e-posta ile güvenli şekilde giriş yap, masalarını görüntüle ve sana uygun insanlarla buluşmaya devam et.',
    locale,
    en: { title: 'Log In', description: 'Log in to your Ahenk account securely with a WhatsApp code or email, see your tables and keep meeting people who suit you.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
