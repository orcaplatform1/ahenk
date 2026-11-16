import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata({
    path: '/mesafeli-satis-sozlesmesi',
    title: 'Mesafeli Satış Sözleşmesi',
    description: '6502 Sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği kapsamında Ahenk paket satışlarına ilişkin mesafeli satış sözleşmesi.',
    locale,
    en: { title: 'Distance Sales Agreement', description: 'The distance sales agreement for Ahenk package sales under Turkish Consumer Protection Law No. 6502 and the Distance Contracts Regulation.' },
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
