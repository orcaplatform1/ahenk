import { Injectable, BadRequestException } from "@nestjs/common";
import { randomInt } from "crypto";
import { RedisService } from "../../redis/redis.service";
import { WhatsappService } from "../whatsapp/whatsapp.service";

const OTP_TTL_SECONDS = 5 * 60; // 5 dakika
// Aynı numaraya yeni kod en erken 60 sn sonra (web'deki "Kodu tekrar gönder" sayacıyla aynı)
export const OTP_RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 3;
// Telefon başına günlük kod gönderim sınırı (Türkiye takvim günü): üye ve mekân paneli kodları tek sayaçta
const DAILY_SEND_LIMIT = 10;
const DAILY_LIMIT_MESSAGE = "Bugünlük doğrulama kodu hakkın doldu. Yarın tekrar deneyebilirsin.";

// Yanlış kod (süresi dolmuş koddan ayrı): hesap bazlı hatalı deneme sayımı için
export class OtpMismatchException extends BadRequestException {}

interface OtpEntry {
  code: string;
}

// Türkiye takvim günü (YYYY-AA-GG)
const trDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());

@Injectable()
export class OtpService {
  constructor(
    private redis: RedisService,
    private whatsapp: WhatsappService,
  ) {}

  // scope: üye kaydı (boş), mekân ve kariyer başvurusu kodları birbirine karışmaz
  private key(phone: string, scope = "") {
    return scope ? `otp:${scope}:${phone}` : `otp:${phone}`;
  }

  private async getEntry(phone: string, scope = ""): Promise<OtpEntry | null> {
    const raw = await this.redis.get(this.key(phone, scope));
    if (!raw) return null;
    return JSON.parse(raw) as OtpEntry;
  }

  private async saveEntry(phone: string, entry: OtpEntry, ttl = OTP_TTL_SECONDS, scope = "") {
    await this.redis.set(this.key(phone, scope), JSON.stringify(entry), ttl);
  }

  // Deneme sayacı ayrı anahtarda atomik artar (INCR): eşzamanlı istekler aynı değeri okuyamaz
  private attemptsKey(phone: string, scope = "") {
    return `${this.key(phone, scope)}:attempts`;
  }

  async send(phone: string, scope = ""): Promise<void> {
    const resendKey = scope ? `otp:resend:${scope}:${phone}` : `otp:resend:${phone}`;
    const wait = await this.redis.ttl(resendKey);
    if (wait > 0) throw new BadRequestException(`Yeni kod için ${wait} saniye bekleyin.`);
    // Günlük sınır: sayaç atomik artar; sınır aşılırsa ya da kod gönderilemezse geri alınır
    const dayKey = scope ? null : `otp:day:${phone}:${trDay()}`;
    if (dayKey && (await this.redis.incrWithTtl(dayKey, 48 * 60 * 60)) > DAILY_SEND_LIMIT) {
      await this.redis.decr(dayKey);
      throw new BadRequestException(DAILY_LIMIT_MESSAGE);
    }
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await this.redis.del(this.attemptsKey(phone, scope));
    await this.saveEntry(phone, { code }, OTP_TTL_SECONDS, scope);
    try {
      await this.whatsapp.sendOtp(phone, code);
      await this.redis.set(resendKey, "1", OTP_RESEND_SECONDS);
    } catch (err) {
      // Gönderilemeyen kod geçerli kalmasın
      await this.redis.del(this.key(phone, scope));
      if (dayKey) await this.redis.decr(dayKey);
      throw err;
    }
  }

  async verify(phone: string, code: string, scope = ""): Promise<void> {
    const entry = await this.getEntry(phone, scope);
    if (!entry) {
      throw new BadRequestException("Doğrulama kodunun süresi doldu, yeni kod isteyin");
    }

    // Her doğrulama isteği önce sayacı atomik artırır: bir kod için en fazla MAX_ATTEMPTS karşılaştırma yapılır
    const attempt = await this.redis.incrWithTtl(this.attemptsKey(phone, scope), OTP_TTL_SECONDS);
    if (attempt > MAX_ATTEMPTS) {
      await this.redis.del(this.key(phone, scope));
      throw new OtpMismatchException("Çok fazla hatalı deneme, yeni kod isteyin");
    }

    if (entry.code !== code) {
      if (attempt >= MAX_ATTEMPTS) {
        await this.redis.del(this.key(phone, scope));
        throw new OtpMismatchException("Çok fazla hatalı deneme, yeni kod isteyin");
      }
      throw new OtpMismatchException(`Kod hatalı. Kalan deneme hakkı: ${MAX_ATTEMPTS - attempt}`);
    }

    await this.redis.del(this.key(phone, scope));
    await this.redis.del(this.attemptsKey(phone, scope));
  }

}
