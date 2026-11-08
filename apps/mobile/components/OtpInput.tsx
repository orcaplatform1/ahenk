// apps/web/components/ui/OtpInput.tsx karşılığı: 6 haneli kod, tek seferlik kod otomatik doldurma (HIG klavye)
import React, { useRef } from 'react';
import { Pressable, TextInput, View, type TextInputInstance } from 'react-native';
import { T } from './ui';
import { inputGlass, sans, tw } from '@/theme/theme';

export function OtpInput({ value, onChange, onComplete, error }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; error?: boolean }) {
  const ref = useRef<TextInputInstance>(null);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel="Doğrulama kodu">
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        {digits.map((d, i) => (
          <View key={i} style={{ width: 48, height: 60, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
            backgroundColor: d.trim() ? 'rgba(192,57,43,0.08)' : 'rgba(255,255,255,0.025)', borderColor: error ? tw.accent : i === value.length ? inputGlass.focusBorder : inputGlass.formBorder }}>
            <T w={600} style={{ fontSize: 24, fontVariant: ['tabular-nums'] }}>{d.trim()}</T>
            {/* web odak halkası: box-shadow 0 0 0 3px rgba(192,57,43,.22) */}
            {i === value.length && !error && <View pointerEvents="none" style={{ position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 17, borderWidth: 3, borderColor: 'rgba(192,57,43,0.22)' }} />}
          </View>
        ))}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => { const v = t.replace(/\D/g, '').slice(0, 6); onChange(v); if (v.length === 6) onComplete?.(v); }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        maxLength={6}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1, fontFamily: sans(400) }}
      />
    </Pressable>
  );
}
