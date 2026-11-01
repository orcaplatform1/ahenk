import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as admin from "firebase-admin";
import { isE2eFakeMode, readFakeControl, recordFake } from "../../common/e2e/fake-layer";

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private initialized = false;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const projectId = this.config.get<string>("FIREBASE_PROJECT_ID");
    const clientEmail = this.config.get<string>("FIREBASE_CLIENT_EMAIL");
    const privateKey = this.config.get<string>("FIREBASE_PRIVATE_KEY");

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn("Firebase kimlik bilgileri eksik — FCM push devre dışı (dev modu)");
      return;
    }

    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
      });
    }

    this.initialized = true;
    this.logger.log("Firebase Admin SDK başlatıldı");
  }

  async sendToToken(params: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<boolean> {
    if (isE2eFakeMode()) {
      const ok = !readFakeControl().fcmFail;
      recordFake({ channel: "fcm", template: params.title, to: params.token.slice(-4), params: { body: params.body, data: params.data, ok } });
      return ok;
    }
    if (!this.initialized) {
      this.logger.log(`[FCM stub] ${params.title}`);
      return true;
    }

    try {
      await admin.messaging().send({
        token: params.token,
        notification: { title: params.title, body: params.body },
        data: params.data ?? {},
        android: { priority: "high" },
        apns: { payload: { aps: { sound: "default" } } },
      });
      return true;
    } catch (err) {
      this.logger.error(`FCM gönderim hatası (token: ${params.token.slice(0, 10)}…): ${err}`);
      return false;
    }
  }
}
