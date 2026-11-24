// apps/web/app/[locale]/davet/[kod]/page.tsx karşılığı (Universal Link / App Link: https://ahenk.co/davet/<KOD>, ayrıca ahenk://davet/<KOD>).
// Kod GET /invite/:code ile denetlenir: geçerliyse kayıt ekranı davet kodu dolu, geçersizse (rakam değil ya da böyle bir kod yok) kodsuz açılır.
// HIG: bekleme sırasında yalnız yükleniyor göstergesi; ekran kendiliğinden kayda geçer.
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { API_PREFIX } from '@/lib/config';
import { langHeaders } from '@/lib/api';
import { Spinner } from '@/components/ui';
import { ll } from '@/theme/theme';

export default function DavetLink() {
  const router = useRouter();
  const { kod } = useLocalSearchParams<{ kod: string }>();
  useEffect(() => {
    let done = false;
    const go = (valid: boolean) => {
      if (done) return;
      done = true;
      router.replace(valid ? { pathname: '/kayit', params: { ref: kod } } : '/kayit');
    };
    if (typeof kod !== 'string' || !/^\d{1,9}$/.test(kod)) { go(false); return; }
    fetch(`${API_PREFIX}/invite/${kod}`, { headers: langHeaders() })
      .then((r) => (r.ok ? r.json() : { valid: false }))
      .then((j: { valid?: boolean }) => go(!!j.valid))
      .catch(() => go(false));
  }, [kod, router]);
  return (
    <View style={{ flex: 1, backgroundColor: ll.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </View>
  );
}
