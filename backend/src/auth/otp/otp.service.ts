import { Injectable, BadRequestException } from "@nestjs/common";
import { randomInt } from "crypto";
import { RedisService } from "../../redis/redis.service";
import { WhatsappService } from "../whatsapp/whatsapp.service";

const OTP_TTL_SECONDS = 5 * 60; // 5 dakika
// Aynı numaraya yeni kod en erken 60 sn sonra (web'deki "Kodu tekrar gönder" sayacıyla aynı)
export const OTP_RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 3;

interface OtpEntry {
  code: string;
  attempts: number;
}

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

  async send(phone: string, scope = ""): Promise<void> {
    const resendKey = scope ? `otp:resend:${scope}:${phone}` : `otp:resend:${phone}`;
    const wait = await this.redis.ttl(resendKey);
    if (wait > 0) throw new BadRequestException(`Yeni kod için ${wait} saniye bekleyin.`);
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await this.saveEntry(phone, { code, attempts: 0 }, OTP_TTL_SECONDS, scope);
    try {
      await this.whatsapp.sendOtp(phone, code);
      await this.redis.set(resendKey, "1", OTP_RESEND_SECONDS);
    } catch (err) {
      // Gönderilemeyen kod geçerli kalmasın
      await this.redis.del(this.key(phone, scope));
      throw err;
    }
  }

  async verify(phone: string, code: string, scope = ""): Promise<void> {
    const entry = await this.getEntry(phone, scope);
    if (!entry) {
      throw new BadRequestException("Doğrulama kodunun süresi doldu, yeni kod isteyin");
    }

    if (entry.code !== code) {
      const attempts = entry.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await this.redis.del(this.key(phone, scope));
        throw new BadRequestException("Çok fazla hatalı deneme, yeni kod isteyin");
      }
      const ttl = await this.redis.ttl(this.key(phone, scope));
      await this.saveEntry(phone, { ...entry, attempts }, ttl > 0 ? ttl : OTP_TTL_SECONDS, scope);
      throw new BadRequestException(`Kod hatalı. Kalan deneme hakkı: ${MAX_ATTEMPTS - attempts}`);
    }

    await this.redis.del(this.key(phone, scope));
  }

  private async getRemainingTtl(phone: string): Promise<number> {
    const ttl = await this.redis.ttl(this.key(phone));
    return ttl < 0 ? 0 : OTP_TTL_SECONDS - ttl;
  }
}
