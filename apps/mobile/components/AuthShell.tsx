// Giriş / şifre sayfalarının ortak çerçevesi: .live-layer.ll-form, logo 48 + AHENK, .ll-title (app/giris, app/sifremi-*)
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Btn, Glow, Input, T, Title } from './ui';
import { ll, sans } from '@/theme/theme';
import { useKeyboardFieldScroll } from '@/lib/useKeyboardFieldScroll';

// brandLogo: giriş ve üye şifremi unuttum ekranı — açılış ekranındaki AHENK yazılı logo (start_logo.jpg), büyük, altında AHENK yazısı yok
export function AuthShell({ title, subtitle, brandLogo, children }: { title?: string; subtitle?: string; brandLogo?: boolean; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardFieldScroll();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: ll.bg, overflow: 'hidden' }} behavior="padding">
      {/* Arka plan: M. şifremi unuttum ekranındaki sağ üst kırmızımsı ışıma (Glow) */}
      <Glow />
      <ScrollView {...kb} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
        <View style={{ width: '100%', maxWidth: 384, alignSelf: 'center' }}>
          <View style={{ marginBottom: 32, alignItems: 'center' }}>
            {brandLogo ? (
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <Image source={require('@/assets/start_logo.jpg')} style={{ width: 120, height: 120, borderRadius: 60 }} accessibilityLabel="Ahenk" />
              </View>
            ) : (
              <View style={{ alignItems: 'center', gap: 8, marginBottom: 24 }}>
                <Image source={require('@/assets/logo.png')} style={{ width: 48, height: 48, borderRadius: 24 }} accessibilityLabel="Ahenk" />
                <T w={600} style={{ fontSize: 15, letterSpacing: 1.8, fontFamily: sans(600) }}>AHENK</T>
              </View>
            )}
            {!!title && <Title style={{ textAlign: 'center', marginBottom: subtitle ? 8 : 0 }}>{title}</Title>}
            {!!subtitle && <T style={{ color: ll.label, fontSize: 13, textAlign: 'center' }}>{subtitle}</T>}
          </View>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function PasswordInput({ value, onChangeText, placeholder, onSubmitEditing, form = true }: { value: string; onChangeText: (t: string) => void; placeholder: string; onSubmitEditing?: () => void; form?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <View>
      <Input form={form} value={value} onChangeText={(t) => onChangeText(t.slice(0, 20))} placeholder={placeholder} secureTextEntry={!show} textContentType="password" autoCapitalize="none" onSubmitEditing={onSubmitEditing} style={{ paddingRight: 48, paddingVertical: 14 }} />
      <Pressable onPress={() => setShow(s => !s)} accessibilityLabel={show ? 'Şifreyi gizle' : 'Şifreyi göster'} hitSlop={13} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={ll.label} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          {show ? <Path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            : <><Path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><Circle cx={12} cy={12} r={3} /></>}
        </Svg>
      </Pressable>
    </View>
  );
}

export function PhoneRow({ value, onChange, onSubmit, autoFocus }: { value: string; onChange: (v: string) => void; onSubmit?: () => void; autoFocus?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ justifyContent: 'center', paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12 }}>
        <T style={{ color: ll.label, fontSize: 13 }}>+90</T>
      </View>
      <Input form style={{ flex: 1, paddingVertical: 14 }} keyboardType="number-pad" textContentType="telephoneNumber" autoComplete="tel" value={value} autoFocus={autoFocus}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 10))} placeholder="5XX XXX XX XX" onSubmitEditing={onSubmit} returnKeyType="send" />
    </View>
  );
}

// Giriş sayfasındaki WhatsApp / E-posta anahtarı (aynı stil Üye / İşletme seçiminde de kullanılır)
export function Toggle<K extends string>({ items, value, onChange }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={{ flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
      {items.map(it => {
        const on = it.key === value;
        return (
          <Btn key={it.key} variant="segment" selected={on} label={it.label} onPress={() => onChange(it.key)} />
        );
      })}
    </View>
  );
}
