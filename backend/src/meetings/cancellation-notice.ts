// İptal bildirimi: ayrılanın kimliği verilmez (anonim); masayı dağıtmamak için taramanın sürdüğünü vurgular
export function cancellationNotice(): { title: string; body: string } {
  return {
    title: "Masa Güncellendi",
    body: "Masanızdan bir katılımcı rezervasyonunu iptal etti, endişelenmeyin yapay zeka katmanı masanızı öncelikli eşleşme moduna yükseltti ve acele tarama modu devrede.",
  };
}

export function initialsOf(profile?: { firstName?: string | null; lastName?: string | null } | null): string {
  const f = profile?.firstName ?? "";
  const l = profile?.lastName ?? "";
  return `${(f[0] ?? "?").toUpperCase()}.${(l[0] ?? "?").toUpperCase()}.`;
}
