import { Processor, Process } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { MatchingService } from "./matching.service";
import { PrismaService } from "../prisma/prisma.service";
import { isMatchingEnabled } from "../admin/app-settings";
import { ASSIGN_QUEUE, JOB_ASSIGN_USER, JOB_SCAN_POOL, JOB_GROUP_BOTS, JOB_ONE_ON_ONE_BOT, JOB_TOMORROW_LOCK } from "./assign-queue";

@Processor(ASSIGN_QUEUE)
export class AssignProcessor {
  private readonly logger = new Logger(AssignProcessor.name);

  constructor(private matchingService: MatchingService, private prisma: PrismaService) {}

  // Tek işleyici, eşzamanlılık 1: işler sırayla çalışır
  @Process({ name: "*", concurrency: 1 })
  async handle(job: Job) {
    try {
      // "Eşleştirme Aktif" kapalıysa atama, tarama ve bot işleri hiçbir işlem yapmadan çıkar
      if (!(await isMatchingEnabled(this.prisma))) return;
      switch (job.name) {
        case JOB_ASSIGN_USER:
          return await this.matchingService.assignUser(job.data.userId);
        case JOB_SCAN_POOL:
          return await this.matchingService.scanPool();
        case JOB_GROUP_BOTS:
          return await this.matchingService.addGroupBots(job.data.meetingId);
        case JOB_ONE_ON_ONE_BOT:
          return await this.matchingService.addOneOnOneBot(job.data.userId);
        case JOB_TOMORROW_LOCK:
          return await this.matchingService.runTomorrowLock();
      }
    } catch (err) {
      this.logger.error(`Atama işi hatası (${job.name}): ${err}`);
      throw err;
    }
  }
}
