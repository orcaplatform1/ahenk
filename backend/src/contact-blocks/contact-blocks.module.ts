import { Module } from "@nestjs/common";
import { ContactBlocksController } from "./contact-blocks.controller";
import { ContactBlocksService } from "./contact-blocks.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [ContactBlocksController],
  providers: [ContactBlocksService],
  exports: [ContactBlocksService],
})
export class ContactBlocksModule {}
