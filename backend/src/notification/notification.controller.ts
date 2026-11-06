import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { Request } from "express";
import { NotificationService } from "./notification.service";
import { RegisterTokenDto } from "./dto/register-token.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  // FCM cihaz token'ı kaydet/güncelle
  @Post("token")
  registerToken(@Req() req: Request, @Body() dto: RegisterTokenDto) {
    const user = req.user as { id: string };
    return this.notificationService.registerFcmToken(user.id, dto.token);
  }

  // Bildirim listesi (sadece IN_APP tipi, sayfalı)
  @Get()
  getNotifications(
    @Req() req: Request,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const user = req.user as { id: string };
    return this.notificationService.getNotifications(user.id, page, Math.min(limit, 50));
  }

  // Tekil bildirimi okundu işaretle
  @Patch(":id/read")
  markRead(@Req() req: Request, @Param("id") id: string) {
    const user = req.user as { id: string };
    return this.notificationService.markRead(user.id, id);
  }

  // Tümünü okundu işaretle
  @Patch("read-all")
  markAllRead(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.notificationService.markAllRead(user.id);
  }
}
