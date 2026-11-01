import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/is-ortakligi',
  title: 'Mekan Ortaklığı',
  description: 'Ahenk mekan ortaklığı ile kimliği doğrulanmış kullanıcıları mekânınızda ağırlayın. Önceden planlanmış rezervasyonlarla çalışmak için başvuru formunu doldurun.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
