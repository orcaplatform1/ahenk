import { Controller, Get, Post, Delete, Param, Body, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { ContactBlocksService } from "./contact-blocks.service";
import { SyncContactBlocksDto } from "./dto/contact-blocks.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("contact-blocks")
@UseGuards(JwtAuthGuard)
export class ContactBlocksController {
  constructor(private service: ContactBlocksService) {}

  @Get()
  list(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.service.list(user.id);
  }

  @Post("sync")
  sync(@Req() req: Request, @Body() dto: SyncContactBlocksDto) {
    const user = req.user as { id: string };
    return this.service.sync(user.id, dto.hashedPhones);
  }

  @Delete(":id")
  remove(@Req() req: Request, @Param("id") id: string) {
    const user = req.user as { id: string };
    return this.service.remove(user.id, id);
  }
}
