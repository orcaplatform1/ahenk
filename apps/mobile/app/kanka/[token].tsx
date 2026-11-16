// apps/web/app/kanka/[token]/page.tsx karşılığı (Universal Link: https://ahenk.co/kanka/<token>)
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { API_PREFIX } from '@/lib/config';
import { langHeaders } from '@/lib/api';
import { getAccess } from '@/lib/session';
import { BtnGhost, BtnPrimary, Serif, Spinner, T, Glow, ScreenGlow } from '@/components/ui';
import { c, gender as G, tw, ll } from '@/theme/theme';
import { useTranslation } from 'react-i18next';

export default function KankaDavet() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [info, setInfo] = useState<{ valid: boolean; inviterInitials: string | null; inviterGender: string | null } | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    getAccess().then(a => setLoggedIn(!!a));
    fetch(`${API_PREFIX}/kanka/link/${encodeURIComponent(token)}`, { headers: langHeaders() }).then(r => r.json()).then(setInfo).catch(() => setInfo({ valid: false, inviterInitials: null, inviterGender: null }));
  }, [token]);
  const clr = info?.inviterGender === 'FEMALE' ? G.female : G.male;
  return (
    <View style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      <ScreenGlow />
      <Glow />
      <View style={{ alignItems: 'center', gap: 20, maxWidth: 420, width: '100%' }}>
        {!info ? <Spinner /> : info.valid ? (
          <>
            <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: clr, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' }}><T w={700} style={{ fontSize: 20 }}>{info.inviterInitials}</T></View>
            <Serif style={{ fontSize: 30 }}>{t('kankaInv.title')}</Serif>
            <T style={{ fontSize: 14, color: c.tAaa, lineHeight: 22.75, textAlign: 'center' }}>{t('kankaInv.invitedPre')}<T w={700} style={{ fontSize: 14 }}>{info.inviterInitials}</T> {t('kankaInv.invitedPost')} {t('kankaInv.onePays')}</T>
            <T style={{ fontSize: 12, color: c.t666, lineHeight: 19.5, textAlign: 'center' }}>{t('kankaInv.howAccept')} {t('kankaInv.kycNeeded')}{'\n'}{t('kankaInv.valid48')}</T>
            {loggedIn ? <BtnPrimary label="Profilim'e Git" full onPress={() => router.replace({ pathname: '/(tabs)/profilim', params: { tab: 'profil' } })} /> : (
              <View style={{ gap: 8, width: '100%' }}>
                <BtnPrimary label={t('kankaInv.register')} full onPress={() => router.replace('/kayit')} />
                <BtnGhost label={t('kankaInv.login')} full onPress={() => router.replace('/giris')} />
              </View>
            )}
          </>
        ) : (
          <>
            <Serif style={{ fontSize: 30 }}>{t('kankaInv.invalid')}</Serif>
            <T style={{ fontSize: 14, color: c.tAaa, lineHeight: 22.75, textAlign: 'center' }}>{t('kankaInv.invalidBody')}</T>
            <BtnGhost label="Ana Sayfa" full onPress={() => router.replace('/')} />
          </>
        )}
      </View>
    </View>
  );
}
