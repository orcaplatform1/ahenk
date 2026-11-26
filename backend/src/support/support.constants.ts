import * as path from "path";

// Canlı destek süreleri ve sınırları (CLAUDE.md CANLI DESTEK bölümüyle aynı)
export const SUPPORT_DIR = path.join(process.cwd(), "..", "uploads", "support");
export const SUPPORT_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // dosya başına 5 MB
export const SUPPORT_MAX_IMAGES = 3; // mesaj başına 3 görsel
export const SUPPORT_MESSAGE_MAX = 2000;
export const FIRST_REPLY_TIMEOUT_MS = 2 * 60_000; // atanan temsilci 2 dk içinde ilk cevabı vermezse başka temsilciye geçer
export const IDLE_WARN_MS = 2 * 60_000; // temsilcinin son mesajından 2 dk sonra uyarı
export const IDLE_CLOSE_MS = 3 * 60_000; // 3. dakikada otomatik sonlanır
export const QUEUE_ALERT_MS = 90_000; // sırada 90 sn'yi geçen sohbet: ADMIN / SUPERADMIN'e bildirim
export const TYPING_TTL_MS = 5_000; // yazıyor göstergesi / yazı önizlemesi (yalnız bellekte)
export const AWAY_MS = 20_000; // ekranı bu süredir yoklamayan taraf uygulamadan çıkmış sayılır (push gider)
export const PENDING_RATING_MS = 24 * 3600_000; // kapanan sohbetin değerlendirme ekranı 24 saat açılabilir
export const RESTRICT_DAYS = [1, 7, 30] as const;
export const DEFAULT_MAX_CHATS = 3;
export const DEFAULT_SHIFT_DAY = "08:00-20:00";
export const DEFAULT_SHIFT_NIGHT = "20:00-08:00";
export const TICK_MS = 10_000;
export const TAKEOVER_NOTE = "SUPERADMIN devraldı"; // SUPERADMIN devralmasının devir notu (eski temsilcinin salt okunur görünümü bu kayda bakar)

// Sistem mesajı kodları (istemci arayüz dilinde gösterir: sup.sys*)
export const SYS = {
  NOTICE: "NOTICE", // kayıt / Aydınlatma Metni bildirimi
  GREETING: "GREETING", // "Merhaba, ben Ahenk müşteri temsilcisiyim…"
  TRANSFERRED: "TRANSFERRED", // görüşme başka temsilciye aktarıldı
  IDLE_WARNING: "IDLE_WARNING", // 1 dakika içinde yanıt vermezsen…
} as const;

export const SYS_TR: Record<string, string> = {
  NOTICE: "Hizmet kalitesinin artırılması ve güvenliğin için görüşmelerimiz kayıt altına alınır. Kişisel verilerinle ilgili Aydınlatma Metni'ni inceleyebilirsin.",
  GREETING: "Merhaba, ben Ahenk müşteri temsilcisiyim. Bugün size yardımcı olmaktan mutluluk duyacağım.",
  TRANSFERRED: "Görüşmen başka bir temsilcimize aktarıldı, durumu baştan anlatmana gerek yok.",
  IDLE_WARNING: "1 dakika içinde yanıt vermezsen sohbet sonlanacak.",
};

// Değerlendirme etiketleri (yıldıza göre)
export const RATING_TAGS: Record<"good" | "mid" | "bad", string[]> = {
  good: ["CARED", "SOLUTION", "POLITE", "FAST", "PROCESS_OK"],
  mid: ["MORE_CARING", "KNOWLEDGE", "FASTER", "PROCESS_IMPROVE"],
  bad: ["UNINTERESTED", "NO_REPLY", "LACK_KNOWLEDGE", "RUDE", "PROCESS_BAD", "SLOW"],
};
export const RATING_TAG_TR: Record<string, string> = {
  CARED: "Talebimle ilgilendi", SOLUTION: "Çözüm odaklıydı", POLITE: "Kibardı", FAST: "Hızlıydı", PROCESS_OK: "Süreçlerden memnunum",
  MORE_CARING: "Daha ilgili/nazik olabilirdi", KNOWLEDGE: "Bilgisi yeterli değildi", FASTER: "Daha hızlı olabilirdi", PROCESS_IMPROVE: "Süreçler geliştirilebilir",
  UNINTERESTED: "İlgisizdi", NO_REPLY: "Cevap vermedi", LACK_KNOWLEDGE: "Bilgisi eksikti", RUDE: "Üslubu uygun değildi", PROCESS_BAD: "Süreçlerden memnun değilim", SLOW: "Hızlı değildi",
};
export const TOPIC_TR: Record<string, string> = { ACCOUNT: "Hesap", PAYMENT: "Ödeme", MEETING: "Masa", OTHER: "Diğer" };
