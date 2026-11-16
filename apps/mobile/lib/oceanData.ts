// packages/ui/src/components/ocean/oceanData.ts karşılığı (S-05: web dosyaları değiştirilmez)
// OCEAN metinleri çeviri dosyalarında (ocean.<boyut>_…); alanlar okunduğu anda arayüz dilinde döner
import i18n from './i18n';

export type OceanKey = 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';
const KEYS: OceanKey[] = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
const tx = (key: OceanKey, field: string) => i18n.t(`ocean.${key}_${field}`);

export interface OceanDimension {
  key: OceanKey;
  label: string;
  sub: string;
  levels: readonly string[];
  axis: { label: string; desc: string };
  trait: { label: string; radarLabel: string; desc: string };
}

export const OCEAN_DIMENSIONS: OceanDimension[] = KEYS.map((key) => ({
  key,
  get label() { return tx(key, 'label'); },
  get sub() { return tx(key, 'sub'); },
  get levels() { return [0, 1, 2].map((i) => tx(key, `level${i}`)); },
  axis: { get label() { return tx(key, 'axisLabel'); }, get desc() { return tx(key, 'axisDesc'); } },
  trait: { get label() { return tx(key, 'traitLabel'); }, get radarLabel() { return tx(key, 'traitRadar'); }, get desc() { return tx(key, 'traitDesc'); } },
}));

// OceanRadar eksen ve hover metinleri
export const OCEAN_RADAR_AXES = KEYS.map((key) => ({ key, get label() { return tx(key, 'axisLabel'); }, get desc() { return tx(key, 'axisDesc'); } }));

// Test sonuç sayfası radar ve özellik metinleri
export const OCEAN_TRAITS = KEYS.map((key) => ({ key, get label() { return tx(key, 'traitLabel'); }, get radarLabel() { return tx(key, 'traitRadar'); }, get desc() { return tx(key, 'traitDesc'); } }));
