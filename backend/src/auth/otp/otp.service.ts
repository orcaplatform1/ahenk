import { Injectable, BadRequestException, HttpException, HttpStatus } from "@nestjs/common";
import { randomInt } from "crypto";
import { RedisService } from "../../redis/redis.service";
import { WhatsappService } from "../whatsapp/whatsapp.service";

// Kod geçerlilik süresi ve yeni kod isteme bekleme süresi her akışta birbirine eşittir (120 saniye); tek sabit
const OTP_TTL_SECONDS = 120;
export const OTP_RESEND_SECONDS = OTP_TTL_SECONDS;
// Kod gönderen akışlar: kod ve bekleme süresi telefon + akış bazında Redis'te tutulur (akışların kodları birbirinin yerine geçmez)
export type OtpFlow =
  | "register" | "login" | "forgot-password" | "change-phone"
  | "venue-login" | "venue-forgot-password" | "venue-apply" | "career-apply" | "janti-apply";
const MAX_ATTEMPTS = 3;
// Günlük sınıra sayılan akışlar: üye ve mekân paneli kodları (başvuru formları sayaç dışı)
const DAILY_LIMIT_FLOWS: OtpFlow[] = ["register", "login", "forgot-password", "change-phone", "venue-login", "venue-forgot-password"];
// Telefon başına günlük kod gönderim sınırı (Türkiye takvim günü): üye ve mekân paneli kodları tek sayaçta
const DAILY_SEND_LIMIT = 10;
const DAILY_LIMIT_MESSAGE = "Bugünlük doğrulama kodu hakkın doldu. Yarın tekrar deneyebilirsin.";

// Bekleme süresi dolmadan yeni kod istendi: kod gönderilmez, yanıtta kalan saniye (resendSeconds) döner
export class OtpWaitException extends HttpException {
  constructor(public readonly resendSeconds: number) {
    super({ statusCode: HttpStatus.BAD_REQUEST, error: "Bad Request", message: `Yeni kod için ${resendSeconds} saniye bekle.`, resendSeconds }, HttpStatus.BAD_REQUEST);
  }
}

// Numara bu akış için uygun değil (kayıtlı değil / zaten kayıtlı): kod gönderilmez, bekleme süresi başlamaz.
// code alanı istemcinin uyarının altında doğru butonu ("Kayıt ol" / "Mekân ekle" / "Giriş yap") göstermesi içindir.
export type OtpPhoneNoticeCode =
  | "PHONE_NOT_REGISTERED" | "VENUE_NOT_REGISTERED" | "PHONE_ALREADY_REGISTERED" | "VENUE_ACCOUNT_INACTIVE" | "VENUE_PHONE_MULTIPLE";
const OTP_PHONE_NOTICES: Record<OtpPhoneNoticeCode, { status: HttpStatus; message: string }> = {
  PHONE_NOT_REGISTERED: { status: HttpStatus.NOT_FOUND, message: "Bu numarayla kayıtlı hesap bulunamadı." },
  VENUE_NOT_REGISTERED: { status: HttpStatus.NOT_FOUND, message: "Bu numarayla kayıtlı mekân hesabı bulunamadı." },
  PHONE_ALREADY_REGISTERED: { status: HttpStatus.CONFLICT, message: "Bu numara zaten kayıtlı. Giriş yapabilirsin." },
  VENUE_ACCOUNT_INACTIVE: { status: HttpStatus.FORBIDDEN, message: "Bu mekân hesabı aktif değil. Destek ile iletişime geç." },
  VENUE_PHONE_MULTIPLE: { status: HttpStatus.CONFLICT, message: "Bu numara birden fazla mekân hesabına bağlı. Destek ile iletişime geç." },
};
export class OtpPhoneNoticeException extends HttpException {
  constructor(code: OtpPhoneNoticeCode) {
    const { status, message } = OTP_PHONE_NOTICES[code];
    super({ statusCode: status, message, code }, status);
  }
}

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

  private key(phone: string, flow: OtpFlow) {
    return `otp:code:${flow}:${phone}`;
  }

  private async getEntry(phone: string, flow: OtpFlow): Promise<OtpEntry | null> {
    const raw = await this.redis.get(this.key(phone, flow));
    if (!raw) return null;
    return JSON.parse(raw) as OtpEntry;
  }

  // Deneme sayacı ayrı anahtarda atomik artar (INCR): eşzamanlı istekler aynı değeri okuyamaz
  private attemptsKey(phone: string, flow: OtpFlow) {
    return `${this.key(phone, flow)}:attempts`;
  }

  private waitKey(phone: string, flow: OtpFlow) {
    return `otp:wait:${flow}:${phone}`;
  }

  // Bekleme süresini atomik başlatır (SET NX): süre işliyorsa kalan saniyeyle reddeder
  private async claimWait(phone: string, flow: OtpFlow): Promise<void> {
    const key = this.waitKey(phone, flow);
    if (await this.redis.setIfAbsent(key, "1", OTP_RESEND_SECONDS)) return;
    const left = await this.redis.ttl(key);
    throw new OtpWaitException(left > 0 ? left : 1);
  }

  // Kod gönderir; dönen değer yeni kod isteyebilmek için beklenecek saniyedir.
  // Gönderilemeyen kod (ya da günlük sınıra takılan istek) bekleme süresini başlatmaz.
  // language: alıcının dili (WhatsApp OTP şablon dil kodu)
  async send(phone: string, flow: OtpFlow, language: string = "tr"): Promise<number> {
    await this.claimWait(phone, flow);
    try {
      // Günlük sınır: sayaç atomik artar; sınır aşılırsa ya da kod gönderilemezse geri alınır
      const dayKey = DAILY_LIMIT_FLOWS.includes(flow) ? `otp:day:${phone}:${trDay()}` : null;
      if (dayKey && (await this.redis.incrWithTtl(dayKey, 48 * 60 * 60)) > DAILY_SEND_LIMIT) {
        await this.redis.decr(dayKey);
        throw new BadRequestException(DAILY_LIMIT_MESSAGE);
      }
      const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
      await this.redis.del(this.attemptsKey(phone, flow));
      await this.redis.set(this.key(phone, flow), JSON.stringify({ code } satisfies OtpEntry), OTP_TTL_SECONDS);
      try {
        await this.whatsapp.sendOtp(phone, code, language);
      } catch (err) {
        // Gönderilemeyen kod geçerli kalmasın
        await this.redis.del(this.key(phone, flow));
        if (dayKey) await this.redis.decr(dayKey);
        throw err;
      }
    } catch (err) {
      await this.redis.del(this.waitKey(phone, flow));
      throw err;
    }
    return OTP_RESEND_SECONDS;
  }

  // Kod, istendiği akışın anahtarından okunur: başka akış için gönderilen kod geçerli sayılmaz
  async verify(phone: string, code: string, flow: OtpFlow): Promise<void> {
    const entry = await this.getEntry(phone, flow);
    if (!entry) {
      throw new BadRequestException("Doğrulama kodunun süresi doldu, yeni kod iste");
    }

    // Her doğrulama isteği önce sayacı atomik artırır: bir kod için en fazla MAX_ATTEMPTS karşılaştırma yapılır
    const attempt = await this.redis.incrWithTtl(this.attemptsKey(phone, flow), OTP_TTL_SECONDS);
    if (attempt > MAX_ATTEMPTS) {
      await this.redis.del(this.key(phone, flow));
      throw new OtpMismatchException("Çok fazla hatalı deneme, yeni kod iste");
    }

    if (entry.code !== code) {
      if (attempt >= MAX_ATTEMPTS) {
        await this.redis.del(this.key(phone, flow));
        throw new OtpMismatchException("Çok fazla hatalı deneme, yeni kod iste");
      }
      throw new OtpMismatchException(`Kod hatalı. Kalan deneme hakkı: ${MAX_ATTEMPTS - attempt}`);
    }

    await this.redis.del(this.key(phone, flow));
    await this.redis.del(this.attemptsKey(phone, flow));
  }
}
