import { Processor, Process } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { PrismaService } from "../prisma/prisma.service";
import { Gender, MeetingType } from "@prisma/client";

export const BOT_FILL_QUEUE = "bot-fill";
export const JOB_FILL_SPOT  = "fill-spot";

interface FillSpotData {
  meetingId: string;
  missingGender: Gender | null;
}

@Processor(BOT_FILL_QUEUE)
export class BotFillProcessor {
  private readonly logger = new Logger(BotFillProcessor.name);

  constructor(private prisma: PrismaService) {}

  @Process(JOB_FILL_SPOT)
  async handleFillSpot(job: Job<FillSpotData>) {
    const { meetingId, missingGender } = job.data;
    this.logger.log(`Bot doldurma kontrolü: masa ${meetingId}, cinsiyet ${missingGender ?? "herhangi"}`);

    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: {
          where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } },
          include: { user: { include: { profile: true } } },
        },
      },
    });

    if (!meeting) return;
    if (meeting.status !== "PENDING" && meeting.status !== "ACTIVE") return;

    const activeCount = meeting.participants.length;
    const maxCount    = meeting.maxParticipants;

    if (activeCount >= maxCount) {
      this.logger.log(`Masa ${meetingId} dolu (${activeCount}/${maxCount}), bot eklenmeyecek`);
      return;
    }

    // Eklenecek cinsiyet
    let targetGender = missingGender;

    // Grup masasında denge: 3E+3K
    if (meeting.type === MeetingType.GROUP && targetGender === null) {
      const maleCount   = meeting.participants.filter((p) => p.user.profile?.gender === Gender.MALE).length;
      const femaleCount = meeting.participants.filter((p) => p.user.profile?.gender === Gender.FEMALE).length;
      targetGender = maleCount <= femaleCount ? Gender.MALE : Gender.FEMALE;
    }

    // Uygun botu bul (masada olmayan, aktif bot)
    const existingUserIds = meeting.participants.map((p) => p.userId);

    const botQuery: any = {
      isBot: true,
      status: "ACTIVE",
      id: { notIn: existingUserIds },
    };

    if (targetGender === Gender.MALE || targetGender === Gender.FEMALE) {
      botQuery.profile = { gender: targetGender };
    }

    const bot = await this.prisma.user.findFirst({
      where: botQuery,
      include: { profile: true },
    });

    if (!bot) {
      this.logger.warn(`Uygun bot bulunamadı: masa ${meetingId}, cinsiyet ${targetGender ?? "herhangi"}`);
      return;
    }

    await this.prisma.meetingParticipant.create({
      data: {
        meetingId,
        userId: bot.id,
        status: "ACCEPTED",
      },
    });

    const name = bot.profile ? `${bot.profile.firstName} ${bot.profile.lastName}` : bot.id;
    this.logger.log(`Bot eklendi: ${name} → masa ${meetingId}`);
  }
}
