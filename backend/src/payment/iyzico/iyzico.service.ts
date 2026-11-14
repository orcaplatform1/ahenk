import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
// @ts-ignore — iyzipay does not have official TS types
import Iyzipay from "iyzipay";
import { decodeFakeIyzicoToken, encodeFakeIyzicoToken, isE2eFakeMode, readFakeControl, recordFake } from "../../common/e2e/fake-layer";

export type IyzicoCheckoutResult = {
  status: string;
  token?: string;
  checkoutFormContent?: string;
  errorMessage?: string;
  errorCode?: string;
};

export type IyzicoRefundResult = {
  status: string;
  paymentId?: string;
  price?: number;
  errorMessage?: string;
  errorCode?: string;
  // Bağlantı hatası: iade iyzico'ya ulaşmış olabilir, sonuç bilinmiyor; yeniden gönderilmez
  outcomeUnknown?: boolean;
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
      apiKey: (isE2eFakeMode() ? "e2e_fake" : this.config.get("IYZICO_API_KEY")) ?? "sandbox_placeholder",
      secretKey: (isE2eFakeMode() ? "e2e_fake" : this.config.get("IYZICO_SECRET_KEY")) ?? "sandbox_placeholder",
      uri: (isE2eFakeMode() ? "http://127.0.0.1:9" : this.config.get("IYZICO_BASE_URL")) ?? "https://sandbox-api.iyzipay.com",
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

    if (isE2eFakeMode()) {
      recordFake({ channel: "iyzico", template: "init", params: { conversationId: params.conversationId, basketId: params.basketId, price } });
      if (readFakeControl().iyzicoInit === "failure") return { status: "failure", errorMessage: "Sahte iyzico init hatası", errorCode: "E2E" };
      const token = encodeFakeIyzicoToken({ conversationId: params.conversationId, basketId: params.basketId, price });
      return { status: "success", token, checkoutFormContent: `<div id="e2e-fake-iyzico" data-token="${token}"></div>` };
    }

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
          category1: "Paket",
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
    if (isE2eFakeMode()) {
      const data = decodeFakeIyzicoToken(token);
      recordFake({ channel: "iyzico", template: "retrieve", params: { outcome: readFakeControl().iyzicoRetrieve ?? "success" } });
      if (!data || readFakeControl().iyzicoRetrieve === "failure") return { status: "failure", paymentStatus: "FAILURE", errorMessage: "Sahte iyzico ödeme hatası" };
      return { status: "success", paymentStatus: "SUCCESS", basketId: data.basketId, conversationId: data.conversationId, paymentId: `fake-pay-${data.conversationId}`, price: data.price, paidPrice: data.price };
    }
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
    if (isE2eFakeMode()) {
      recordFake({ channel: "iyzico", template: "refund", params: { paymentId: params.paymentId, amountKurus: params.amountKurus } });
      if (readFakeControl().iyzicoRefund === "failure") return { status: "failure", errorMessage: "Sahte iyzico iade hatası", errorCode: "E2E" };
      return { status: "success", paymentId: params.paymentId, price: params.amountKurus / 100 };
    }
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
            resolve({ status: "failure", errorMessage: err.message, outcomeUnknown: true });
          } else {
            resolve(result);
          }
        },
      );
    });
  }

  // ─── Prime: iyzico abonelik API'si (IYZICO_SUBSCRIPTION_ENABLED=true olunca kullanılır) ─────────────
  // Ürün ve fiyatlandırma planları lansmanda createPrimePlans ile bir kez tanımlanır; dönen referans kodları
  // IYZICO_PRIME_<1M|3M|6M|12M>_PLAN_REF env değişkenlerine yazılır. Planların deneme süresi (trialPeriodDays)
  // ilk dönemin gününe eşittir: ilk dönem standart ödeme formuyla (indirim uygulanabilir) alınır, abonelik
  // ilk tahsilatı dönem sonunda planın tam tutarıyla yapar ve aynı süreyle otomatik yeniler.

  private call<T>(resource: string, method: string, request: object): Promise<T & { status: string; errorMessage?: string }> {
    return new Promise((resolve) => {
      (this.client as unknown as Record<string, Record<string, (r: object, cb: (e: Error | null, res: T & { status: string; errorMessage?: string }) => void) => void>>)[resource][method](
        request,
        (err, result) => {
          if (err) {
            this.logger.error(`iyzico ${resource}.${method} hatası:`, err);
            resolve({ status: "failure", errorMessage: err.message } as T & { status: string; errorMessage?: string });
          } else resolve(result);
        },
      );
    });
  }

  async createPrimePlans(plans: { code: string; name: string; months: number; trialDays: number; priceKurus: number }[]) {
    const product = await this.call<{ data?: { referenceCode: string } }>("subscriptionProduct", "create", {
      locale: "tr", name: "Ahenk Prime", description: "Ahenk Prime abonelik",
    });
    if (product.status !== "success" || !product.data) return { status: "failure", errorMessage: product.errorMessage, plans: [] };
    const out: { code: string; referenceCode?: string; errorMessage?: string }[] = [];
    for (const pl of plans) {
      const r = await this.call<{ data?: { referenceCode: string } }>("subscriptionPricingPlan", "create", {
        locale: "tr",
        productReferenceCode: product.data.referenceCode,
        name: pl.name,
        price: (pl.priceKurus / 100).toFixed(2),
        currencyCode: "TRY",
        paymentInterval: "MONTHLY",
        paymentIntervalCount: pl.months,
        trialPeriodDays: pl.trialDays,
        planPaymentType: "RECURRING",
      });
      out.push({ code: pl.code, referenceCode: r.data?.referenceCode, errorMessage: r.status === "success" ? undefined : r.errorMessage });
    }
    return { status: "success", productReferenceCode: product.data.referenceCode, plans: out };
  }

  // Otomatik yenileme için abonelik ödeme formu (kart kaydı; deneme süresi boyunca tahsilat yapılmaz)
  async initSubscriptionCheckoutForm(params: {
    pricingPlanReferenceCode: string; conversationId: string; callbackUrl: string;
    name: string; surname: string; email: string; gsmNumber?: string; identityNumber: string;
  }): Promise<IyzicoCheckoutResult> {
    const address = { contactName: `${params.name} ${params.surname}`, city: "Istanbul", country: "Turkey", address: "Türkiye" };
    return this.call<IyzicoCheckoutResult>("subscriptionCheckoutForm", "initialize", {
      locale: "tr",
      conversationId: params.conversationId,
      callbackUrl: params.callbackUrl,
      pricingPlanReferenceCode: params.pricingPlanReferenceCode,
      subscriptionInitialStatus: "ACTIVE",
      customer: {
        name: params.name, surname: params.surname, email: params.email,
        gsmNumber: params.gsmNumber ?? "+905000000000", identityNumber: params.identityNumber,
        billingAddress: address, shippingAddress: address,
      },
    });
  }

  async retrieveSubscriptionCheckoutForm(token: string) {
    return this.call<{ data?: { referenceCode: string; subscriptionStatus: string; pricingPlanReferenceCode: string } }>(
      "subscriptionCheckoutForm", "retrieve", { checkoutFormToken: token },
    );
  }

  async cancelSubscription(subscriptionReferenceCode: string) {
    return this.call<object>("subscription", "cancel", { subscriptionReferenceCode });
  }
}
