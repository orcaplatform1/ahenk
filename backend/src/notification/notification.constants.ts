export const NOTIFICATION_EVENTS = {
  KYC_APPROVED: "KYC_APPROVED",
  KYC_REJECTED: "KYC_REJECTED",
  MEETING_CONFIRMED: "MEETING_CONFIRMED",
  SUBSCRIPTION_EXPIRING: "SUBSCRIPTION_EXPIRING",
} as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

// Kaç gün kala abonelik hatırlatması gönderilir
export const SUBSCRIPTION_REMINDER_DAYS = 3;
