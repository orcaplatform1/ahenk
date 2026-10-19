import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gizlilik Politikası — Ahenk',
  description: 'Ahenk platformunda kişisel verilerinizin nasıl toplandığı, işlendiği ve korunduğu hakkında bilgi.',
  alternates: { canonical: 'https://ahenk.tr/gizlilik-politikasi' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
