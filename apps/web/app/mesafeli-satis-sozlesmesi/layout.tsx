import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mesafeli Satış Sözleşmesi — Ahenk',
  description: '6502 Sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği kapsamında mesafeli satış sözleşmesi.',
  alternates: { canonical: 'https://ahenk.co/mesafeli-satis-sozlesmesi' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
