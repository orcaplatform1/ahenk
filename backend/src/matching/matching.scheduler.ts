import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { MATCHING_QUEUE, JOB_RUN_MATCHING } from "./matching.constants";

@Injectable()
export class MatchingScheduler {
  private readonly logger = new Logger(MatchingScheduler.name);

  constructor(@InjectQueue(MATCHING_QUEUE) private matchingQueue: Queue) {}

  // Her Perşembe 23:59 (UTC+3 = 20:59 UTC)
  @Cron("59 20 * * 4", { timeZone: "Europe/Istanbul" })
  async scheduleWeeklyMatching(): Promise<void> {
    this.logger.log("Haftalık eşleştirme kuyruğa eklendi (Perşembe 23:59)");
    await this.matchingQueue.add(
      JOB_RUN_MATCHING,
      {},
      { jobId: `weekly-matching-${new Date().toISOString().slice(0, 10)}` },
    );
  }
}
