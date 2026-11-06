import * as fs from "fs";
import * as path from "path";

// E2E test katmanı. Sadece AHENK_TEST_MODE=1 VE DATABASE_URL içinde "ahenk_test" varken devreye girer.
// İki koşul birlikte sağlanmıyorsa isE2eFakeMode() false döner ve servisler normal yolundan çalışır.
export function isE2eFakeMode(): boolean {
  return process.env.AHENK_TEST_MODE === "1" && (process.env.DATABASE_URL ?? "").includes("ahenk_test");
}

export type FakeControl = {
  whatsappFailPhones?: string[]; // bu numaralara gönderim zaman aşımına düşer
  whatsappOtpFail?: boolean;
  iyzicoInit?: "success" | "failure";
  iyzicoRetrieve?: "success" | "failure";
  iyzicoRefund?: "success" | "failure";
  fcmFail?: boolean;
};

export type OutboxEntry = {
  at: string;
  channel: "whatsapp" | "whatsapp-otp" | "fcm" | "iyzico" | "anthropic";
  template?: string;
  to?: string; // alıcının son 4 hanesi
  params?: unknown;
};

const memory: OutboxEntry[] = [];

function artifactsDir(): string {
  return process.env.AHENK_TEST_ARTIFACTS ?? "/root/ahenk-test-artifacts";
}

export function readFakeControl(): FakeControl {
  try {
    return JSON.parse(fs.readFileSync(path.join(artifactsDir(), "fake-control.json"), "utf8"));
  } catch {
    return {};
  }
}

export function fakeOutbox(): OutboxEntry[] {
  return memory;
}

export function recordFake(entry: Omit<OutboxEntry, "at">): void {
  const row: OutboxEntry = { at: new Date().toISOString(), ...entry };
  memory.push(row);
  fs.appendFileSync(path.join(artifactsDir(), "outbox.log"), JSON.stringify(row) + "\n");
}

export function last4(phone: string): string {
  return (phone ?? "").slice(-4);
}

// Sahte iyzico token'ı çağrı parametrelerini taşır; süreçler arası durum gerektirmez
export function encodeFakeIyzicoToken(data: { conversationId: string; basketId: string; price: string }): string {
  return `fake_${Buffer.from(JSON.stringify(data)).toString("base64url")}`;
}

export function decodeFakeIyzicoToken(token: string): { conversationId: string; basketId: string; price: string } | null {
  if (!token?.startsWith("fake_")) return null;
  try {
    return JSON.parse(Buffer.from(token.slice(5), "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
