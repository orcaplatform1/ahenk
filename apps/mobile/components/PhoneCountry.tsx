// Ülke kodlu telefon alanı: bayrak + ülke kodu (varsayılan 🇹🇷 +90). Basınca bütün ülkelerin olduğu, ad ve kodla aranabilir liste
// (ülke adları arayüz dilinde). Doğrulama libphonenumber-js ile seçilen ülkeye göre (@ahenk/shared toE164); değer E.164.
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { countryByCode, countryName, flagEmoji, searchCountries } from '@ahenk/shared';
import { currentLang } from '@/lib/i18n';
import { T } from './ui';
import { ll } from '@/theme/theme';

export function CountryCodeButton({ country, onChange, disabled }: { country: string; onChange: (code: string) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const lang = currentLang();
  const c = countryByCode(country);
  const list = searchCountries(q, lang);
  return (
    <>
      <Pressable disabled={disabled} onPress={() => { setQ(''); setOpen(true); }} accessibilityRole="button" accessibilityLabel={t('common.selectCountry')}
        style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, opacity: disabled ? 0.6 : 1 }}>
        <T style={{ fontSize: 16 }}>{flagEmoji(c.code)}</T>
        <T style={{ color: ll.text, fontSize: 14 }}>{c.dial}</T>
        <T style={{ color: '#ff6b6b', fontSize: 10 }}>▾</T>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#121212', paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
            <TextInput value={q} onChangeText={setQ} placeholder={t('common.countrySearch')} placeholderTextColor="#777" autoFocus autoCorrect={false}
              style={{ flex: 1, minHeight: 44, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 12, color: '#f5f5f5', fontSize: 16 }} />
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <T style={{ color: '#a39c93', fontSize: 22 }}>×</T>
            </Pressable>
          </View>
          <FlatList data={list} keyExtractor={(it) => it.code} keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<T style={{ padding: 12, color: '#888', fontSize: 14 }}>{t('common.noResults')}</T>}
            renderItem={({ item }) => (
              <Pressable onPress={() => { onChange(item.code); setOpen(false); }} accessibilityRole="button" accessibilityState={{ selected: item.code === country }}
                style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, backgroundColor: item.code === country ? 'rgba(192,57,43,0.18)' : 'transparent' }}>
                <T style={{ fontSize: 16 }}>{flagEmoji(item.code)}</T>
                <T style={{ flex: 1, color: '#f5f5f5', fontSize: 14 }} numberOfLines={1}>{countryName(item, lang)}</T>
                <T style={{ color: '#a39c93', fontSize: 14 }}>{item.dial}</T>
              </Pressable>
            )} />
        </View>
      </Modal>
    </>
  );
}
