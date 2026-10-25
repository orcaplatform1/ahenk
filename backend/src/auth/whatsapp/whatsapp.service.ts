import { Injectable, Logger, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface MetaApiError {
  error?: { message: string; code: number };
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly apiBase = "https://graph.facebook.com/v21.0";

  constructor(private config: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    if (this.config.get("NODE_ENV") !== "production") {
      this.logger.log(`[WhatsApp OTP] ${phone} → ${code}`);
      return;
    }

    const phoneNumberId = this.config.getOrThrow<string>("WHATSAPP_PHONE_NUMBER_ID");
    const accessToken = this.config.getOrThrow<string>("WHATSAPP_ACCESS_TOKEN");
    const templateName = this.config.get<string>("WHATSAPP_OTP_TEMPLATE") ?? "ahenk_otp";

    // +90 önekini kaldır — Meta API numarayı ülke kodu dahil ama + olmadan ister
    const normalizedPhone = phone.replace("+", "");

    const body = {
      messaging_product: "whatsapp",
      to: normalizedPhone,
      type: "template",
      template: {
        name: templateName,
        language: { code: "tr" },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: code }],
          },
          {
            // Güvenlik butonu (copy_code) — template'de varsa
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: code }],
          },
        ],
      },
    };

    const response = await fetch(`${this.apiBase}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data: MetaApiError = await response.json().catch(() => ({}));
      this.logger.error(
        `WhatsApp API hatası [${response.status}]: ${data.error?.message ?? "Bilinmeyen hata"}`,
      );
      throw new InternalServerErrorException("OTP gönderilemedi, lütfen tekrar deneyin");
    }

    this.logger.log(`WhatsApp OTP gönderildi: ${normalizedPhone}`);
  }
}
