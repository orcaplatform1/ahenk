// İptal bildirimi: kişi sayısı yerine baş harfler; masayı dağıtmamak için taramanın sürdüğünü vurgular
export function cancellationNotice(initials: string[]): { title: string; body: string } {
  const names = initials.length > 1
    ? `${initials.slice(0, -1).join(", ")} ve ${initials[initials.length - 1]}`
    : initials[0];
  const who = initials.length > 1
    ? `${names} isimli kişiler rezervasyonlarını`
    : `${names} isimli kişi rezervasyonunu`;
  return {
    title: "Masa Güncellendi",
    body: `Masanızdan ${who} iptal etti, endişelenmeyin yapay zeka katmanı masanızı öncelikli eşleşme moduna yükseltti ve acele tarama modu devrede.`,
  };
}

export function initialsOf(profile?: { firstName?: string | null; lastName?: string | null } | null): string {
  const f = profile?.firstName ?? "";
  const l = profile?.lastName ?? "";
  return `${(f[0] ?? "?").toUpperCase()}.${(l[0] ?? "?").toUpperCase()}.`;
}
