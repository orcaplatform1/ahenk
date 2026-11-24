'use client';

import React from 'react';

// Ortak standart buton (web): globals.css .btn-primary (dolgulu, kırmızı nokta) ve .btn-ghost (ince çerçeveli, gri nokta) stilleri
// bu bileşenin iki varyantıdır; renk, çerçeve, yazı tipi, harf aralığı ve nokta sınıflardan gelir.
// Yükseklik, iç boşluk ve yazı boyutu ana sayfa hero "Hemen Katıl" butonuyla aynıdır (9px 24px, 11px, satır 1.5);
// uzun yazı yalnız yana uzar, yükseklik değişmez. style yalnız yerleşim içindir (genişlik, kenar boşluğu, flex, opaklık).
export type StdButtonVariant = 'primary' | 'ghost';

export const STD_BUTTON_SIZE: React.CSSProperties = {
  height: 'auto',
  minHeight: 0,
  padding: '9px 24px',
  fontSize: 11,
  lineHeight: 1.5,
  letterSpacing: '0.14em',
  whiteSpace: 'nowrap',
};

type OwnProps<C extends React.ElementType> = {
  as?: C;
  variant?: StdButtonVariant;
  // .btn-ghost-red-dot
  redDot?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export type StdButtonProps<C extends React.ElementType = 'button'> = OwnProps<C> &
  Omit<React.ComponentPropsWithoutRef<C>, keyof OwnProps<C>>;

export function StdButton<C extends React.ElementType = 'button'>({ as, variant = 'primary', redDot, className, style, ...rest }: StdButtonProps<C>) {
  const Comp: React.ElementType = as ?? 'button';
  const cls = [variant === 'ghost' ? 'btn-ghost' : 'btn-primary', variant === 'ghost' && redDot ? 'btn-ghost-red-dot' : '', className ?? '']
    .filter(Boolean).join(' ');
  return <Comp className={cls} style={{ ...style, ...STD_BUTTON_SIZE }} {...rest} />;
}
