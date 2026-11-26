import type { TFunction } from 'i18next';

// Canlı destek kısıtlamasının kalan süresi ("2 gün 5 saat" / "3 saat 12 dakika") — web SupportChatScreen supportRemaining ile aynı
export function supportRemaining(iso: string, t: TFunction) {
  const ms = Math.max(0, new Date(iso).getTime() - Date.now());
  const d = Math.floor(ms / 86_400_000); const h = Math.floor((ms % 86_400_000) / 3_600_000); const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? t('sup.timeDH', { d, h }) : t('sup.timeHM', { h, m });
}
