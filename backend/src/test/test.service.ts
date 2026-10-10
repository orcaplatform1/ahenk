import {
  Injectable,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { SubmitTestDto } from "./dto/submit-test.dto";
import { OceanDimension } from "@prisma/client";

const TOTAL_QUESTIONS = 19;
const RETAKE_DAYS = 180;

type DimKey = "openness" | "conscientiousness" | "extraversion" | "agreeableness" | "neuroticism";

const DIM_MAP: Record<OceanDimension, DimKey> = {
  OPENNESS: "openness",
  CONSCIENTIOUSNESS: "conscientiousness",
  EXTRAVERSION: "extraversion",
  AGREEABLENESS: "agreeableness",
  NEUROTICISM: "neuroticism",
};

@Injectable()
export class TestService {
  constructor(private prisma: PrismaService) {}

  // ─── Soruları bölüm bölüm getir ──────────────────────────────────────────

  async getQuestions() {
    const questions = await this.prisma.oceanQuestion.findMany({
      where: { active: true },
      orderBy: { orderNum: "asc" },
      select: {
        id: true,
        text: true,
        orderNum: true,
        section: true,
        sectionTitle: true,
        // dimension ve reversed kasıtlı gizlendi (kullanıcıya skoru etkilememesi için)
      },
    });

    // Bölümlere grupla
    const sections = questions.reduce<
      Record<number, { section: number; title: string; questions: typeof questions }>
    >((acc, q) => {
      if (!acc[q.section]) {
        acc[q.section] = { section: q.section, title: q.sectionTitle, questions: [] };
      }
      acc[q.section].questions.push(q);
      return acc;
    }, {});

    return {
      totalQuestions: questions.length,
      sections: Object.values(sections).sort((a, b) => a.section - b.section),
    };
  }

  // ─── Testi gönder + OCEAN hesapla ────────────────────────────────────────

  async submit(userId: string, dto: SubmitTestDto) {
    // Yeniden test hakkı kontrolü
    const existing = await this.prisma.oceanScore.findUnique({ where: { userId } });
    if (existing) {
      const daysSince =
        (Date.now() - existing.completedAt.getTime()) / (1000 * 60 * 60 * 24);
      const lockedByTime = daysSince < RETAKE_DAYS;

      if (lockedByTime && !existing.adminCanReset) {
        throw new ConflictException(
          `Testi ${Math.ceil(RETAKE_DAYS - daysSince)} gün sonra tekrar yapabilirsin`,
        );
      }
    }

    // Aktif soruları al
    const questions = await this.prisma.oceanQuestion.findMany({
      where: { active: true },
      select: { id: true, dimension: true, reversed: true },
    });

    if (questions.length !== TOTAL_QUESTIONS) {
      throw new BadRequestException("Test soruları henüz yapılandırılmamış");
    }

    // Cevaplanan soru ID'leri benzersiz mi?
    const answeredIds = dto.answers.map((a) => a.questionId);
    if (new Set(answeredIds).size !== answeredIds.length) {
      throw new BadRequestException("Aynı soru için birden fazla cevap verilmiş");
    }

    // Tüm cevaplanan sorular geçerli mi?
    const validIds = new Set(questions.map((q) => q.id));
    const invalidIds = answeredIds.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException("Geçersiz soru ID'leri mevcut");
    }

    // OCEAN hesapla
    const qMap = new Map(questions.map((q) => [q.id, q]));
    const buckets: Record<DimKey, number[]> = {
      openness: [],
      conscientiousness: [],
      extraversion: [],
      agreeableness: [],
      neuroticism: [],
    };

    for (const answer of dto.answers) {
      const q = qMap.get(answer.questionId)!;
      const adjusted = q.reversed ? 6 - answer.score : answer.score;
      buckets[DIM_MAP[q.dimension]].push(adjusted);
    }

    const score = (scores: number[]) =>
      Math.round(((scores.reduce((s, n) => s + n, 0) / scores.length - 1) / 4) * 100);

    const oceanScore = {
      openness: score(buckets.openness),
      conscientiousness: score(buckets.conscientiousness),
      extraversion: score(buckets.extraversion),
      agreeableness: score(buckets.agreeableness),
      neuroticism: score(buckets.neuroticism),
    };

    const sessionId = randomUUID();

    // DB'ye kaydet (transaction)
    await this.prisma.$transaction([
      // Önceki cevapları temizle
      this.prisma.oceanAnswer.deleteMany({ where: { userId } }),
      // Yeni cevapları kaydet
      this.prisma.oceanAnswer.createMany({
        data: dto.answers.map((a) => ({
          userId,
          questionId: a.questionId,
          sessionId,
          score: a.score,
        })),
      }),
      // OCEAN skoru kaydet/güncelle
      existing
        ? this.prisma.oceanScore.update({
            where: { userId },
            data: { ...oceanScore, completedAt: new Date(), adminCanReset: false },
          })
        : this.prisma.oceanScore.create({
            data: { userId, ...oceanScore },
          }),
    ]);

    return {
      message: "Test tamamlandı",
      scores: oceanScore,
      profile: this.describeProfile(oceanScore),
    };
  }

  // ─── Kendi sonucunu gör ───────────────────────────────────────────────────

  async getMyResult(userId: string) {
    const score = await this.prisma.oceanScore.findUnique({ where: { userId } });
    if (!score) return { completed: false, message: "Henüz test yapılmadı" };

    return {
      completed: true,
      completedAt: score.completedAt,
      scores: {
        openness: score.openness,
        conscientiousness: score.conscientiousness,
        extraversion: score.extraversion,
        agreeableness: score.agreeableness,
        neuroticism: score.neuroticism,
      },
      profile: this.describeProfile(score as any),
      canRetakeNow: score.adminCanReset,
      retakeAvailableAt: score.adminCanReset
        ? null
        : new Date(score.completedAt.getTime() + RETAKE_DAYS * 24 * 60 * 60 * 1000),
    };
  }

  // ─── Admin: Test kilidini aç ──────────────────────────────────────────────

  async adminResetLock(userId: string) {
    const score = await this.prisma.oceanScore.findUnique({ where: { userId } });
    if (!score) {
      throw new BadRequestException("Bu kullanıcının henüz tamamlanmış bir testi yok");
    }
    return this.prisma.oceanScore.update({
      where: { userId },
      data: { adminCanReset: true },
      select: { userId: true, completedAt: true, adminCanReset: true },
    });
  }

  // ─── Kısa profil açıklaması ───────────────────────────────────────────────

  private describeProfile(s: Record<DimKey, number>): string {
    const traits: string[] = [];
    if (s.openness >= 65) traits.push("meraklı ve yaratıcı");
    else if (s.openness <= 35) traits.push("pratik ve gelenekçi");

    if (s.conscientiousness >= 65) traits.push("düzenli ve kararlı");
    else if (s.conscientiousness <= 35) traits.push("esnek ve spontane");

    if (s.extraversion >= 65) traits.push("enerjik ve sosyal");
    else if (s.extraversion <= 35) traits.push("dingin ve düşünceli");

    if (s.agreeableness >= 65) traits.push("uyumlu ve empatik");
    else if (s.agreeableness <= 35) traits.push("bağımsız ve doğrudan");

    if (s.neuroticism >= 65) traits.push("duyarlı ve derinlemesine hisseden");
    else if (s.neuroticism <= 35) traits.push("sakin ve dengeli");

    return traits.length > 0 ? traits.join(", ") : "dengeli ve çok yönlü";
  }
}
