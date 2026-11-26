// Admin menü bildirim baloncukları: bekleyen / okunmamış iş sayıları (menü yolu → sayı). Web ve mobil admin menüsü sayfa açılınca ve
// 60 sn'de bir okur. Sayı 0 ise baloncuk gösterilmez, 99'dan fazlası "99+".
//   /admin/acil-yardim          açık Acil Yardım talepleri (SosReport.resolvedAt boş)
//   /admin/kyc                  onay bekleyen KYC başvuruları (KycSubmission PENDING)
//   /admin/profil-fotograflari  onay bekleyen profil fotoğrafları (ProfilePhoto PENDING)
//   /admin/users                onay bekleyen hesap silme talepleri (AccountDeletionRequest PENDING)
//   /admin/alerts               okunmamış uyarılar (Uyarılar sayfasıyla aynı rol filtresi)
//   /admin/ekran-goruntusu      karar bekleyen ekran görüntüsü ihlalleri (2. ve sonraki ihlal, adminAction boş)
//   /admin/quality              karar verilmemiş sohbet şikâyetleri ve otomatik engeller (ChatReport.decision boş)
//   /admin/sonuclandirma        sonuçlandırma bekleyen mükerrer ödemeler (Payment DUPLICATE; yalnız SUPERADMIN)
//   /admin/partnerships         bekleyen iş ortaklığı başvuruları (PENDING; yalnız SUPERADMIN)
//   /admin/careers              bekleyen kariyer başvuruları (PENDING; yalnız SUPERADMIN)
//   /admin/canli-destek         sırada bekleyen canlı destek sohbetleri (SupportChat QUEUED)
import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Request } from "express";
import { AdminAlertType, CareerStatus, SupportChatStatus, DeletionRequestStatus, KycStatus, PartnershipStatus, PaymentStatus, ProfilePhotoStatus, UserRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@SkipThrottle()
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
export class AdminMenuCountsController {
  constructor(private prisma: PrismaService) {}

  @Get("menu-counts")
  async counts(@Req() req: Request): Promise<Record<string, number>> {
    const userId = (req.user as { id: string }).id;
    const role = (await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }))?.role;
    const superadmin = role === UserRole.SUPERADMIN;
    const p = this.prisma;
    const [sos, kyc, photos, deletions, alerts, shots, reports, settlements, partnerships, careers, supportQueue] = await Promise.all([
      p.sosReport.count({ where: { resolvedAt: null } }),
      p.kycSubmission.count({ where: { status: KycStatus.PENDING } }),
      p.profilePhoto.count({ where: { status: ProfilePhotoStatus.PENDING } }),
      p.accountDeletionRequest.count({ where: { status: DeletionRequestStatus.PENDING } }),
      p.adminAlert.count({ where: { isRead: false, ...(superadmin ? {} : { alertType: { notIn: [AdminAlertType.BOT_NOT_FOUND, AdminAlertType.BOT_ASSIGNED] } }) } }),
      p.screenshotLog.findMany({ select: { userId: true, adminAction: true }, orderBy: { createdAt: "asc" } }),
      p.chatReport.count({ where: { decision: null } }),
      superadmin ? p.payment.count({ where: { status: PaymentStatus.DUPLICATE } }) : Promise.resolve(0),
      superadmin ? p.partnershipApplication.count({ where: { status: PartnershipStatus.PENDING } }) : Promise.resolve(0),
      superadmin ? p.careerApplication.count({ where: { status: CareerStatus.PENDING } }) : Promise.resolve(0),
      p.supportChat.count({ where: { status: SupportChatStatus.QUEUED } }),
    ]);
    // Ekran görüntüsü: 1. ihlalde işlem yok; 2. ve sonraki ihlallerden karar verilmemiş olanlar
    const seen = new Map<string, number>();
    let shotPending = 0;
    for (const s of shots) {
      const n = (seen.get(s.userId) ?? 0) + 1;
      seen.set(s.userId, n);
      if (n > 1 && !s.adminAction) shotPending++;
    }
    return {
      "/admin/acil-yardim": sos,
      "/admin/kyc": kyc,
      "/admin/profil-fotograflari": photos,
      "/admin/users": deletions,
      "/admin/alerts": alerts,
      "/admin/ekran-goruntusu": shotPending,
      "/admin/quality": reports,
      "/admin/sonuclandirma": settlements,
      "/admin/partnerships": partnerships,
      "/admin/careers": careers,
      "/admin/canli-destek": supportQueue,
    };
  }
}
