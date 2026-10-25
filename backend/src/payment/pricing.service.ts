import { BadRequestException, Injectable } from "@nestjs/common";
import { PlanPrice, SubscriptionPlan } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PLAN_CONFIG } from "./payment.constants";
import { computePrices } from "./pricing";

const PLANS = [SubscriptionPlan.MASADA, SubscriptionPlan.KARSIMDA, SubscriptionPlan.ICERDE, SubscriptionPlan.KANKAMLA];

@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

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
          plan, name: PLAN_CONFIG[plan].nametr,
          netKurus: r.netKurus, webKurus: r.webKurus, mobileKurus: r.mobileKurus,
          webDiscountKurus: r.webDiscountKurus, mobileDiscountKurus: r.mobileDiscountKurus, updatedAt: r.createdAt,
        };
      }),
      history,
    };
  }

  // Onaylanan ham fiyatlar: değişen paket için yeni fiyat kaydı (geçmiş tutulur). Tek seferlik paketler
  // olduğu için yeni fiyat sadece bundan sonraki satın almalarda geçerli.
  async updatePrices(changes: { plan: SubscriptionPlan; netKurus: number }[], adminId: string) {
    const current = await this.all();
    const changed = changes.filter((c) => c.netKurus !== current[c.plan].netKurus);
    if (changed.length === 0) return this.listForAdmin();

    await this.prisma.$transaction(changed.map((c) =>
      this.prisma.planPrice.create({ data: { plan: c.plan, ...computePrices(c.netKurus), createdById: adminId } })));
    return this.listForAdmin();
  }
}
