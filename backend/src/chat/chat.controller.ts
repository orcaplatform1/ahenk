import { Controller, Get, Post, Param, Body, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { HideEmailForAdminInterceptor } from "../admin/hide-email.interceptor";
import { Request } from "express";
import { ChatService } from "./chat.service";
import { SendMessageDto } from "./dto/chat.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@Controller("chat")
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get(":meetingId/messages")
  getMessages(@Param("meetingId") meetingId: string, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.chatService.getMessages(meetingId, user.id);
  }

  @Post(":meetingId/messages")
  sendMessage(
    @Param("meetingId") meetingId: string,
    @Body() dto: SendMessageDto,
    @Req() req: Request,
  ) {
    const user = req.user as { id: string };
    return this.chatService.sendMessage(meetingId, user.id, dto.content);
  }

  @Post("messages/:messageId/report")
  reportMessage(@Param("messageId") messageId: string, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.chatService.reportMessage(messageId, user.id);
  }

  @Get("admin/reports/list")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "SUPERADMIN")
  @UseInterceptors(HideEmailForAdminInterceptor)
  adminGetReports() {
    return this.chatService.adminGetReports();
  }

  @Get("admin/:meetingId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "SUPERADMIN")
  @UseInterceptors(HideEmailForAdminInterceptor)
  adminGetMessages(@Param("meetingId") meetingId: string) {
    return this.chatService.adminGetMessages(meetingId);
  }
}
