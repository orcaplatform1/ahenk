import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/mesafeli-satis-sozlesmesi',
  title: 'Mesafeli Satış Sözleşmesi',
  description: '6502 Sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği kapsamında Ahenk paket satışlarına ilişkin mesafeli satış sözleşmesi.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
