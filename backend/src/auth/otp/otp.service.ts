import { Injectable, BadRequestException } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service";
import { WhatsappService } from "../whatsapp/whatsapp.service";

const OTP_TTL_SECONDS = 5 * 60; // 5 dakika
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

  private key(phone: string) {
    return `otp:${phone}`;
  }

  private async getEntry(phone: string): Promise<OtpEntry | null> {
    const raw = await this.redis.get(this.key(phone));
    if (!raw) return null;
    return JSON.parse(raw) as OtpEntry;
  }

  private async saveEntry(phone: string, entry: OtpEntry, ttl = OTP_TTL_SECONDS) {
    await this.redis.set(this.key(phone), JSON.stringify(entry), ttl);
  }

  // OTP bypass aktif — gerçek WhatsApp API key gelince kaldır
  async send(_phone: string): Promise<void> {
    return;
  }

  async verify(_phone: string, _code: string): Promise<void> {
    return;
  }

  private async getRemainingTtl(phone: string): Promise<number> {
    const ttl = await this.redis.ttl(this.key(phone));
    return ttl < 0 ? 0 : OTP_TTL_SECONDS - ttl;
  }
}
