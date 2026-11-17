// İptal bildirimi: ayrılanın kimliği verilmez (anonim); masayı dağıtmamak için taramanın sürdüğünü vurgular
export function cancellationNotice(): { title: string; body: string; en: { title: string; body: string } } {
  return {
    title: "Masa Güncellendi",
    body: "Masandan bir katılımcı rezervasyonunu iptal etti, endişelenme yapay zeka katmanı masanı öncelikli eşleşme moduna yükseltti ve acele tarama modu devrede.",
    en: {
      title: "Table updated",
      body: "Someone at your table cancelled their booking. Don't worry — our AI layer has moved your table to priority matching and fast scanning is on.",
    },
  };
}

export function initialsOf(profile?: { firstName?: string | null; lastName?: string | null } | null): string {
  const f = profile?.firstName ?? "";
  const l = profile?.lastName ?? "";
  return `${(f[0] ?? "?").toUpperCase()}.${(l[0] ?? "?").toUpperCase()}.`;
}
