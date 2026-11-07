// Masa içi baş harf rozeti (tek kaynak): masa kartı, Masalarım sohbeti ve Canlı Akış aynı sonucu kullanır.
// Aynı masada baş harfi (ad ilk harfi + soyad ilk harfi) çakışan katılımcılardan masaya ilk katılan normal kalır,
// sonrakilere katılım sırasına göre üst simge numara eklenir: "M.D.", "M.D.²", "M.D.³" …

const SUPERSCRIPT = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

export function superscript(n: number): string {
  return String(n).split("").map((d) => SUPERSCRIPT[Number(d)]).join("");
}

export interface InitialsPerson {
  userId: string;
  createdAt: Date; // Masaya katılım anı
  profile?: { firstName?: string | null; lastName?: string | null } | null;
}

export interface TableInitials {
  base: string; // "M.D."
  no: number | null; // Çakışmada 2, 3 …; çakışma yoksa null
  label: string; // "M.D." ya da "M.D.²"
}

export function baseInitials(profile?: { firstName?: string | null; lastName?: string | null } | null): string {
  const f = (profile?.firstName ?? "").trim()[0] ?? "?";
  const l = (profile?.lastName ?? "").trim()[0] ?? "?";
  return `${f.toUpperCase()}.${l.toUpperCase()}.`;
}

// Masanın tüm katılımcı kayıtları (iptal edenler dahil) verilir; sonuç userId → rozet
export function tableInitials(people: InitialsPerson[]): Map<string, TableInitials> {
  const ordered = [...people].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const seen = new Map<string, number>();
  const out = new Map<string, TableInitials>();
  for (const p of ordered) {
    const base = baseInitials(p.profile);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    const no = count > 1 ? count : null;
    out.set(p.userId, { base, no, label: no ? `${base}${superscript(no)}` : base });
  }
  return out;
}

// Masaya katılım sırası (anonim sandalye no): 1, 2, 3 …
export function seatNumbers(people: { userId: string; createdAt: Date }[]): Map<string, number> {
  const ordered = [...people].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return new Map(ordered.map((p, i) => [p.userId, i + 1]));
}
