import { BadRequestException, Injectable } from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import { RedisService } from "../redis/redis.service";

// Giriş / telefon değiştirme uçları için Redis tabanlı sınırlar (yeniden başlatmada sıfırlanmaz):
// - Uç başına IP + telefon (şifreli girişte IP + e-posta): dakikada 5 istek
// - Hesap başına 5 hatalı giriş denemesi (yanlış şifre ve yanlış kod birlikte) → hesap 15 dakika kilitlenir
const RATE_LIMIT = 5;
const RATE_WINDOW_SECONDS = 60;
const MAX_FAILURES = 5;
const LOCK_SECONDS = 15 * 60;
export const ACCOUNT_LOCKED_MESSAGE = "Çok fazla hatalı deneme yapıldı. Hesabın 15 dakika boyunca kilitlendi.";

@Injectable()
export class LoginGuardService {
  constructor(private redis: RedisService) {}

  // Sayaç atomik artar; sınır aşılınca genel "çok fazla istek" yanıtı (429) döner
  async hit(endpoint: string, ip: string | undefined, identifier: string): Promise<void> {
    const count = await this.redis.incrWithTtl(`rl:${endpoint}:${ip ?? "-"}:${identifier.toLowerCase()}`, RATE_WINDOW_SECONDS);
    if (count > RATE_LIMIT) throw new ThrottlerException();
  }

  async assertNotLocked(userId: string): Promise<void> {
    if (await this.redis.exists(`login:lock:${userId}`)) throw new BadRequestException(ACCOUNT_LOCKED_MESSAGE);
  }

  // Hatalı deneme: 5. denemede hesap 15 dakika kilitlenir
  async fail(userId: string): Promise<void> {
    const failures = await this.redis.incrWithTtl(`login:fail:${userId}`, LOCK_SECONDS);
    if (failures >= MAX_FAILURES) {
      await this.redis.set(`login:lock:${userId}`, "1", LOCK_SECONDS);
      await this.redis.del(`login:fail:${userId}`);
      throw new BadRequestException(ACCOUNT_LOCKED_MESSAGE);
    }
  }

  async success(userId: string): Promise<void> {
    await this.redis.del(`login:fail:${userId}`);
  }
}
