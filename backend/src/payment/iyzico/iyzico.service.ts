import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";
// @ts-ignore — iyzipay does not have official TS types
import * as Iyzipay from "iyzipay";

export type IyzicoCheckoutResult = {
  status: string;
  token?: string;
  checkoutFormContent?: string;
  errorMessage?: string;
  errorCode?: string;
};

// Abonelik API (v2) yanıtları: status + data
export type IyzicoSubscriptionResult<T = Record<string, unknown>> = {
  status: string;
  token?: string;
  checkoutFormContent?: string;
  data?: T;
  errorMessage?: string;
  errorCode?: string;
};

export type IyzicoSubscriptionData = {
  referenceCode?: string;
  parentReferenceCode?: string;
  customerReferenceCode?: string;
  subscriptionStatus?: string;
  pricingPlanReferenceCode?: string;
};

// Abonelik webhook gövdesi (iyzico dokümanı, "Subscription Format")
export type IyzicoSubscriptionWebhook = {
  orderReferenceCode: string;
  customerReferenceCode: string;
  subscriptionReferenceCode: string;
  iyziReferenceCode?: string;
  iyziEventType: string; // subscription.order.success | subscription.order.failure
  iyziEventTime?: number;
};

export type IyzicoRefundResult = {
  status: string;
  paymentId?: string;
  price?: number;
  errorMessage?: string;
  errorCode?: string;
};

export type IyzicoCallbackResult = {
  status: string;
  paymentStatus?: string;
  basketId?: string;
  paymentId?: string;
  conversationId?: string;
  price?: string;
  paidPrice?: string;
  errorMessage?: string;
};

@Injectable()
export class IyzicoService {
  private readonly logger = new Logger(IyzicoService.name);
  private readonly client: Iyzipay;

  constructor(private config: ConfigService) {
    this.client = new Iyzipay({
      apiKey: this.config.get("IYZICO_API_KEY") ?? "sandbox_placeholder",
      secretKey: this.config.get("IYZICO_SECRET_KEY") ?? "sandbox_placeholder",
      uri: this.config.get("IYZICO_BASE_URL") ?? "https://sandbox-api.iyzipay.com",
    });
  }

  // Checkout form başlatır — token ve form HTML'i döner
  async initCheckoutForm(params: {
    conversationId: string;
    amountKurus: number;
    basketId: string;
    itemName: string;
    buyerEmail: string;
    buyerName: string;
    buyerSurname: string;
    buyerPhone?: string;
    buyerIdentityNumber: string;
    buyerIp: string;
    callbackUrl: string;
  }): Promise<IyzicoCheckoutResult> {
    const price = (params.amountKurus / 100).toFixed(2);

    const request = {
      locale: "tr",
      conversationId: params.conversationId,
      price,
      paidPrice: price,
      currency: "TRY",
      basketId: params.basketId,
      paymentGroup: "PRODUCT",
      callbackUrl: params.callbackUrl,
      enabledInstallments: [1, 2, 3, 6],
      buyer: {
        id: params.conversationId,
        name: params.buyerName,
        surname: params.buyerSurname,
        gsmNumber: params.buyerPhone ?? "+905000000000",
        email: params.buyerEmail,
        identityNumber: params.buyerIdentityNumber,
        registrationAddress: "Türkiye",
        ip: params.buyerIp,
        city: "Istanbul",
        country: "Turkey",
      },
      shippingAddress: {
        contactName: `${params.buyerName} ${params.buyerSurname}`,
        city: "Istanbul",
        country: "Turkey",
        address: "Türkiye",
      },
      billingAddress: {
        contactName: `${params.buyerName} ${params.buyerSurname}`,
        city: "Istanbul",
        country: "Turkey",
        address: "Türkiye",
      },
      basketItems: [
        {
          id: params.basketId,
          name: params.itemName,
          category1: "Abonelik",
          itemType: "VIRTUAL",
          price,
        },
      ],
    };

    return new Promise((resolve) => {
      this.client.checkoutFormInitialize.create(request, (err: Error | null, result: IyzicoCheckoutResult) => {
        if (err) {
          this.logger.error("iyzico checkout init hatası:", err);
          resolve({ status: "failure", errorMessage: err.message });
        } else {
          resolve(result);
        }
      });
    });
  }

  // Callback token'ını doğrular
  async retrieveCheckoutForm(token: string): Promise<IyzicoCallbackResult> {
    return new Promise((resolve) => {
      this.client.checkoutForm.retrieve(
        { locale: "tr", token },
        (err: Error | null, result: IyzicoCallbackResult) => {
          if (err) {
            this.logger.error("iyzico retrieve hatası:", err);
            resolve({ status: "failure", errorMessage: err.message });
          } else {
            resolve(result);
          }
        },
      );
    });
  }

  // Ödeme ID'si üzerinden (kısmi) iade yapar
  async refundPayment(params: { paymentId: string; amountKurus: number; conversationId: string; ip: string }): Promise<IyzicoRefundResult> {
    return new Promise((resolve) => {
      this.client.refundV2.create(
        {
          locale: "tr",
          conversationId: params.conversationId,
          paymentId: params.paymentId,
          price: (params.amountKurus / 100).toFixed(2),
          currency: "TRY",
          ip: params.ip,
        },
        (err: Error | null, result: IyzicoRefundResult) => {
          if (err) {
            this.logger.error("iyzico iade hatası:", err);
            resolve({ status: "failure", errorMessage: err.message });
          } else {
            resolve(result);
          }
        },
      );
    });
  }

  // ─── Abonelik (otomatik yenileme) ─────────────────────────────────────────

  private call<T>(fn: (cb: (err: Error | null, result: T) => void) => void, label: string): Promise<T> {
    return new Promise((resolve) => {
      fn((err, result) => {
        if (err) {
          this.logger.error(`iyzico ${label} hatası:`, err);
          resolve({ status: "failure", errorMessage: err.message } as T);
        } else {
          resolve(result);
        }
      });
    });
  }

  // Abonelik ödeme formu: kart iyzico'da saklanır, iyzico her ay otomatik çeker
  initSubscriptionCheckout(params: {
    conversationId: string;
    pricingPlanReferenceCode: string;
    callbackUrl: string;
    name: string;
    surname: string;
    email: string;
    gsmNumber: string;
    identityNumber: string;
  }): Promise<IyzicoSubscriptionResult> {
    const contactName = `${params.name} ${params.surname}`.trim();
    return this.call(
      (cb) => this.client.subscriptionCheckoutForm.initialize({
        locale: "tr",
        conversationId: params.conversationId,
        callbackUrl: params.callbackUrl,
        pricingPlanReferenceCode: params.pricingPlanReferenceCode,
        subscriptionInitialStatus: "ACTIVE",
        customer: {
          name: params.name,
          surname: params.surname,
          email: params.email,
          gsmNumber: params.gsmNumber,
          identityNumber: params.identityNumber,
          billingAddress: { contactName, city: "Istanbul", country: "Turkey", address: "Türkiye" },
        },
      }, cb),
      "abonelik formu",
    );
  }

  retrieveSubscriptionCheckout(token: string): Promise<IyzicoSubscriptionResult<IyzicoSubscriptionData>> {
    return this.call((cb) => this.client.subscriptionCheckoutForm.retrieve({ checkoutFormToken: token }, cb), "abonelik formu sonucu");
  }

  // Sıradaki dönemden itibaren başka fiyat planına geçir (normal ↔ indirimli; aynı ürün, aynı periyot)
  upgradeSubscription(subscriptionReferenceCode: string, newPricingPlanReferenceCode: string): Promise<IyzicoSubscriptionResult<IyzicoSubscriptionData>> {
    return this.call(
      (cb) => this.client.subscription.upgrade({
        subscriptionReferenceCode,
        newPricingPlanReferenceCode,
        upgradePeriod: "NEXT_PERIOD",
        useTrial: false,
      }, cb),
      "abonelik plan değişikliği",
    );
  }

  cancelSubscription(subscriptionReferenceCode: string): Promise<IyzicoSubscriptionResult> {
    return this.call((cb) => this.client.subscription.cancel({ subscriptionReferenceCode }, cb), "abonelik iptali");
  }

  // Kurulum (scripts/iyzico-subscription-setup.ts): ürün ve aylık fiyat planı
  createSubscriptionProduct(name: string): Promise<IyzicoSubscriptionResult<{ referenceCode?: string }>> {
    return this.call((cb) => this.client.subscriptionProduct.create({ locale: "tr", name }, cb), "abonelik ürünü");
  }

  createMonthlyPricingPlan(productReferenceCode: string, name: string, amountKurus: number): Promise<IyzicoSubscriptionResult<{ referenceCode?: string }>> {
    return this.call(
      (cb) => this.client.subscriptionPricingPlan.create({
        locale: "tr",
        productReferenceCode,
        name,
        price: (amountKurus / 100).toFixed(2),
        currencyCode: "TRY",
        paymentInterval: "MONTHLY",
        paymentIntervalCount: 1,
        planPaymentType: "RECURRING",
      }, cb),
      "abonelik fiyat planı",
    );
  }

  // Webhook imzası (X-IYZ-SIGNATURE-V3): HMAC-SHA256(secretKey, merchantId + secretKey + eventType +
  // subscriptionReferenceCode + orderReferenceCode + customerReferenceCode), hex. iyzico dokümanındaki kod örneğiyle aynı sıra.
  verifySubscriptionWebhook(body: IyzicoSubscriptionWebhook, signature: string | undefined): boolean {
    const merchantId = this.config.get<string>("IYZICO_MERCHANT_ID");
    const secretKey = this.config.get<string>("IYZICO_SECRET_KEY");
    if (!merchantId || !secretKey || !signature) return false;
    const message = merchantId + secretKey + body.iyziEventType + body.subscriptionReferenceCode +
      body.orderReferenceCode + body.customerReferenceCode;
    const expected = Buffer.from(createHmac("sha256", secretKey).update(message, "utf8").digest("hex"));
    const given = Buffer.from(signature.trim().toLowerCase());
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
