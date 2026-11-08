// Web globals.css sınıflarının RN karşılıkları: .ll-card, .ll-title, .ll-eyebrow, .btn-primary, .btn-ghost,
// .input-glass, .ll-cta, Sheet (KankaSection/TabProfilim), Modal (components/ui/Modal.tsx), Skeleton, MaintenanceNotice.
import React, { forwardRef, useState } from 'react';
import {
  useWindowDimensions,
  ActivityIndicator, Modal as RNModal, Pressable, StyleSheet, Text, TextInput, View,
  type PressableProps, type TextInputInstance, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Ellipse, RadialGradient as SvgRadial, Rect as SvgRect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  btn, toggleSwitch, type BtnVariant,
  btnGhost, btnPrimary, c, fonts, glassCard, inputGlass, ll, llCard, llCta, llEyebrow, llHead, llNote, llTitle, mono, sans, sheet, tw, webLineHeight, liveGlow,
} from '@/theme/theme';

// Web satır yüksekliği: stilde lineHeight yoksa üye tarafında Tailwind boyutları için sınıf değeri, diğer boyutlarda 1.5×;
// admin tarafında (yalnız satır içi stil) her boyutta 1.5×. Açıkça verilmiş lineHeight korunur.
// Web karşılığı yalnız satır içi stil kullanan bileşenler (Tailwind yazı sınıfı yok) InlineLH ile sarılır: orada her boyut 1.5×
const InlineLHContext = React.createContext(false);
export function InlineLH({ children }: { children: React.ReactNode }) { return <InlineLHContext.Provider value>{children}</InlineLHContext.Provider>; }
function useInlineLH() { return React.useContext(InlineLHContext); }

export function withWebLH(style: StyleProp<TextStyle>, admin = false): StyleProp<TextStyle> {
  const f = StyleSheet.flatten(style) as TextStyle | undefined;
  if (!f || f.lineHeight != null) return style;
  const size = f.fontSize ?? 14;
  const lh = (!admin && webLineHeight.tailwind[size]) || size * webLineHeight.base;
  return [style, { lineHeight: lh }];
}

// S-24: görünür boyut aynı, dokunma alanı 44×44 pt'ye tamamlanır
export const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

export function T({ style, w = 400, children, ...rest }: TextProps & { w?: 400 | 500 | 600 | 700 | 800 }) {
  const inline = useInlineLH();
  return <Text {...rest} style={withWebLH([{ fontFamily: sans(w), color: tw.text }, style], inline)}>{children}</Text>;
}
export function Serif({ style, children, ...rest }: TextProps) {
  const inline = useInlineLH();
  return <Text {...rest} style={withWebLH([{ fontFamily: fonts.serif, color: tw.text }, style], inline)}>{children}</Text>;
}
export function Mono({ style, w = 400, children, ...rest }: TextProps & { w?: 400 | 500 | 600 }) {
  const inline = useInlineLH();
  return <Text {...rest} style={withWebLH([{ fontFamily: mono(w), color: ll.text }, style], inline)}>{children}</Text>;
}

export function Card({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Head({ title, right, style }: { title: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.head, style]}>
      <Serif style={s.title}>{title}</Serif>
      {right}
    </View>
  );
}
export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Serif style={[s.title, style]}>{children}</Serif>;
}
export function Eyebrow({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Mono style={[s.eyebrow, style]}>{children}</Mono>;
}
export function Note({ children }: { children: React.ReactNode }) {
  return <Mono style={s.note}>{children}</Mono>;
}

type BtnProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string; style?: StyleProp<ViewStyle>; full?: boolean; redDot?: boolean; textStyle?: StyleProp<TextStyle>; noUpper?: boolean;
};

// .btn-primary
export function BtnPrimary({ label, style, full, disabled, textStyle, noUpper, ...rest }: BtnProps) {
  return (
    <Pressable hitSlop={HIT} disabled={disabled} accessibilityRole="button" {...rest}
      style={({ pressed }) => [s.btn, s.btnPrimary, full && s.full, pressed && !disabled && { backgroundColor: 'rgba(255,255,255,0.05)' }, disabled && { opacity: btnPrimary.disabledOpacity }, style]}>
      <View style={[s.dot, { backgroundColor: btnPrimary.dotColor }]} />
      <Text style={withWebLH([s.btnText, { fontFamily: sans(600), color: c.white }, textStyle])}>{noUpper ? label : label.toLocaleUpperCase('tr-TR')}</Text>
    </Pressable>
  );
}

// .btn-ghost (+ .btn-ghost-red-dot)
export function BtnGhost({ label, style, full, disabled, redDot, textStyle, noUpper, ...rest }: BtnProps) {
  return (
    <Pressable hitSlop={HIT} disabled={disabled} accessibilityRole="button" {...rest}
      style={({ pressed }) => [s.btn, s.btnGhost, full && s.full, pressed && !disabled && { backgroundColor: 'rgba(255,255,255,0.05)' }, disabled && { opacity: btnGhost.disabledOpacity }, style]}>
      <View style={[s.dot, { backgroundColor: redDot ? c.ghostRedDot : btnGhost.dotColor }]} />
      <Text style={withWebLH([s.btnText, { fontFamily: sans(500), color: btnGhost.color }, textStyle])}>{noUpper ? label : label.toLocaleUpperCase('tr-TR')}</Text>
    </Pressable>
  );
}

// Tema buton kaydındaki (theme.ts → btn) web buton stilleri. style yalnız yerleşim içindir (genişlik, kenar boşluğu, flex).
export function Btn({ variant, label, children, selected, disabled, onPress, style, textStyle, accessibilityLabel, hitSlop = HIT }: {
  variant: BtnVariant; label?: string; children?: React.ReactNode; selected?: boolean; disabled?: boolean; onPress?: () => void;
  style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>; accessibilityLabel?: string; hitSlop?: PressableProps['hitSlop'];
}) {
  const inline = useInlineLH();
  const spec = btn[variant] as import('@/theme/theme').BtnSpec;
  const { weight = 400, ...textBase } = spec.text;
  const onText = selected && spec.on ? spec.on.text as { weight?: 400 | 500 | 600 | 700 | 800 } : undefined;
  const w = onText?.weight ?? weight;
  const content = children ?? (
    <Text style={withWebLH([{ fontFamily: sans(w) }, textBase as TextStyle, selected && spec.on ? spec.on.text as TextStyle : null, textStyle], inline || String(variant).startsWith('adm'))}>
      {label !== undefined && spec.upper ? label.toLocaleUpperCase('tr-TR') : label}
    </Text>
  );
  const boxStyle = [spec.box as ViewStyle, selected && spec.on ? spec.on.box as ViewStyle : null, disabled && { opacity: spec.disabledOpacity ?? 0.4 }, style];
  if (spec.gradient) {
    const g = spec.gradient;
    const { shadowColor, shadowOpacity, shadowRadius, shadowOffset, ...inner } = spec.box as ViewStyle;
    const outer: ViewStyle = { borderRadius: inner.borderRadius, shadowColor, shadowOpacity, shadowRadius, shadowOffset, alignSelf: inner.alignSelf, flex: inner.flex };
    return (
      <Pressable onPress={onPress} disabled={disabled} hitSlop={hitSlop} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled, selected }}
        style={[outer, disabled && { opacity: spec.disabledOpacity ?? 0.4 }, style]}>
        <LinearGradient colors={g.colors as [string, string, ...string[]]} locations={g.locations as [number, number, ...number[]] | undefined} start={g.start} end={g.end} style={[inner, { overflow: 'hidden' }]}>
          {content}
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={hitSlop} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled, selected }} style={boxStyle}>
      {content}
    </Pressable>
  );
}

// Anahtar (web CookieBanner Toggle)
export function Switch({ value, onChange, accessibilityLabel }: { value: boolean; onChange: (v: boolean) => void; accessibilityLabel?: string }) {
  const t = toggleSwitch;
  return (
    <Pressable onPress={() => onChange(!value)} hitSlop={{ top: 10, bottom: 10, left: 1, right: 1 }} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={accessibilityLabel}
      style={{ width: t.width, height: t.height, borderRadius: t.radius, backgroundColor: value ? t.onBg : t.offBg }}>
      <View style={{ position: 'absolute', top: t.inset, left: value ? t.width - t.knob - t.inset : t.inset, width: t.knob, height: t.knob, borderRadius: t.knob / 2, backgroundColor: t.knobColor }} />
    </Pressable>
  );
}

// .ll-cta
export function Cta({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={s.ctaWrap}>
      <LinearGradient colors={[...llCta.gradient]} locations={[...llCta.locations]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
        <T w={700} style={{ fontSize: llCta.size, color: c.white }}>{label}</T>
      </LinearGradient>
    </Pressable>
  );
}

// .input-glass
export const Input = forwardRef<TextInputInstance, TextInputProps & { form?: boolean }>(function Input({ style, form, onFocus, onBlur, ...rest }, ref) {
  const [focus, setFocus] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={inputGlass.placeholder}
      keyboardAppearance="dark"
      onFocus={(e) => { setFocus(true); onFocus?.(e); }}
      onBlur={(e) => { setFocus(false); onBlur?.(e); }}
      {...rest}
      style={[
        s.input,
        form && { backgroundColor: inputGlass.formBg, borderColor: inputGlass.formBorder },
        focus && { borderColor: inputGlass.focusBorder },
        style,
      ]}
    />
  );
});

// Profilim Card/Row
export function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.row}>
      <T style={{ fontSize: 13, color: ll.text2 }}>{label}</T>
      <T style={{ fontSize: 13, color: color ?? ll.text }}>{value}</T>
    </View>
  );
}

// Alttan açılan pencere (KankaSection Sheet)
// pad: web'de bazı alt pencereler 20px 16px dolgu kullanır (CityPickerModalP, BirthDateField); varsayılan 24px 20px (KankaSection, TabProfilim)
export function Sheet({ visible, onClose, children, pad }: { visible: boolean; onClose: () => void; children: React.ReactNode; pad?: { top: number; h: number } }) {
  const insets = useSafeAreaInsets();
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.sheetOverlay} onPress={onClose}>
        <Pressable style={[s.sheet, pad && { paddingTop: pad.top, paddingHorizontal: pad.h }, { paddingBottom: sheet.padBottom + insets.bottom }]} onPress={() => undefined}>
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

// components/ui/Modal.tsx (glass-card, ortada)
export function ModalBox({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={s.modal} onPress={() => undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <T w={500} style={{ fontSize: 16 }}>{title}</T>
            <Pressable onPress={onClose} hitSlop={HIT} accessibilityLabel="Kapat"><T style={{ fontSize: 24, color: tw.muted, lineHeight: 26 }}>×</T></Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <View key={i} style={{ height: 20, borderRadius: 12, backgroundColor: tw.surface, width: i === lines - 1 ? '66%' : '100%' }} />
      ))}
    </View>
  );
}

export function Spinner() {
  return <ActivityIndicator color={tw.primary} />;
}

export function MaintenanceNotice() {
  return (
    <View style={{ marginBottom: 16, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: c.maintBg, borderWidth: 1, borderColor: c.maintBorder }}>
      <T w={600} style={{ fontSize: 14, color: c.maintText, marginBottom: 2 }}>Bakım çalışması</T>
      <T style={{ fontSize: 12, color: c.tCcc, lineHeight: 19 }}>
        Kısa bir bakım çalışması yapıyoruz. Bu sürede paket satın alma ve yeni eşleşmeler geçici olarak durduruldu.
      </T>
    </View>
  );
}

export function ErrorText({ children, center }: { children?: React.ReactNode; center?: boolean }) {
  if (!children) return null;
  return <T style={{ fontSize: 12, color: tw.accent, textAlign: center ? 'center' : 'left' }}>{children}</T>;
}

const s = StyleSheet.create({
  card: { borderRadius: llCard.radius, borderWidth: llCard.borderWidth, borderColor: llCard.borderColor, backgroundColor: llCard.bg, padding: llCard.padding },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: llHead.gap, marginBottom: llHead.marginBottom },
  title: { fontSize: llTitle.size, lineHeight: llTitle.size * llTitle.lineHeight, color: ll.text, flexShrink: 1 },
  eyebrow: { fontSize: llEyebrow.size, letterSpacing: llEyebrow.letterSpacing, color: ll.copper },
  note: { fontSize: llNote.size, color: ll.label },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', borderRadius: btnPrimary.radius, borderWidth: 1, paddingVertical: btnPrimary.padV, paddingHorizontal: btnPrimary.padH, gap: btnPrimary.gap },
  btnPrimary: { backgroundColor: btnPrimary.bg, borderColor: btnPrimary.border },
  btnGhost: { backgroundColor: 'transparent', borderColor: btnGhost.border },
  full: { alignSelf: 'stretch' },
  dot: { width: 4, height: 4, borderRadius: 2 },
  btnText: { fontSize: btnPrimary.size, letterSpacing: btnPrimary.size * btnPrimary.letterSpacing },
  ctaWrap: { borderRadius: llCta.radius, shadowColor: llCta.shadow, shadowOpacity: 1, shadowRadius: 15, shadowOffset: { width: 0, height: 10 } },
  cta: { minHeight: llCta.minHeight, borderRadius: llCta.radius, alignItems: 'center', justifyContent: 'center' },
  input: { backgroundColor: inputGlass.bg, borderWidth: 1, borderColor: inputGlass.border, borderRadius: inputGlass.radius, color: inputGlass.color, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, fontFamily: sans(400) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetOverlay: { flex: 1, backgroundColor: sheet.overlay, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: sheet.maxWidth, alignSelf: 'center', backgroundColor: sheet.bg, borderWidth: 1, borderColor: sheet.border, borderTopLeftRadius: sheet.radius, borderTopRightRadius: sheet.radius, paddingTop: sheet.padTop, paddingHorizontal: sheet.padH },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { width: '100%', maxWidth: 448, backgroundColor: glassCard.bg, borderWidth: 1, borderColor: glassCard.border, borderRadius: glassCard.radius, padding: 24 },
});

// Sayfa arka plan ışıması (web: position fixed, radial-gradient(circle, renk 0%, transparent stop), filter blur).
// top/left/right/bottom ekran oranı, w/h ekran genişliği oranı (vw). blur RN'de yok: yumuşak geçiş degradenin kendisiyle verilir.
export function PageGlow({ top, bottom, left, right, w, h, color, opacity, stop, center = false }: { top?: number; bottom?: number; left?: number; right?: number; w: number; h: number; color: string; opacity: number; stop: number; center?: boolean }) {
  const { width: W, height: H } = useWindowDimensions();
  const gw = W * w, gh = W * h;
  const pos: { position: 'absolute'; width: number; height: number; top?: number; bottom?: number; left?: number; right?: number } = { position: 'absolute', width: gw, height: gh };
  if (top !== undefined) pos.top = center ? H * top - gh / 2 : H * top;
  if (bottom !== undefined) pos.bottom = H * bottom;
  if (left !== undefined) pos.left = center || left === 0.5 ? W * left - gw / 2 : W * left;
  if (right !== undefined) pos.right = W * right;
  return (
    <View pointerEvents="none" style={pos}>
      <Svg width={gw} height={gh}>
        <Defs><SvgRadial id="pg" cx="50%" cy="50%" rx="50%" ry="50%"><Stop offset="0" stopColor={color} stopOpacity={opacity} /><Stop offset={stop} stopColor={color} stopOpacity={0} /></SvgRadial></Defs>
        <Ellipse cx={gw / 2} cy={gh / 2} rx={gw / 2} ry={gh / 2} fill="url(#pg)" />
      </Svg>
    </View>
  );
}

// .ll-glow: sağ üst kırmızı ışıma. Kaydırılan içeriğin (ScrollView içeriği) ilk çocuğu olarak konur; web'deki gibi sayfayla birlikte kayar.
export function Glow({ top = liveGlow.offset, right = liveGlow.offset }: { top?: number; right?: number }) {
  const g = liveGlow;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top, right, width: g.size, height: g.size }}>
      <Svg width={g.size} height={g.size}>
        <Defs><SvgRadial id="llglow" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={g.color} stopOpacity={g.opacity} /><Stop offset={g.stop} stopColor={g.color} stopOpacity={0} /></SvgRadial></Defs>
        <SvgRect width={g.size} height={g.size} fill="url(#llglow)" />
      </Svg>
    </View>
  );
}
