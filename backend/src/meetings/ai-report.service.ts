import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import Anthropic from "@anthropic-ai/sdk";

@Injectable()
export class AiReportService {
  private readonly logger = new Logger(AiReportService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async getReport(meetingId: string) {
    const report = await this.prisma.meetingAiReport.findUnique({
      where: { meetingId },
    });
    return report ?? null;
  }

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
          where: { status: "ATTENDED" },
          include: {
            user: {
              include: {
                profile: { select: { firstName: true, gender: true } },
                oceanScore: true,
                isBot: true,
              } as any,
            },
          },
        },
      },
    });

    if (!meeting) return;

    const humanParticipants = meeting.participants.filter(
      (p) => !(p.user as any).isBot && (p.user as any).oceanScore,
    );

    if (humanParticipants.length < 2) {
      this.logger.log(`Masa ${meetingId}: yeterli katılımcı yok, rapor atlandı`);
      return;
    }

    const scores = humanParticipants.map((p) => {
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

    const dims = ["açıklık", "sorumluluk", "dışadönüklük", "uyumluluk", "nevrotizm"];
    const dimKeys: (keyof (typeof scores)[0])[] = [
      "openness",
      "conscientiousness",
      "extraversion",
      "agreeableness",
      "neuroticism",
    ];

    const scoreLines = humanParticipants
      .map((p, i) => {
        const s = scores[i];
        const name = (p.user as any).profile?.firstName ?? "Anonim";
        return `${name}: ${dimKeys.map((k) => `${k}=${s[k].toFixed(0)}`).join(", ")}`;
      })
      .join("\n");

    const prompt = `Sen Ahenk platformunun yapay zeka asistanısın. Ahenk, Türkiye'de algoritmik sosyal buluşmalar düzenleyen bir platform.
Bu buluşmanın katılımcılarının OCEAN (Büyük Beşli) kişilik skorları:

${scoreLines}

Katılımcı sayısı: ${humanParticipants.length}
Toplam uyum skoru: ${uyumSkoru}/100

Lütfen bu gruba özgü, samimi, motive edici, kısa bir masa raporu yaz (2-3 cümle). Türkçe yaz.
Katılımcıların güçlü ortak yönlerini ve farklılıklarından doğabilecek zenginliği vurgula.
Gereksiz kalıpları kullanma, özgün ol.`;

    try {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model: "claude-haiku-5-5",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      const content = (message.content[0] as { type: string; text: string }).text ?? "";

      await this.prisma.meetingAiReport.upsert({
        where: { meetingId },
        create: { meetingId, content, uyumSkoru },
        update: { content, uyumSkoru, generatedAt: new Date() },
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
