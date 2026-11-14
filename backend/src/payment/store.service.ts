import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createPrivateKey, randomUUID, sign } from "crypto";
import { readFileSync } from "fs";
import { PaymentPlatform, SubscriptionPlan } from "../generated/prisma/client";
import { isPrime } from "./package-rights";

// Mobil uygulama içi satın alma: iOS App Store (StoreKit), Android Play Store (Play Billing).
// Ürün kimlikleri App Store Connect ve Play Console'da aynı adla tanımlanır. Fiyatlar mağaza panelinde,
// admin "Fiyatlar" tablosundaki mobil fiyatla (ham × 1,20 ÷ 0,85) aynı kademe seçilerek girilir.
// Lansmana kadar pasif: IAP_ENABLED=true olmadan satın alma başlatılmaz.
export const STORE_PRODUCT_IDS: Record<SubscriptionPlan, string> = {
  [SubscriptionPlan.MASADA]: "co.ahenk.app.grup",
  [SubscriptionPlan.KARSIMDA]: "co.ahenk.app.basbasa",
  [SubscriptionPlan.KANKAMLA]: "co.ahenk.app.kankamla",
  [SubscriptionPlan.ICERDE]: "co.ahenk.app.icerde",
  [SubscriptionPlan.PRIME_1M]: "co.ahenk.app.prime.1m",
  [SubscriptionPlan.PRIME_3M]: "co.ahenk.app.prime.3m",
  [SubscriptionPlan.PRIME_6M]: "co.ahenk.app.prime.6m",
  [SubscriptionPlan.PRIME_12M]: "co.ahenk.app.prime.12m",
};
// Mobil indirim teklifleri (lansmana kadar pasif). Davet %10 ve 100 TL indirim aynı ödemede birlikte kullanılamaz.
// - Tek seferlik paketler: App Store'da tek seferlik ürüne teklif tanımlanamadığı için iki platformda da indirimli ayrı ürün:
//   <ürün>.davet10 (%10 indirimli mobil fiyat) ve <ürün>.indirim100 (mobil fiyat − 100 TL)
// - Prime: App Store promosyon teklifi / Google Play abonelik teklifi; teklif kimlikleri davet10 ve indirim100,
//   yalnız ilk dönem indirimli (yenilemeler tam fiyat)
export type StoreDiscount = "REFERRAL" | "WINBACK";
export const OFFER_IDS: Record<StoreDiscount, string> = { REFERRAL: "davet10", WINBACK: "indirim100" };
export const discountOfOffer = (offerId: string | null | undefined): StoreDiscount | null =>
  offerId === OFFER_IDS.REFERRAL ? "REFERRAL" : offerId === OFFER_IDS.WINBACK ? "WINBACK" : null;

// Ürün kimliğinden paket ve (tek seferlikte) indirim türü
export function parseProduct(productId: string): { plan: SubscriptionPlan; discount: StoreDiscount | null } | null {
  for (const [plan, id] of Object.entries(STORE_PRODUCT_IDS) as [SubscriptionPlan, string][]) {
    if (productId === id) return { plan, discount: null };
    if (!isPrime(plan) && productId === `${id}.${OFFER_IDS.REFERRAL}`) return { plan, discount: "REFERRAL" };
    if (!isPrime(plan) && productId === `${id}.${OFFER_IDS.WINBACK}`) return { plan, discount: "WINBACK" };
  }
  return null;
}
export const planOfProduct = (productId: string): SubscriptionPlan | null => parseProduct(productId)?.plan ?? null;

export type VerifiedPurchase = {
  productId: string;
  transactionId: string; // App Store transactionId / Play orderId
  originalTransactionId: string; // App Store originalTransactionId / Play purchaseToken (abonelik kimliği)
  expiresAt?: Date; // abonelikte dönem sonu
  autoRenewing?: boolean;
  offerId?: string | null; // abonelikte kullanılan teklif (davet10 / indirim100)
};

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);
  private readonly jwt = new JwtService({});

  constructor(private config: ConfigService) {}

  enabled(): boolean {
    return this.config.get<string>("IAP_ENABLED") === "true";
  }

  // /payment/init (mobil): mağaza penceresinde açılacak ürün ve (indirim hakkı varsa) teklif
  purchaseInfo(plan: SubscriptionPlan, platform: PaymentPlatform, discount: StoreDiscount | null) {
    if (!this.enabled()) return { stub: true, message: "Uygulama içi satın alma henüz aktif değil." };
    const base = STORE_PRODUCT_IDS[plan];
    if (!isPrime(plan)) {
      return { iap: true, platform, type: "in-app", productId: discount ? `${base}.${OFFER_IDS[discount]}` : base };
    }
    const offerId = discount ? OFFER_IDS[discount] : null;
    return {
      iap: true, platform, type: "subs", productId: base,
      offer: offerId ? (platform === PaymentPlatform.IOS ? this.signAppleOffer(base, offerId) : { offerId }) : null,
    };
  }

  // App Store promosyon teklifi imzası: bundleId ⁣ keyId ⁣ ürün ⁣ teklif ⁣ appAccountToken(boş) ⁣ nonce ⁣ zaman
  private signAppleOffer(productId: string, offerId: string) {
    const keyIdentifier = this.config.getOrThrow<string>("APPLE_IAP_KEY_ID");
    const nonce = randomUUID().toLowerCase();
    const timestamp = Date.now();
    const payload = [this.config.getOrThrow<string>("APPLE_BUNDLE_ID"), keyIdentifier, productId, offerId, "", nonce, String(timestamp)].join("\u2063");
    const key = createPrivateKey(readFileSync(this.config.getOrThrow<string>("APPLE_IAP_KEY_PATH"), "utf8"));
    const signature = sign("sha256", Buffer.from(payload, "utf8"), key).toString("base64");
    return { offerId, identifier: offerId, keyIdentifier, nonce, signature, timestamp };
  }

  assertEnabled() {
    if (!this.enabled()) throw new ServiceUnavailableException("Uygulama içi satın alma henüz aktif değil.");
  }

  // ─── App Store Server API ─────────────────────────────────────────────────
  private appleToken(): string {
    const key = readFileSync(this.config.getOrThrow<string>("APPLE_IAP_KEY_PATH"), "utf8");
    return this.jwt.sign(
      { iss: this.config.getOrThrow<string>("APPLE_IAP_ISSUER_ID"), aud: "appstoreconnect-v1", bid: this.config.getOrThrow<string>("APPLE_BUNDLE_ID") },
      { algorithm: "ES256", privateKey: key, keyid: this.config.getOrThrow<string>("APPLE_IAP_KEY_ID"), expiresIn: "5m" },
    );
  }

  // İşlem App Store'dan doğrudan okunur (TLS ile Apple'dan gelen imzalı işlem bilgisi)
  async verifyApple(transactionId: string): Promise<VerifiedPurchase | null> {
    const base = this.config.get<string>("APPLE_IAP_SANDBOX") === "true"
      ? "https://api.storekit-sandbox.itunes.apple.com"
      : "https://api.storekit.itunes.apple.com";
    const res = await fetch(`${base}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
      headers: { Authorization: `Bearer ${this.appleToken()}` },
    });
    if (!res.ok) {
      this.logger.warn(`App Store işlem doğrulanamadı: ${transactionId} HTTP ${res.status}`);
      return null;
    }
    const { signedTransactionInfo } = (await res.json()) as { signedTransactionInfo: string };
    const t = this.jwt.decode(signedTransactionInfo) as {
      productId: string; transactionId: string; originalTransactionId: string; expiresDate?: number; revocationDate?: number; bundleId: string;
      offerIdentifier?: string;
    };
    if (!t || t.revocationDate || t.bundleId !== this.config.get<string>("APPLE_BUNDLE_ID")) return null;
    return {
      productId: t.productId,
      transactionId: t.transactionId,
      originalTransactionId: t.originalTransactionId,
      expiresAt: t.expiresDate ? new Date(t.expiresDate) : undefined,
      offerId: t.offerIdentifier ?? null,
    };
  }

  // ─── Google Play Developer API ────────────────────────────────────────────
  private async googleAccessToken(): Promise<string> {
    const sa = JSON.parse(readFileSync(this.config.getOrThrow<string>("GOOGLE_PLAY_SERVICE_ACCOUNT_PATH"), "utf8")) as { client_email: string; private_key: string };
    const now = Math.floor(Date.now() / 1000);
    const assertion = this.jwt.sign(
      { iss: sa.client_email, scope: "https://www.googleapis.com/auth/androidpublisher", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 },
      { algorithm: "RS256", privateKey: sa.private_key },
    );
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    });
    const body = (await res.json()) as { access_token?: string };
    if (!body.access_token) throw new ServiceUnavailableException("Google Play erişim anahtarı alınamadı");
    return body.access_token;
  }

  async verifyGoogle(productId: string, purchaseToken: string): Promise<VerifiedPurchase | null> {
    const pkg = this.config.getOrThrow<string>("GOOGLE_PLAY_PACKAGE");
    const token = await this.googleAccessToken();
    const plan = planOfProduct(productId);
    if (!plan) return null;
    const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases`;
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    if (isPrime(plan)) {
      const res = await fetch(`${base}/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`, { headers });
      if (!res.ok) return null;
      const s = (await res.json()) as {
        subscriptionState: string; latestOrderId: string; acknowledgementState: string;
        lineItems: { productId: string; expiryTime: string; autoRenewingPlan?: { autoRenewEnabled?: boolean }; offerDetails?: { offerId?: string } }[];
      };
      const item = s.lineItems?.find((l) => l.productId === productId);
      if (!item || !["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"].includes(s.subscriptionState)) return null;
      if (s.acknowledgementState !== "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED") {
        await fetch(`${base}/subscriptions/${productId}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, { method: "POST", headers, body: "{}" });
      }
      return {
        productId, transactionId: s.latestOrderId, originalTransactionId: purchaseToken,
        expiresAt: new Date(item.expiryTime), autoRenewing: item.autoRenewingPlan?.autoRenewEnabled ?? false,
        offerId: item.offerDetails?.offerId ?? null,
      };
    }
    const res = await fetch(`${base}/products/${productId}/tokens/${encodeURIComponent(purchaseToken)}`, { headers });
    if (!res.ok) return null;
    const p = (await res.json()) as { purchaseState: number; orderId: string; acknowledgementState: number };
    if (p.purchaseState !== 0) return null;
    if (p.acknowledgementState !== 1) {
      await fetch(`${base}/products/${productId}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, { method: "POST", headers, body: "{}" });
    }
    return { productId, transactionId: p.orderId, originalTransactionId: purchaseToken };
  }

  decodeJws<T>(jws: string): T | null {
    return (this.jwt.decode(jws) as T) ?? null;
  }
}
