import { Processor, Process } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { MatchingService } from "./matching.service";
import { MATCHING_QUEUE, JOB_CHECK_DEADLINE } from "./matching.constants";

@Processor(MATCHING_QUEUE)
export class MatchingProcessor {
  private readonly logger = new Logger(MatchingProcessor.name);

  constructor(private matchingService: MatchingService) {}

  @Process(JOB_CHECK_DEADLINE)
  async handleCheckDeadline(job: Job<{ meetingId: string }>): Promise<void> {
    this.logger.log(`Deadline kontrolü: meeting ${job.data.meetingId}`);
    await this.matchingService.checkTableDeadline(job.data.meetingId);
  }
}
