import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// S-29: animasyonlar iOS "Hareketi Azalt" ayarına bağlı (web prefers-reduced-motion karşılığı)
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}
