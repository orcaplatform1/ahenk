'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';

const LENGTH = 6;

interface Props {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  error?: boolean;
  autoFocus?: boolean;
}

// 6 ayrı kutulu doğrulama kodu girişi — sadece rakam; yapıştırma, ok tuşları ve geri silme desteklenir
export default function OtpInput({ value, onChange, onComplete, error = false, autoFocus = true }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');

  function update(next: string[], focusIndex?: number) {
    const code = next.join('').slice(0, LENGTH);
    onChange(code);
    if (focusIndex !== undefined) refs.current[Math.min(focusIndex, LENGTH - 1)]?.focus();
    if (code.length === LENGTH && !next.includes('')) onComplete?.(code);
  }

  function handleChange(index: number, raw: string) {
    // Dolu kutuya yazılınca eski rakam atılır, yenisi alınır
    const fresh = digits[index] && raw.length === 2 ? (raw.startsWith(digits[index]) ? raw.slice(1) : raw.slice(0, 1)) : raw;
    const typed = fresh.replace(/\D/g, '');
    if (!typed) return;
    const next = [...digits];
    // Otomatik doldurma / çoklu karakter: index'ten itibaren dağıt
    typed.split('').slice(0, LENGTH - index).forEach((d, k) => { next[index + k] = d; });
    update(next, index + typed.length);
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[index]) { next[index] = ''; update(next, index); }
      else if (index > 0) { next[index - 1] = ''; update(next, index - 1); }
      return;
    }
    if (e.key === 'ArrowLeft' && index > 0) { e.preventDefault(); refs.current[index - 1]?.focus(); return; }
    if (e.key === 'ArrowRight' && index < LENGTH - 1) { e.preventDefault(); refs.current[index + 1]?.focus(); return; }
    if (e.key.length === 1 && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
  }

  function handlePaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    const next = [...digits];
    pasted.split('').slice(0, LENGTH - index).forEach((d, k) => { next[index + k] = d; });
    update(next, index + pasted.length);
  }

  return (
    <motion.div
      className="flex gap-2 justify-center"
      animate={error ? { x: [0, -8, 8, -8, 8, 0] } : { x: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      {digits.map((digit, i) => {
        const isFocused = focused === i;
        const border = error
          ? '1px solid rgba(192,57,43,1)'
          : isFocused
          ? '1px solid #c0392b'
          : digit
          ? '1px solid rgba(255,107,107,0.45)'
          : '1px solid rgba(255,255,255,0.10)';
        return (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={LENGTH}
            value={digit}
            aria-label={`${i + 1}. rakam`}
            autoFocus={autoFocus && i === 0}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={(e) => handlePaste(i, e)}
            onFocus={(e) => { setFocused(i); e.target.select(); }}
            onBlur={() => setFocused(null)}
            className="text-center text-[#f5f5f5] text-2xl font-semibold outline-none caret-[#ff6b6b]"
            style={{
              width: 48, height: 60, borderRadius: 14,
              background: digit ? 'rgba(192,57,43,0.08)' : 'rgba(255,255,255,0.06)',
              border,
              boxShadow: isFocused && !error ? '0 0 0 3px rgba(192,57,43,0.22)' : 'none',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
              fontVariantNumeric: 'tabular-nums',
            }}
          />
        );
      })}
    </motion.div>
  );
}
