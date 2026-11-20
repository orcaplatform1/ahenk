import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isE2eFakeMode, last4, readFakeControl, recordFake } from "../common/e2e/fake-layer";

const SEND_TIMEOUT_MS = 10_000;

@Injectable()
export class WhatsappNotifyService {
  private readonly logger = new Logger(WhatsappNotifyService.name);
  private readonly apiBase = "https://graph.facebook.com/v21.0";

  constructor(private config: ConfigService) {}

  // language: alıcının dili; şablon dil kodu buna göre seçilir (İngilizce şablonlar Meta'da lansmanda hazırlanır)
  // Dönüş: gönderildi mi (stub / sahte modda true; kimlik bilgisi yoksa ya da API hata verirse false)
  async send(phone: string, templateName: string, bodyParams: string[], language: string = "tr"): Promise<boolean> {
    if (isE2eFakeMode()) {
      if (readFakeControl().whatsappFailPhones?.includes(phone)) {
        const err = new Error("The operation was aborted due to timeout");
        err.name = "TimeoutError";
        throw err;
      }
      recordFake({ channel: "whatsapp", template: templateName, to: last4(phone), params: bodyParams });
      return true;
    }
    if (this.config.get("NODE_ENV") !== "production") {
      this.logger.log(`[WhatsApp bildirim stub] şablon: ${templateName}`);
      return true;
    }

    const phoneNumberId = this.config.get<string>("WHATSAPP_PHONE_NUMBER_ID");
    const accessToken = this.config.get<string>("WHATSAPP_ACCESS_TOKEN");

    if (!phoneNumberId || !accessToken) {
      this.logger.warn("WhatsApp kimlik bilgileri eksik, bildirim atlandı");
      return false;
    }

    const normalizedPhone = phone.replace("+", "");

    const response = await fetch(`${this.apiBase}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: language === "en" ? "en" : "tr" },
          components: [
            {
              type: "body",
              parameters: bodyParams.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      this.logger.error(`WhatsApp bildirim hatası [${response.status}]: ${templateName}`);
      return false;
    }
    return true;
  }
}
