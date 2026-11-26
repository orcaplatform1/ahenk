import { randomBytes } from "crypto";

// Görsel dosya adı: rastgele 24 hex karakter
export const createId = () => randomBytes(12).toString("hex");
