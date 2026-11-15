import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    this.client = new Redis(this.config.getOrThrow<string>("REDIS_URL"), {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    this.client.on("error", (err) => {
      this.logger.error("Redis bağlantı hatası:", err.message);
    });

    this.client.on("connect", () => {
      this.logger.log("Redis bağlandı");
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, "EX", ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  // Atomik sayaç: değer 1 artar; anahtar yeni oluştuysa süre tanımlanır (tek Lua betiği, eşzamanlı isteklerde güvenli)
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    return (await this.client.eval(
      "local n = redis.call('INCR', KEYS[1]) if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end return n",
      1, key, String(ttlSeconds),
    )) as number;
  }

  // Anahtar yoksa süreyle yazar (SET NX EX, atomik): true = bu istek yazdı, false = anahtar zaten vardı
  async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    return (await this.client.set(key, value, "EX", ttlSeconds, "NX")) === "OK";
  }

  async decr(key: string): Promise<void> {
    await this.client.decr(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }
}
