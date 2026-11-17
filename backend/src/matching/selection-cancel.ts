import { ForbiddenException } from "@nestjs/common";
import { Queue } from "bull";
import { LeaveReason, MeetingMode, MeetingStatus, MeetingType, ParticipantStatus, Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notification/notification.service";
import { cancellationNotice, initialsOf } from "../meetings/cancellation-notice";
import { meetingLockAt, tomorrowMeetingAt } from "../meetings/meeting-windows";
import { activeKankaLink } from "../kanka/kanka-links";
import { restoreOneOnOneRights } from "./one-on-one-right";
import { enqueueAssign } from "./assign-queue";

const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const LEFT: ParticipantStatus[] = [ParticipantStatus.CANCELLED, ParticipantStatus.DECLINED, ParticipantStatus.NO_SHOW];

// Planlı son seçim saatleri (TR): Grup Perşembe 18:00, Baş Başa Cuma 18:00, Kankamla Cumartesi 18:00.
// Planlı kilit: aynı gün 23:59.
export const SELECTION_DEADLINE: Record<MeetingType, { day: number; minutes: number }> = {
  [MeetingType.GROUP]: { day: 4, minutes: 18 * 60 },
  [MeetingType.ONE_ON_ONE]: { day: 5, minutes: 18 * 60 },
  [MeetingType.KANKA]: { day: 6, minutes: 18 * 60 },
};
const PLANNED_LOCK_MIN = 23 * 60 + 59;

// ISO hafta (TR saati, Pazartesi başlangıç) — matching.service ile aynı hesap
export function trIsoWeekOf(date: Date): { week: number; year: number } {
  const tr = new Date(date.getTime() + TR_OFFSET_MS);
  const d = new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7), year: d.getUTCFullYear() };
}

function weekAt(type: MeetingType, now: Date, minutes: number): Date {
  const tr = new Date(now.getTime() + TR_OFFSET_MS);
  const isoDay = tr.getUTCDay() || 7; // Pazartesi 1 … Pazar 7
  const monday = Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()) - (isoDay - 1) * 86400000;
  return new Date(monday + (SELECTION_DEADLINE[type].day - 1) * 86400000 + minutes * 60000 - TR_OFFSET_MS);
}

// Bu haftanın Planlı son seçim anı (UTC)
export function deadlineOf(type: MeetingType, now = new Date()): Date {
  return weekAt(type, now, SELECTION_DEADLINE[type].minutes);
}

// Bu haftanın Planlı kilit anı (UTC): son seçim gününün 23:59'u
export function plannedLockOf(type: MeetingType, now = new Date()): Date {
  return weekAt(type, now, PLANNED_LOCK_MIN);
}

// Planlı kaydın haftası: son saat geçmediyse bu hafta, geçtiyse bir sonraki hafta
export function plannedTargetWeek(type: MeetingType, now = new Date()): { week: number; year: number } {
  return trIsoWeekOf(now < deadlineOf(type, now) ? now : new Date(now.getTime() + 7 * 86400000));
}

// Taramadaki (açık) kayıt: Planlı'da bu hafta kilitten önce ya da gelecek hafta; Yarın'da buluşması 23:59 kilidinden sonra
export function activeSelectionWhere(type: MeetingType, now = new Date()): Prisma.WeeklySelectionWhereInput {
  const cur = trIsoWeekOf(now);
  const next = trIsoWeekOf(new Date(now.getTime() + 7 * 86400000));
  return {
    type,
    OR: [
      ...(now < plannedLockOf(type, now) ? [{ mode: MeetingMode.PLANNED, year: cur.year, weekNumber: cur.week }] : []),
      { mode: MeetingMode.PLANNED, year: next.year, weekNumber: next.week },
      { mode: MeetingMode.TOMORROW, meetingDate: { gte: tomorrowMeetingAt(now) } },
    ],
  };
}

// Havuz sorgularına eklenir: kişi bu hafta bu türü Planlı olarak seçmiş olmalı
export function selectedThisWeek(type: MeetingType, now = new Date()): Prisma.UserWhereInput {
  const { week, year } = trIsoWeekOf(now);
  return { weeklySelections: { some: { year, weekNumber: week, type, mode: MeetingMode.PLANNED } } };
}

// Yarın havuzu: kişi bu buluşma günü için bu türde Yarın talebi vermiş olmalı
export function selectedTomorrow(type: MeetingType, meetingAt: Date): Prisma.UserWhereInput {
  return { weeklySelections: { some: { type, mode: MeetingMode.TOMORROW, meetingDate: meetingAt } } };
}

// Kişinin bu türde oturduğu, henüz yapılmamış masa
export function seatWhere(userId: string, type: MeetingType, now = new Date()): Prisma.MeetingParticipantWhereInput {
  return {
    userId,
    status: { notIn: LEFT },
    meeting: { type, status: { in: [MeetingStatus.PENDING, MeetingStatus.ACTIVE] }, scheduledAt: { gt: now } },
  };
}

export type SelectionDeps = { prisma: PrismaService; notifications: NotificationService; assignQueue: Queue };

// Kilitten önce masadan ayrılma (seçim iptali / buluşma türü değişikliği): kullanım hakkı YANMAZ.
// Kişi yalnız bu seçime ait masa eşleşmesini kaybeder. Kilitlenmiş masada iptal ve değiştirme yok.
async function leaveUnlockedTable(deps: SelectionDeps, userId: string, type: MeetingType, note: string): Promise<void> {
  const { prisma, notifications, assignQueue } = deps;
  const now = new Date();
  const seat = await prisma.meetingParticipant.findFirst({
    where: seatWhere(userId, type, now),
    select: {
      id: true, kankaPartnerId: true,
      meeting: { select: { id: true, mode: true, createdAt: true, scheduledAt: true, participants: { where: { status: { notIn: LEFT } }, select: { userId: true } } } },
    },
  });
  if (!seat) return;
  const meeting = seat.meeting;
  if (now.getTime() >= meetingLockAt(meeting.scheduledAt)) {
    throw new ForbiddenException("Masa kilitlendi; iptal ve değiştirme yapılamaz.");
  }
  const meetingId = meeting.id;
  const left = { status: ParticipantStatus.CANCELLED, leaveReason: LeaveReason.OTHER, leaveNote: note, cancelledAt: now };
  const others = meeting.participants.map((p) => p.userId).filter((id) => id !== userId);

  if (type === MeetingType.GROUP) {
    await prisma.meetingParticipant.update({ where: { id: seat.id }, data: left });
    // Planlı grupta bildirim Perşembe 20:00 özetiyle; Yarın masasında kalanlara hemen
    if (meeting.mode === MeetingMode.TOMORROW) {
      const notice = cancellationNotice();
      for (const id of others) await notifications.sendToUser(id, { ...notice, data: { type: "PARTICIPANT_LEFT", meetingId } }).catch(() => undefined);
    }
    return;
  }

  if (type === MeetingType.ONE_ON_ONE) {
    // Masa tek kişiyle kalmaz: iptal olur; harcanmış baş başa hakları (Planlı'da oturunca harcanır) iki kişiye de geri verilir
    await prisma.$transaction(async (tx) => {
      await tx.meetingParticipant.update({ where: { id: seat.id }, data: left });
      await tx.meeting.update({ where: { id: meetingId }, data: { status: MeetingStatus.CANCELLED, cancelledAt: now } });
      await restoreOneOnOneRights(tx, meeting.createdAt, [userId, ...others]);
    });
    const notice = cancellationNotice();
    for (const id of others) {
      await notifications.sendToUser(id, { ...notice, data: { type: "PARTICIPANT_LEFT", meetingId } }).catch(() => undefined);
      await enqueueAssign(assignQueue, id);
    }
    return;
  }

  // Kankamla: kişi kankasıyla birlikte düşer, masa iptal olur; karşı çift yeniden taramaya girer (hak düşmez)
  const kankaId = seat.kankaPartnerId;
  const pairIds = [userId, ...(kankaId ? [kankaId] : [])];
  const otherIds = others.filter((id) => !pairIds.includes(id));
  await prisma.$transaction([
    prisma.meetingParticipant.updateMany({ where: { meetingId, userId: { in: pairIds } }, data: left }),
    prisma.meeting.update({ where: { id: meetingId }, data: { status: MeetingStatus.CANCELLED, cancelledAt: now } }),
  ]);
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { profile: { select: { firstName: true, lastName: true } } } });
  if (kankaId) {
    await notifications.sendToUser(kankaId, {
      title: "Kankamla rezervasyonu iptal edildi",
      body: `Kankan ${initialsOf(me?.profile)} Kankamla rezervasyonunuzu iptal etti.`,
      data: { type: "KANKA_CANCELLED", meetingId },
      en: { title: "Bring a Buddy booking cancelled", body: `Your Kanka ${initialsOf(me?.profile)} cancelled your Bring a Buddy booking.` },
    }).catch(() => undefined);
  }
  for (const id of otherIds) {
    await notifications.sendToUser(id, {
      title: "Karşı çift masadan ayrıldı",
      body: "Kankamla masanızdaki karşı çift ayrıldı. Sizin için yeniden eşleşme aranıyor.",
      data: { type: "KANKA_PAIR_LEFT", meetingId },
      en: { title: "The other pair left the table", body: "The other pair at your Bring a Buddy table left. We're looking for a new match for you." },
    }).catch(() => undefined);
    await enqueueAssign(assignQueue, id);
  }
}

// Seçimi iptal: kilitten önce masadan ayrılır (hak yanmaz) ve bu türdeki açık kayıt silinir.
// Kankamla: kanka davet edenin kaydını izler; çiftin ikisinin de bu türdeki açık kaydı silinir.
export async function cancelSelection(deps: SelectionDeps, userId: string, type: MeetingType, note: string): Promise<void> {
  await leaveUnlockedTable(deps, userId, type, note);
  const link = type === MeetingType.KANKA ? await activeKankaLink(deps.prisma, userId) : null;
  const ids = [userId, ...(link ? [link.kankaId] : [])];
  await deps.prisma.weeklySelection.deleteMany({ where: { userId: { in: ids }, ...activeSelectionWhere(type) } });
}
