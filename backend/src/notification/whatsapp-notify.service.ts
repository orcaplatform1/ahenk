import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const SEND_TIMEOUT_MS = 10_000;

@Injectable()
export class WhatsappNotifyService {
  private readonly logger = new Logger(WhatsappNotifyService.name);
  private readonly apiBase = "https://graph.facebook.com/v21.0";

  constructor(private config: ConfigService) {}

  async send(phone: string, templateName: string, bodyParams: string[]): Promise<void> {
    if (this.config.get("NODE_ENV") !== "production") {
      this.logger.log(`[WhatsApp bildirim stub] şablon: ${templateName}`);
      return;
    }

    const phoneNumberId = this.config.get<string>("WHATSAPP_PHONE_NUMBER_ID");
    const accessToken = this.config.get<string>("WHATSAPP_ACCESS_TOKEN");

    if (!phoneNumberId || !accessToken) {
      this.logger.warn("WhatsApp kimlik bilgileri eksik, bildirim atlandı");
      return;
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
          language: { code: "tr" },
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
    }
  }
}
