import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/gizlilik-politikasi',
  title: 'Gizlilik Politikası',
  description: 'Ahenk platformunda kişisel verilerinizin nasıl toplandığını, işlendiğini ve korunduğunu açıklayan gizlilik politikamızı inceleyerek bilgi edinebilirsiniz.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
