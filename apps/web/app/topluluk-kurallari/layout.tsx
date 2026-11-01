import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  path: '/topluluk-kurallari',
  title: 'Topluluk Kuralları',
  description: 'Ahenk topluluğunda herkesin güvende ve rahat hissetmesi için belirlenen kurallar. Buluşmalarda ve platformda beklenen davranış ilkelerini okuyabilirsiniz.',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
