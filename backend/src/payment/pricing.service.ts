import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PlanPrice, RecurringStatus, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { IyzicoService } from "./iyzico/iyzico.service";
import { PLAN_CONFIG } from "./payment.constants";
import { computePrices } from "./pricing";

const PLANS = [SubscriptionPlan.MASADA, SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE];

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    private prisma: PrismaService,
    private iyzico: IyzicoService,
    private notifications: NotificationService,
  ) {}

  // Geçerli fiyat = paketin en son fiyat kaydı
  async current(plan: SubscriptionPlan): Promise<PlanPrice> {
    const row = await this.prisma.planPrice.findFirst({ where: { plan }, orderBy: { createdAt: "desc" } });
    if (!row) throw new BadRequestException("Paket fiyatı tanımlı değil");
    return row;
  }

  async all(): Promise<Record<SubscriptionPlan, PlanPrice>> {
    const rows = await Promise.all(PLANS.map((p) => this.current(p)));
    return Object.fromEntries(rows.map((r) => [r.plan, r])) as Record<SubscriptionPlan, PlanPrice>;
  }

  // Abonelik çekiminin fiyatı: çekimin yapıldığı iyzico planına ait kayıt (fiyat değişse de o anki tutar)
  async byIyzicoPlanRef(ref: string | null): Promise<{ row: PlanPrice; discounted: boolean } | null> {
    if (!ref) return null;
    const row = await this.prisma.planPrice.findFirst({
      where: { OR: [{ iyzicoPlanRef: ref }, { iyzicoDiscountPlanRef: ref }] },
    });
    return row ? { row, discounted: row.iyzicoDiscountPlanRef === ref } : null;
  }

  // Abonelik paketinin geçerli fiyatı için iyzico normal + indirimli planları yoksa oluşturulur (iyzico'da plan fiyatı değiştirilemez)
  async ensureIyzicoPlans(plan: SubscriptionPlan): Promise<PlanPrice> {
    const row = await this.current(plan);
    if (row.iyzicoPlanRef && row.iyzicoDiscountPlanRef) return row;
    const refs = await this.createIyzicoPlans(plan, row);
    return this.prisma.planPrice.update({ where: { id: row.id }, data: refs });
  }

  private async createIyzicoPlans(plan: SubscriptionPlan, prices: { webKurus: number; webDiscountKurus: number }) {
    const productRef = await this.productRef(plan);
    const name = PLAN_CONFIG[plan].nametr;
    const stamp = new Date().toISOString().slice(0, 10);
    const normal = await this.iyzico.createMonthlyPricingPlan(productRef, `${name} ${prices.webKurus / 100}₺ (${stamp})`, prices.webKurus);
    const discount = await this.iyzico.createMonthlyPricingPlan(productRef, `${name} ${prices.webDiscountKurus / 100}₺ indirimli (${stamp})`, prices.webDiscountKurus);
    const iyzicoPlanRef = normal.data?.referenceCode;
    const iyzicoDiscountPlanRef = discount.data?.referenceCode;
    if (normal.status !== "success" || discount.status !== "success" || !iyzicoPlanRef || !iyzicoDiscountPlanRef) {
      throw new BadRequestException(`iyzico fiyat planı oluşturulamadı: ${normal.errorMessage ?? discount.errorMessage ?? "bilinmeyen hata"}`);
    }
    return { iyzicoPlanRef, iyzicoDiscountPlanRef };
  }

  // iyzico abonelik ürünü pakete bir kez açılır, kodu AppConfig'te tutulur
  private async productRef(plan: SubscriptionPlan): Promise<string> {
    const key = `IYZICO_PRODUCT_${plan}`;
    const saved = await this.prisma.appConfig.findUnique({ where: { key } });
    if (saved?.value) return saved.value;
    const product = await this.iyzico.createSubscriptionProduct(`Ahenk ${PLAN_CONFIG[plan].nametr}`);
    const ref = product.data?.referenceCode;
    if (product.status !== "success" || !ref) {
      throw new BadRequestException(`iyzico abonelik ürünü oluşturulamadı: ${product.errorMessage ?? "bilinmeyen hata"}`);
    }
    await this.prisma.appConfig.upsert({ where: { key }, update: { value: ref }, create: { key, value: ref } });
    return ref;
  }

  // ─── SUPERADMIN fiyat güncelleme ──────────────────────────────────────────

  async listForAdmin() {
    const current = await this.all();
    const history = await this.prisma.planPrice.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        plan: true, netKurus: true, webKurus: true, mobileKurus: true, createdAt: true,
        createdBy: { select: { profile: { select: { firstName: true, lastName: true } } } },
      },
    });
    return {
      current: PLANS.map((plan) => {
        const r = current[plan];
        return {
          plan, name: PLAN_CONFIG[plan].nametr, recurring: PLAN_CONFIG[plan].recurring,
          netKurus: r.netKurus, webKurus: r.webKurus, mobileKurus: r.mobileKurus,
          webDiscountKurus: r.webDiscountKurus, mobileDiscountKurus: r.mobileDiscountKurus, updatedAt: r.createdAt,
        };
      }),
      history,
    };
  }

  // Onaylanan ham fiyatlar: değişen paket için yeni kayıt; abonelik paketlerinde önce iyzico planları açılır
  // (iyzico hata verirse hiçbir fiyat değişmez). Mevcut aboneler sonraki yenilemede yeni fiyata geçer ve bir kez bilgilendirilir.
  async updatePrices(changes: { plan: SubscriptionPlan; netKurus: number }[], adminId: string) {
    const current = await this.all();
    const changed = changes.filter((c) => c.netKurus !== current[c.plan].netKurus);
    if (changed.length === 0) return this.listForAdmin();

    const prepared = [];
    for (const c of changed) {
      const prices = computePrices(c.netKurus);
      const refs = PLAN_CONFIG[c.plan].recurring ? await this.createIyzicoPlans(c.plan, prices) : {};
      prepared.push({ plan: c.plan, ...prices, ...refs, createdById: adminId });
    }
    await this.prisma.$transaction(prepared.map((data) => this.prisma.planPrice.create({ data })));

    for (const p of prepared) {
      if (PLAN_CONFIG[p.plan].recurring) await this.migrateSubscribers(p.plan);
    }
    return this.listForAdmin();
  }

  // Aktif aboneler: sıradaki dönemden itibaren yeni fiyat planına geçirilir + tek seferlik uygulama içi bildirim
  private async migrateSubscribers(plan: SubscriptionPlan) {
    const price = await this.current(plan);
    const subs = await this.prisma.recurringSubscription.findMany({
      where: { plan, status: RecurringStatus.ACTIVE, iyzicoSubscriptionRef: { not: null } },
    });
    for (const rec of subs) {
      const targetRef = rec.discounted ? price.iyzicoDiscountPlanRef! : price.iyzicoPlanRef!;
      if (rec.iyzicoPricingPlanRef === targetRef) continue;
      const result = await this.iyzico.upgradeSubscription(rec.iyzicoSubscriptionRef!, targetRef);
      if (result.status !== "success") {
        this.logger.error(`Fiyat değişikliği aboneliğe uygulanamadı: recurring=${rec.id} ${result.errorMessage ?? ""}`);
        continue;
      }
      await this.prisma.recurringSubscription.update({
        where: { id: rec.id },
        data: { iyzicoPricingPlanRef: targetRef, iyzicoSubscriptionRef: result.data?.referenceCode ?? rec.iyzicoSubscriptionRef },
      });
      const last = await this.prisma.subscription.findFirst({
        where: { recurringId: rec.id, status: SubscriptionStatus.ACTIVE },
        orderBy: { expiresAt: "desc" },
        select: { expiresAt: true },
      });
      if (last?.expiresAt) {
        await this.notifications
          .notifyRenewalPrice(rec.userId, last.expiresAt, (rec.discounted ? price.webDiscountKurus : price.webKurus) / 100)
          .catch(() => undefined);
      }
    }
  }
}
