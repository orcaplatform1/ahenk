import { Queue } from "bull";

// Gerçek zamanlı masa ataması: tüm atama ve kapanış botu işleri bu kuyrukta TEK TEK çalışır
// (aynı koltuğa / aynı kişiye iki kez atama olmaz). Diğer modüller kuyruğu kaydedip sadece iş ekler.
export const ASSIGN_QUEUE = "matching-assign";
export const JOB_ASSIGN_USER = "assign-user";
export const JOB_SCAN_POOL = "scan-pool";
export const JOB_GROUP_BOTS = "group-bots";
export const JOB_ONE_ON_ONE_BOT = "one-on-one-bot";

// Kişi havuza girdiği an çağrılır (ödeme, admin paketi, KYC onayı, başbaşa iptali)
export function enqueueAssign(queue: Queue, userId: string): Promise<unknown> {
  return queue
    .add(JOB_ASSIGN_USER, { userId }, { removeOnComplete: true, removeOnFail: 100 })
    .catch(() => undefined);
}

// Kapanış botu 23:45–23:55 (TR) arasında masa başına rastgele bir anda eklenir (cron 23:45'te çalışır)
export function randomBotDelayMs(): number {
  return Math.floor(Math.random() * 10 * 60 * 1000);
}
