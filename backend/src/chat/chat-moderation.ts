// Masa sohbeti otomatik mesaj engeli.
// 1) Normalize: boşluk, nokta ve tire silinir, küçük harfe çevrilir, 1→i, 0→o, 3→e.
// 2) 7 veya daha fazla rakam ya da link (www, http, alan uzantıları) → anında engel (karşı tarafa iletilmez).
//    Rakam sayımı 1/0/3 harfe çevrilmeden önce yapılır (aksi hâlde 0, 1, 3 içeren numaralar sayılmazdı); alan uzantısı noktayla
//    birlikte aranır (nokta silinince ".com" kaybolurdu): "gmail . com" gibi boşluklu yazım da yakalanır.
// 3) Şüpheli kelime (instagram, insta, snap, telegram, whatsapp, numaram, hesabım, takip et, dm …) → mesaj bekletilir,
//    Claude Haiku'ya sorulur: masum → iletilir, ihlal → engellenir. Haiku'ya ulaşılamazsa iletilmez ("tekrar dene").
//    Kısa kelimeler (ig, wp, tel, dm) yalnız ayrı sözcük olarak aranır ("bilgi", "otel", "admin" gibi sözcüklerde tetiklenmez).
//    Yasaklı madde kelimeleri (kokain, eroin, esrar, kenevir, ilaç …) aynı şüpheli akışa girer; Haiku kelimenin mesajdaki
//    kullanımına bakar: yasaklı madde bağlamı değilse ("ilaç", "ot", "met", "koko", "kri" gibi başka anlamları) engellemez.
//    Çok sözcüklü olanlar normalize hâliyle (boşluksuz) aranır; kısa olanlar (ot, met, kri) yalnız ayrı sözcük olarak.
// 4) Listeye girmeyen mesaj Haiku'ya gönderilmez.
import Anthropic from "@anthropic-ai/sdk";

export type ModerationVerdict = "ALLOW" | "BLOCK" | "SUSPECT";

const LONG_WORDS = ["instagram", "insta", "instgram", "snapchat", "snap", "telegram", "whatsapp", "numaram", "hesabım", "hesabim", "takipet"];
const SHORT_WORDS = ["ig", "wp", "tel", "dm"];
// Yasaklı madde kelimeleri (normalize: boşluksuz, küçük harf; 1→i 0→o 3→e aynı dönüşümle eşleşir)
const SUBSTANCE_WORDS = [
  "kokain", "koko", "eroin", "metamfetamin", "kristal", "kıristal", "kıris", "esrar", "kenevir", "hintkeneviri", "türkotu",
  "mariana", "marik", "mariuana", "marryjane", "marryceyn", "mericeyn", "lemonhaise", "lemonhaize", "lemonheys", "lemonheyz",
  "limonheyz", "limonhais", "limonhaiz", "purpleheyz", "purplehaiz", "purplehais", "extacy", "lilika", "ilaç",
];
const SUBSTANCE_SHORT = ["ot", "met", "kri"];
const TLD = "com|net|org|tr|io|co|me|info|biz|app|dev|xyz|link|ly|gg|tv|online|site|shop|store|club|live";

const subst = (s: string) => s.replace(/1/g, "i").replace(/0/g, "o").replace(/3/g, "e");

export function normalizeMessage(content: string): string {
  return subst(content.toLocaleLowerCase("tr-TR").replace(/[\s.\-]+/g, ""));
}

export function checkMessage(content: string): ModerationVerdict {
  const lower = content.toLocaleLowerCase("tr-TR");
  const digits = (lower.replace(/[\s.\-]+/g, "").match(/\d/g) ?? []).length;
  if (digits >= 7) return "BLOCK";
  const dotted = lower.replace(/\s*\.\s*/g, ".");
  if (/(https?|www)/.test(normalizeMessage(content)) || new RegExp(`[a-z0-9ğüşöçı-]\\.(${TLD})\\b`, "i").test(dotted)) return "BLOCK";
  const norm = normalizeMessage(content);
  if (LONG_WORDS.some((w) => norm.includes(w)) || SUBSTANCE_WORDS.some((w) => norm.includes(w))) return "SUSPECT";
  const words = subst(lower).split(/[^a-zğüşöçı]+/i);
  if (words.some((w) => SHORT_WORDS.includes(w) || SUBSTANCE_SHORT.includes(w))) return "SUSPECT";
  return "ALLOW";
}

// Haiku kararı: true = ihlal, false = masum. Ulaşılamazsa / anahtar yoksa hata fırlatır.
export async function haikuIsViolation(content: string): Promise<boolean> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY tanımlı değil");
  const client = new Anthropic({ apiKey, timeout: 10_000, maxRetries: 1 });
  const message = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 5,
    system:
      "Sen bir sosyal buluşma uygulamasının masa sohbeti denetçisisin. Kural: telefon numarası, sosyal medya hesabı " +
      "(Instagram, Snapchat, Telegram, WhatsApp vb.), kullanıcı adı, link paylaşımı ya da başka bir kanaldan iletişime geçme / " +
      "takip etme teklifi yasaktır. Ayrıca yasaklı madde (uyuşturucu, uyarıcı, esrar, kokain, eroin, metamfetamin, ecstasy, " +
      "kenevir ve benzeri) içerikli mesajlar yasaktır: satın alma, satma, temin etme, kullanma, birlikte kullanma teklifi ya da bu " +
      "maddelere argo / takma adla gönderme. Kelimenin mesajdaki kullanım şeklini değerlendir: \"ilaç\", \"ot\", \"met\", \"koko\", " +
      "\"kri\" gibi başka anlamları da olan kelimeler yasaklı madde bağlamında değilse (ör. baş ağrısı ilacı, çay otu, isim, kısaltma) " +
      "ihlal sayma. Kullanıcının mesajı bu kurallardan birini ihlal ediyorsa yalnız IHLAL, etmiyorsa yalnız MASUM yaz.",
    messages: [{ role: "user", content: content.slice(0, 1000) }],
  });
  const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim().toUpperCase();
  if (text.startsWith("IHLAL") || text.startsWith("İHLAL")) return true;
  if (text.startsWith("MASUM")) return false;
  throw new Error(`Beklenmeyen yanıt: ${text}`);
}
