import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import Anthropic from "@anthropic-ai/sdk";
import { isE2eFakeMode, recordFake } from "../common/e2e/fake-layer";

type ReportLang = { questions: string[]; dna: string; dnaShort: string; comment: string };
export type AiReportDetail = { tr: ReportLang; en: ReportLang };

// Modelin döndürdüğü JSON: iki dilde 3 soru, masa DNA'sı, kısa DNA özeti ve AI yorumu
function parseDetail(raw: string): AiReportDetail | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(raw.slice(start, end + 1));
    const ok = (l: any): l is ReportLang =>
      !!l && Array.isArray(l.questions) && l.questions.length === 3 && l.questions.every((q: unknown) => typeof q === "string" && q.trim()) &&
      [l.dna, l.dnaShort, l.comment].every((v) => typeof v === "string" && v.trim());
    if (!ok(j.tr) || !ok(j.en)) return null;
    const pick = (l: ReportLang): ReportLang => ({ questions: l.questions.map((q) => q.trim()), dna: l.dna.trim(), dnaShort: l.dnaShort.trim(), comment: l.comment.trim() });
    return { tr: pick(j.tr), en: pick(j.en) };
  } catch {
    return null;
  }
}

// Yapay Zekâ Masa Raporu: masa başına bir kez üretilir ve saklanır (claude-sonnet-5-5); kullanıcıya kendi dilindeki sürüm gösterilir
@Injectable()
export class AiReportService {
  private readonly logger = new Logger(AiReportService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async generateReport(meetingId: string): Promise<void> {
    const apiKey = this.config.get<string>("CLAUDE_API_KEY");
    if (!apiKey) {
      this.logger.warn("CLAUDE_API_KEY bulunamadı, AI raporu oluşturulmadı");
      return;
    }

    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: {
          // Rapor buluşmadan önce üretilir: iptal etmeyen katılımcılar
          where: { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] } },
          include: {
            user: {
              include: {
                profile: { select: { gender: true } },
                oceanScore: true,
              } as any,
            },
          },
        },
      },
    });

    if (!meeting) return;

    // Botlar gerçek kullanıcı gibi sayılır; raporda bot olduğu asla belirtilmez
    const reportParticipants = meeting.participants.filter((p) => (p.user as any).oceanScore);

    if (reportParticipants.length < 2) {
      this.logger.log(`Masa ${meetingId}: yeterli katılımcı yok, rapor atlandı`);
      return;
    }

    const scores = reportParticipants.map((p) => {
      const o = (p.user as any).oceanScore;
      return {
        openness: o.openness as number,
        conscientiousness: o.conscientiousness as number,
        extraversion: o.extraversion as number,
        agreeableness: o.agreeableness as number,
        neuroticism: o.neuroticism as number,
      };
    });

    const uyumSkoru = this.calcCompatibility(scores);

    const dimKeys: (keyof (typeof scores)[0])[] = [
      "openness",
      "conscientiousness",
      "extraversion",
      "agreeableness",
      "neuroticism",
    ];

    // Kişisel bilgi gönderilmez: katılımcılar P1, P2, P3... etiketiyle, yalnız OCEAN skorları ve meslek alanı
    const scoreLines = reportParticipants
      .map((p, i) => {
        const s = scores[i];
        const job = (p.user as any).occupationSector as string | null;
        return `P${i + 1}: ${dimKeys.map((k) => `${k}=${s[k].toFixed(0)}`).join(", ")}${job ? `, meslek=${job}` : ""}`;
      })
      .join("\n");
    const typeName = { GROUP: "Grup masası", ONE_ON_ONE: "Baş başa masası", KANKA: "Kankamla masası (iki kanka çifti)" }[meeting.type];

    const prompt = `Sen Ahenk platformunun yapay zeka asistanısın. Ahenk, Türkiye'de algoritmik sosyal buluşmalar düzenleyen bir platform.
Masa türü: ${typeName}
Bu masadaki katılımcıların OCEAN (Büyük Beşli) kişilik skorları (0-100) ve meslek alanları:

${scoreLines}

Katılımcı sayısı: ${reportParticipants.length}
Masanın genel uyum skoru: ${uyumSkoru}/100

Bu masaya özgü bir rapor hazırla:
1) questions: Bu masadaki kişilerin ortak yönlerine uygun, sohbeti başlatacak 3 soru (her biri tek cümle).
2) dna: Masa DNA'sı / masa dinamiği, 2-3 cümle (masanın enerjisi, ortak eğilimler, farklılıkların katkısı).
3) dnaShort: Masa DNA'sının en fazla 12 kelimelik kısa özeti.
4) comment: Samimi, motive edici, kısa bir AI yorumu (2-3 cümle).
Kurallar: Hiçbir katılımcının adını, etiketini (P1 vb.), mesleğini, yaşını veya kişisel bilgisini yazma; meslek verisini yalnız ortak ilgi alanlarını sezmek için kullan. Kişiye "sen" diye hitap et. Uzun tire (—) ve çift tire (--) kullanma. Gereksiz kalıplardan kaçın, özgün ol.
Türkçe (tr) ve İngilizce (en, doğal ve samimi, "you" hitaplı) iki sürüm yaz.
Yalnız şu JSON'u döndür, başka hiçbir şey yazma:
{"tr":{"questions":["","",""],"dna":"","dnaShort":"","comment":""},"en":{"questions":["","",""],"dna":"","dnaShort":"","comment":""}}`;

    try {
      if (isE2eFakeMode()) recordFake({ channel: "anthropic", template: "masa-raporu", params: { meetingId } });
      const client = isE2eFakeMode() ? null : new Anthropic({ apiKey });
      const fake = { questions: ["?", "?", "?"], dna: "Sahte masa DNA'sı", dnaShort: "Sahte", comment: "Sahte masa raporu" };
      const message = client
        ? await client.messages.create({
            model: "claude-sonnet-5-5",
            max_tokens: 2000,
            messages: [{ role: "user", content: prompt }],
          })
        : { content: [{ type: "text", text: JSON.stringify({ tr: fake, en: fake }) }] };

      const raw = (message.content.find((b) => b.type === "text") as { type: string; text: string } | undefined)?.text ?? "";
      const detail = parseDetail(raw);
      if (!detail) {
        this.logger.error(`AI raporu çözümlenemedi (masa ${meetingId})`);
        return;
      }
      const content = detail.tr.comment;

      await this.prisma.meetingAiReport.upsert({
        where: { meetingId },
        create: { meetingId, content, uyumSkoru, detail },
        update: { content, uyumSkoru, detail, generatedAt: new Date() },
      });

      this.logger.log(`Masa ${meetingId} için AI raporu oluşturuldu (skor: ${uyumSkoru})`);
    } catch (err) {
      this.logger.error(`AI raporu oluşturma hatası (masa ${meetingId}): ${err}`);
    }
  }

  private calcCompatibility(scores: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number }[]): number {
    const dims: (keyof (typeof scores)[0])[] = [
      "openness",
      "conscientiousness",
      "extraversion",
      "agreeableness",
      "neuroticism",
    ];

    const stddevs = dims.map((dim) => {
      const vals = scores.map((s) => s[dim]);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / vals.length;
      return Math.sqrt(variance);
    });

    const avgStddev = stddevs.reduce((a, b) => a + b, 0) / stddevs.length;
    return Math.max(0, Math.min(100, Math.round(100 - (avgStddev / 50) * 100)));
  }
}
