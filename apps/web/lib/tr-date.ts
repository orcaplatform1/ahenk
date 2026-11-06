// Tarayıcı saat diliminden bağımsız: içinde bulunulan yıl Europe/Istanbul'a göre
export const currentYearTR = () =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', year: 'numeric' }).format(new Date()));
