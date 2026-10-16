import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MeetingStatus, MeetingType, ParticipantStatus } from "@prisma/client";

function chatCloseTime(type: MeetingType, scheduledAt: Date): Date {
  const sat = new Date(scheduledAt);
  // GROUP: Cumartesi 23:59 TR = Cumartesi 20:59 UTC
  // ONE_ON_ONE: Cuma 23:59 TR = Cuma 20:59 UTC
  if (type === MeetingType.GROUP) {
    const day = sat.getUTCDay();
    const daysUntilSat = (6 - day + 7) % 7;
    sat.setUTCDate(sat.getUTCDate() + daysUntilSat);
    sat.setUTCHours(20, 59, 0, 0);
    return sat;
  } else {
    // Cuma 23:59 TR
    const fri = new Date(scheduledAt);
    const day = fri.getUTCDay();
    const daysUntilFri = (5 - day + 7) % 7;
    fri.setUTCDate(fri.getUTCDate() + daysUntilFri);
    fri.setUTCHours(20, 59, 0, 0);
    return fri;
  }
}

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  private async assertParticipant(meetingId: string, userId: string) {
    const p = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId } },
    });
    if (!p || p.status === ParticipantStatus.CANCELLED) {
      throw new ForbiddenException("Bu masanın aktif katılımcısı değilsiniz");
    }
    return p;
  }

  async getMessages(meetingId: string, userId: string) {
    await this.assertParticipant(meetingId, userId);

    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { status: true, type: true, scheduledAt: true },
    });
    if (!meeting) throw new NotFoundException("Masa bulunamadı");
    if (meeting.status !== MeetingStatus.ACTIVE) {
      throw new ForbiddenException("Sohbet sadece aktif masalarda açıktır");
    }

    const closeTime = chatCloseTime(meeting.type, meeting.scheduledAt);
    const now = new Date();
    const isClosed = now >= closeTime;

    const messages = await this.prisma.chatMessage.findMany({
      where: { meetingId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        senderId: true,
        sender: {
          select: {
            profile: { select: { firstName: true, lastName: true } },
          },
        },
        reports: { select: { reporterId: true } },
      },
    });

    return {
      isClosed,
      closeAt: closeTime.toISOString(),
      messages: messages.map((m) => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt,
        isOwn: m.senderId === userId,
        senderInitials: `${m.sender.profile?.firstName?.[0] ?? '?'}.${m.sender.profile?.lastName?.[0] ?? '?'}.`,
        reportedByMe: m.reports.some((r) => r.reporterId === userId),
      })),
    };
  }

  async sendMessage(meetingId: string, userId: string, content: string) {
    await this.assertParticipant(meetingId, userId);

    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { status: true, type: true, scheduledAt: true },
    });
    if (!meeting) throw new NotFoundException("Masa bulunamadı");
    if (meeting.status !== MeetingStatus.ACTIVE) {
      throw new ForbiddenException("Sohbet sadece aktif masalarda açıktır");
    }

    const closeTime = chatCloseTime(meeting.type, meeting.scheduledAt);
    if (new Date() >= closeTime) {
      throw new ForbiddenException("Sohbet süresi doldu");
    }

    const message = await this.prisma.chatMessage.create({
      data: { meetingId, senderId: userId, content },
      select: {
        id: true,
        content: true,
        createdAt: true,
        sender: {
          select: {
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      isOwn: true,
      senderInitials: `${message.sender.profile?.firstName?.[0] ?? '?'}.${message.sender.profile?.lastName?.[0] ?? '?'}.`,
      reportedByMe: false,
    };
  }

  async reportMessage(messageId: string, reporterId: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { meetingId: true, senderId: true },
    });
    if (!message) throw new NotFoundException("Mesaj bulunamadı");
    if (message.senderId === reporterId) {
      throw new BadRequestException("Kendi mesajınızı şikayet edemezsiniz");
    }

    await this.assertParticipant(message.meetingId, reporterId);

    await this.prisma.chatReport.upsert({
      where: { messageId_reporterId: { messageId, reporterId } },
      update: {},
      create: { messageId, reporterId },
    });

    return { reported: true };
  }

  // Admin: sohbet geçmişi (silinmiş dahil)
  async adminGetMessages(meetingId: string) {
    const messages = await this.prisma.chatMessage.findMany({
      where: { meetingId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        deletedAt: true,
        senderId: true,
        sender: {
          select: {
            profile: { select: { firstName: true, lastName: true } },
          },
        },
        reports: {
          select: {
            reporterId: true,
            createdAt: true,
            reporter: {
              select: { profile: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
    });

    return messages.map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt,
      deletedAt: m.deletedAt,
      senderInitials: `${m.sender.profile?.firstName?.[0] ?? '?'}.${m.sender.profile?.lastName?.[0] ?? '?'}.`,
      senderId: m.senderId,
      reportCount: m.reports.length,
      reports: m.reports.map((r) => ({
        reporterId: r.reporterId,
        reporterInitials: `${r.reporter.profile?.firstName?.[0] ?? '?'}.${r.reporter.profile?.lastName?.[0] ?? '?'}.`,
        createdAt: r.createdAt,
      })),
    }));
  }

  // Admin: tüm şikayetler
  async adminGetReports() {
    const reports = await this.prisma.chatReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        messageId: true,
        message: {
          select: {
            content: true,
            meetingId: true,
            sender: {
              select: { profile: { select: { firstName: true, lastName: true } } },
            },
          },
        },
        reporter: {
          select: { profile: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    return reports.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      messageId: r.messageId,
      meetingId: r.message.meetingId,
      messageContent: r.message.content,
      senderInitials: `${r.message.sender.profile?.firstName?.[0] ?? '?'}.${r.message.sender.profile?.lastName?.[0] ?? '?'}.`,
      reporterInitials: `${r.reporter.profile?.firstName?.[0] ?? '?'}.${r.reporter.profile?.lastName?.[0] ?? '?'}.`,
    }));
  }
}
