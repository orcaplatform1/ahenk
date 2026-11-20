import { seatNumbers, tableDisplayNames } from "../meetings/table-initials";
import { approvedPhotoMap } from "../profile-photo/profile-photo.util";
import { checkMessage, haikuIsViolation } from "./chat-moderation";
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ChatReportReason, MeetingStatus, ParticipantStatus } from "../generated/prisma/client";

// Sohbet penceresi (bütün masa türleri, Planlı ve Yarın aynı): açılış masa detay kartıyla aynı an, buluşma günü 10:00 TR
// (Grup Cuma, Baş Başa Cumartesi, Kankamla Pazar; Yarın'da masanın kurulduğu günün ertesi günü); kapanış buluşma günü 22:00 TR
// (UTC+3 sabit offset). Kapanış her zaman masanın kendi buluşma gününe göre hesaplanır (elle kurulan masalar dahil).
function chatWindow(scheduledAt: Date): { openAt: Date; closeAt: Date } {
  const TR = 3 * 3600_000;
  const dayTR = new Date(scheduledAt.getTime() + TR);
  dayTR.setUTCHours(10, 0, 0, 0);
  const openAt = new Date(dayTR.getTime() - TR);
  const closeAt = new Date(openAt.getTime() + 12 * 3600_000);
  return { openAt, closeAt };
}

// Otomatik engel uyarısı (gönderene) ve Haiku'ya ulaşılamadığında gösterilen metin (errors.chatBlocked / errors.chatSendFailed)
const BLOCKED_MSG = "Yapay zekâ bu mesajda kural ihlali tespit etti. Telefon numarası, sosyal medya hesabı ve link paylaşımı yasaktır. Mesajın gönderilmedi ve yöneticilere bildirildi. Tekrarlanması halinde masadan çıkarılırsın ve kullanım hakkın yanar.";
const SEND_FAILED_MSG = "Mesajın gönderilemedi, tekrar dene.";

const CHAT_STATUSES: MeetingStatus[] = [MeetingStatus.PENDING, MeetingStatus.ACTIVE];

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  constructor(private prisma: PrismaService) {}

  private async assertParticipant(meetingId: string, userId: string) {
    const p = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId } },
    });
    const inactive: ParticipantStatus[] = [ParticipantStatus.CANCELLED, ParticipantStatus.DECLINED, ParticipantStatus.NO_SHOW];
    if (!p || inactive.includes(p.status)) {
      throw new ForbiddenException("Bu masanın aktif katılımcısı değilsin");
    }
    return p;
  }

  // Masa içi görünen ad ("Ahmet Y.", çakışmada "Ahmet Y.²") ve sandalye no: masanın tüm katılımcıları (iptal edenler dahil),
  // katılım sırasına göre. Sohbet masa detay kartıyla aynı anda (buluşma günü 10:00) açıldığı için görünen ad gönderilir.
  private async tableBadges(meetingId: string) {
    const rows = await this.prisma.meetingParticipant.findMany({
      where: { meetingId },
      select: { userId: true, createdAt: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
    });
    const people = rows.map((r) => ({ userId: r.userId, createdAt: r.createdAt, profile: r.user.profile }));
    return { names: tableDisplayNames(people), seats: seatNumbers(people) };
  }

  async getMessages(meetingId: string, userId: string) {
    await this.assertParticipant(meetingId, userId);

    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { status: true, scheduledAt: true },
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
      where: { meetingId, deletedAt: null, blockedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        senderId: true,
        sender: {
          select: {
            profile: { select: { firstName: true, lastName: true, gender: true } },
          },
        },
        reports: { select: { reporterId: true } },
      },
    });

    const { names, seats } = await this.tableBadges(meetingId);
    const photos = await approvedPhotoMap(this.prisma, messages.map((m) => m.senderId));
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
        senderName: names.get(m.senderId) ?? '?',
        seatNo: seats.get(m.senderId) ?? null, // Masaya özel anonim sandalye no (gerçek kimlik gönderilmez)
        senderGender: m.sender.profile?.gender ?? null,
        senderPhotoUrl: photos.get(m.senderId) ?? null, // Onaylı profil fotoğrafı; yoksa istemci baş harf gösterir
        reportedByMe: m.reports.some((r) => r.reporterId === userId),
      })),
    };
  }

  async sendMessage(meetingId: string, userId: string, content: string) {
    await this.assertParticipant(meetingId, userId);

    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { status: true, scheduledAt: true },
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

    // Otomatik engel: 7+ rakam ya da link → anında engel; şüpheli kelime → Haiku (ulaşılamazsa iletilmez)
    const verdict = checkMessage(content);
    let blocked = verdict === "BLOCK";
    if (verdict === "SUSPECT") {
      try {
        blocked = await haikuIsViolation(content);
      } catch (err) {
        this.logger.warn(`Sohbet denetimi yapılamadı (masa ${meetingId}): ${err}`);
        throw new BadRequestException(SEND_FAILED_MSG);
      }
    }
    if (blocked) {
      // Karşı tarafa iletilmez; admin Şikâyetler'e "Otomatik engel" kaydı
      const stored = await this.prisma.chatMessage.create({
        data: { meetingId, senderId: userId, content, blockedAt: new Date() },
        select: { id: true },
      });
      await this.prisma.chatReport.create({ data: { messageId: stored.id, auto: true, reason: ChatReportReason.CONTACT_SHARE } });
      throw new BadRequestException(BLOCKED_MSG);
    }

    const message = await this.prisma.chatMessage.create({
      data: { meetingId, senderId: userId, content },
      select: {
        id: true,
        content: true,
        createdAt: true,
        sender: {
          select: {
            profile: { select: { firstName: true, lastName: true, gender: true } },
          },
        },
      },
    });

    const { names, seats } = await this.tableBadges(meetingId);
    const photos = await approvedPhotoMap(this.prisma, [userId]);
    return {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      isOwn: true,
      senderName: names.get(userId) ?? '?',
      seatNo: seats.get(userId) ?? null,
      senderGender: message.sender.profile?.gender ?? null,
      senderPhotoUrl: photos.get(userId) ?? null,
      reportedByMe: false,
    };
  }

  // Şikâyet: neden zorunlu ("Diğer"de açıklama zorunlu); aynı mesaj kişi başına bir kez; şikâyet edilene bildirim gitmez
  async reportMessage(messageId: string, reporterId: string, reason: ChatReportReason, note?: string) {
    if (reason === ChatReportReason.OTHER && !note?.trim()) throw new BadRequestException("Açıklama yazmalısın.");
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { meetingId: true, senderId: true },
    });
    if (!message) throw new NotFoundException("Mesaj bulunamadı");
    if (message.senderId === reporterId) {
      throw new BadRequestException("Kendi mesajını şikayet edemezsin");
    }

    await this.assertParticipant(message.meetingId, reporterId);

    const exists = await this.prisma.chatReport.findUnique({ where: { messageId_reporterId: { messageId, reporterId } }, select: { id: true } });
    if (exists) throw new ConflictException("Bu mesajı zaten şikâyet ettin.");
    await this.prisma.chatReport.create({
      data: { messageId, reporterId, reason, note: reason === ChatReportReason.OTHER ? note!.trim().slice(0, 1000) : null },
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
        blockedAt: true,
        senderId: true,
        sender: {
          select: {
            isBot: true,
            profile: { select: { firstName: true, lastName: true, gender: true } },
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

    const photos = await approvedPhotoMap(this.prisma, messages.map((m) => m.senderId));
    return messages.map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt,
      deletedAt: m.deletedAt,
      blockedAt: m.blockedAt, // Otomatik engel: kullanıcılara iletilmedi
      senderPhotoUrl: photos.get(m.senderId) ?? null,
      senderInitials: `${m.sender.profile?.firstName?.[0] ?? '?'}.${m.sender.profile?.lastName?.[0] ?? '?'}.`,
      senderName: `${m.sender.profile?.firstName ?? ''} ${m.sender.profile?.lastName ?? ''}`.trim() || null,
      senderId: m.senderId,
      senderIsBot: m.sender.isBot,
      reportCount: m.reports.length,
      reports: m.reports.map((r) => ({
        reporterId: r.reporterId,
        reporterInitials: r.reporter ? `${r.reporter.profile?.firstName?.[0] ?? '?'}.${r.reporter.profile?.lastName?.[0] ?? '?'}.` : null,
        createdAt: r.createdAt,
      })),
    }));
  }
}
