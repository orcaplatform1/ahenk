import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
// @ts-ignore — iyzipay does not have official TS types
import * as Iyzipay from "iyzipay";

export type IyzicoCheckoutResult = {
  status: string;
  token?: string;
  checkoutFormContent?: string;
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
      uri: this.config.get("IYZICO_BASE_URL") ?? "https://sandbox.iyzipay.com",
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
        identityNumber: "00000000000",
        registrationAddress: "Türkiye",
        ip: "85.34.78.112",
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
}
