import { Processor, Process } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { PrismaService } from "../prisma/prisma.service";
import { isBotSystemActive } from "../admin/app-settings";
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
    if (!(await isBotSystemActive(this.prisma))) {
      this.logger.log(`Bot sistemi kapalı, bot eklenmedi: masa ${meetingId}`);
      return;
    }
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

    // Grup masasında cinsiyet dengesi her zaman hesapla (iptal edenin cinsiyetine bakma)
    let targetGender: Gender | null = null;
    if (meeting.type === MeetingType.GROUP) {
      const maleCount   = meeting.participants.filter((p) => p.user.profile?.gender === Gender.MALE).length;
      const femaleCount = meeting.participants.filter((p) => p.user.profile?.gender === Gender.FEMALE).length;
      targetGender = maleCount <= femaleCount ? Gender.MALE : Gender.FEMALE;
    }
    // ONE_ON_ONE: iptal edenin cinsiyetiyle aynı cinsiyet (MALE/FEMALE ise; OTHER/PREFER için null)
    if (meeting.type !== MeetingType.GROUP) {
      targetGender = (missingGender === Gender.MALE || missingGender === Gender.FEMALE) ? missingGender : null;
    }

    // Uygun botu bul (masada olmayan, aktif bot)
    const existingUserIds = meeting.participants.map((p) => p.userId);

    const botWhere: any = {
      isBot: true,
      status: "ACTIVE",
      id: { notIn: existingUserIds },
    };
    // Profile'sız botları dışlamak için: profile is relation filter
    if (targetGender === Gender.MALE || targetGender === Gender.FEMALE) {
      botWhere.profile = { is: { gender: targetGender } };
    }

    let bot = await this.prisma.user.findFirst({
      where: botWhere,
      include: { profile: true },
    });

    // Profile'sız veya yanlış cinsiyetli bot yoksa herhangi biri dene
    if (!bot && (targetGender === Gender.MALE || targetGender === Gender.FEMALE)) {
      bot = await this.prisma.user.findFirst({
        where: { isBot: true, status: "ACTIVE", id: { notIn: existingUserIds } },
        include: { profile: true },
      });
    }

    if (!bot) {
      this.logger.warn(`Uygun bot bulunamadı: masa ${meetingId}, cinsiyet ${targetGender ?? "herhangi"}`);
      return;
    }

    // Transaction: kapasite kontrolü + ekleme atomik
    await this.prisma.$transaction(async (tx) => {
      const currentCount = await tx.meetingParticipant.count({
        where: { meetingId, status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } },
      });
      if (currentCount >= maxCount) {
        this.logger.log(`Race condition engellendi: masa ${meetingId} dolu (${currentCount}/${maxCount})`);
        return;
      }
      await tx.meetingParticipant.create({
        data: { meetingId, userId: bot.id, status: "ACCEPTED" },
      });
    });

    const name = bot.profile ? `${bot.profile.firstName} ${bot.profile.lastName}` : bot.id;
    this.logger.log(`Bot eklendi: ${name} → masa ${meetingId}`);
  }
}
