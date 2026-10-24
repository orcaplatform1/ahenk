import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MeetingStatus, ParticipantStatus } from "@prisma/client";

// Sohbet penceresi: masanın kendi buluşma günü 10:00–20:00 TR (UTC+3 sabit offset)
function chatWindow(scheduledAt: Date): { openAt: Date; closeAt: Date } {
  const TR = 3 * 3600_000;
  const dayTR = new Date(scheduledAt.getTime() + TR);
  dayTR.setUTCHours(10, 0, 0, 0);
  const openAt = new Date(dayTR.getTime() - TR);
  dayTR.setUTCHours(20, 0, 0, 0);
  const closeAt = new Date(dayTR.getTime() - TR);
  return { openAt, closeAt };
}

// Sohbette e-posta, telefon numarası ve link paylaşımı yasak
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/i;
const PHONE_RE = /(?:\d[\s\-.()]*){10,}/;
const LINK_RE = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|tr|io|co|me|info|biz|app|dev|xyz|link|ly)\b)/i;

function containsContactInfo(content: string): boolean {
  return EMAIL_RE.test(content) || PHONE_RE.test(content) || LINK_RE.test(content);
}

const CHAT_STATUSES: MeetingStatus[] = [MeetingStatus.PENDING, MeetingStatus.ACTIVE];

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
    if (!CHAT_STATUSES.includes(meeting.status)) {
      throw new ForbiddenException("Sohbet sadece aktif masalarda açıktır");
    }

    const { openAt, closeAt } = chatWindow(meeting.scheduledAt);
    const now = new Date();
    const isClosed = now >= closeAt;
    if (now < openAt) {
      return { isOpen: false, isClosed: false, openAt: openAt.toISOString(), closeAt: closeAt.toISOString(), messages: [] };
    }

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
      isOpen: true,
      isClosed,
      openAt: openAt.toISOString(),
      closeAt: closeAt.toISOString(),
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
    if (!CHAT_STATUSES.includes(meeting.status)) {
      throw new ForbiddenException("Sohbet sadece aktif masalarda açıktır");
    }

    const { openAt, closeAt } = chatWindow(meeting.scheduledAt);
    const now = new Date();
    if (now < openAt) {
      throw new ForbiddenException("Sohbet henüz açılmadı");
    }
    if (now >= closeAt) {
      throw new ForbiddenException("Sohbet süresi doldu");
    }

    if (containsContactInfo(content)) {
      throw new BadRequestException("Sohbette e-posta, telefon numarası ve link paylaşılamaz");
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
      senderName: `${m.sender.profile?.firstName ?? ''} ${m.sender.profile?.lastName ?? ''}`.trim() || null,
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
