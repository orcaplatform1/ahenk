import { PrismaClient, OceanDimension, UserRole, Gender } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 19 soru — 5 bölüm (boyut başına gruplandırılmış)
// Boyut dağılımı: O:4, C:4, E:4, A:4, N:3
// Skorlama: ((ortalama - 1) / 4) × 100; reversed=true sorularda değer önce 6-değer yapılır
const oceanQuestions = [
  // ── Bölüm 1: Merak ve Açıklık — Openness (4 soru) ─────────────────────────
  {
    text: "Yeni fikirlere ve farklı bakış açılarına ilgi duyarım.",
    dimension: OceanDimension.OPENNESS,
    reversed: false,
    orderNum: 1,
    section: 1,
    sectionTitle: "Merak ve Açıklık",
    active: true,
  },
  {
    text: "Sanat, müzik veya edebiyat beni derinden etkiler.",
    dimension: OceanDimension.OPENNESS,
    reversed: false,
    orderNum: 2,
    section: 1,
    sectionTitle: "Merak ve Açıklık",
    active: true,
  },
  {
    text: "Hayal gücüme güvenir, alışılmışın dışında düşünürüm.",
    dimension: OceanDimension.OPENNESS,
    reversed: false,
    orderNum: 3,
    section: 1,
    sectionTitle: "Merak ve Açıklık",
    active: true,
  },
  {
    text: "Soyut kavramları ve felsefi soruları tartışmaktan keyif alırım.",
    dimension: OceanDimension.OPENNESS,
    reversed: false,
    orderNum: 4,
    section: 1,
    sectionTitle: "Merak ve Açıklık",
    active: true,
  },

  // ── Bölüm 2: Düzen ve Sorumluluk — Conscientiousness (4 soru) ─────────────
  {
    text: "İşlerimi zamanında ve eksiksiz tamamlarım.",
    dimension: OceanDimension.CONSCIENTIOUSNESS,
    reversed: false,
    orderNum: 5,
    section: 2,
    sectionTitle: "Düzen ve Sorumluluk",
    active: true,
  },
  {
    text: "Planlarıma ve rutinlerime bağlı kalırım.",
    dimension: OceanDimension.CONSCIENTIOUSNESS,
    reversed: false,
    orderNum: 6,
    section: 2,
    sectionTitle: "Düzen ve Sorumluluk",
    active: true,
  },
  {
    text: "Detaylara dikkat ederim, hatalarımı kontrol ederim.",
    dimension: OceanDimension.CONSCIENTIOUSNESS,
    reversed: false,
    orderNum: 7,
    section: 2,
    sectionTitle: "Düzen ve Sorumluluk",
    active: true,
  },
  {
    text: "Uzun vadeli hedefler için anlık zevklerden vazgeçebilirim.",
    dimension: OceanDimension.CONSCIENTIOUSNESS,
    reversed: false,
    orderNum: 8,
    section: 2,
    sectionTitle: "Düzen ve Sorumluluk",
    active: true,
  },

  // ── Bölüm 3: Sosyallik ve Enerji — Extraversion (4 soru) ──────────────────
  {
    text: "Sosyal ortamlar enerjimi yükseltir, insanlarla vakit geçirmekten keyif alırım.",
    dimension: OceanDimension.EXTRAVERSION,
    reversed: false,
    orderNum: 9,
    section: 3,
    sectionTitle: "Sosyallik ve Enerji",
    active: true,
  },
  {
    text: "Grupta söz almaktan ve dikkat çekmekten çekinmem.",
    dimension: OceanDimension.EXTRAVERSION,
    reversed: false,
    orderNum: 10,
    section: 3,
    sectionTitle: "Sosyallik ve Enerji",
    active: true,
  },
  {
    text: "Yeni insanlarla tanışmak beni heyecanlandırır.",
    dimension: OceanDimension.EXTRAVERSION,
    reversed: false,
    orderNum: 11,
    section: 3,
    sectionTitle: "Sosyallik ve Enerji",
    active: true,
  },
  {
    text: "Sessiz ve sakin ortamlar beni bunaltır.",
    dimension: OceanDimension.EXTRAVERSION,
    reversed: false,
    orderNum: 12,
    section: 3,
    sectionTitle: "Sosyallik ve Enerji",
    active: true,
  },

  // ── Bölüm 4: Empati ve Uyum — Agreeableness (4 soru) ─────────────────────
  {
    text: "İnsanların ihtiyaçlarını kendi ihtiyaçlarımın önünde tutarım.",
    dimension: OceanDimension.AGREEABLENESS,
    reversed: false,
    orderNum: 13,
    section: 4,
    sectionTitle: "Empati ve Uyum",
    active: true,
  },
  {
    text: "Çatışmadan kaçınır, uzlaşmayı tercih ederim.",
    dimension: OceanDimension.AGREEABLENESS,
    reversed: false,
    orderNum: 14,
    section: 4,
    sectionTitle: "Empati ve Uyum",
    active: true,
  },
  {
    text: "Başkalarının duygularını kolayca hissedebilirim.",
    dimension: OceanDimension.AGREEABLENESS,
    reversed: false,
    orderNum: 15,
    section: 4,
    sectionTitle: "Empati ve Uyum",
    active: true,
  },
  {
    text: "İnsanlara güvenmek benim için doğal gelir.",
    dimension: OceanDimension.AGREEABLENESS,
    reversed: false,
    orderNum: 16,
    section: 4,
    sectionTitle: "Empati ve Uyum",
    active: true,
  },

  // ── Bölüm 5: Duygusal Denge — Neuroticism (3 soru) ────────────────────────
  {
    text: "Stresli durumlarda kendimi kaybetmeden sakin kalabilirim.",
    dimension: OceanDimension.NEUROTICISM,
    reversed: true, // Yüksek katılım = düşük N; skor: 6 - değer
    orderNum: 17,
    section: 5,
    sectionTitle: "Duygusal Denge",
    active: true,
  },
  {
    text: "Küçük şeyler bile beni uzun süre rahatsız edebilir.",
    dimension: OceanDimension.NEUROTICISM,
    reversed: false,
    orderNum: 18,
    section: 5,
    sectionTitle: "Duygusal Denge",
    active: true,
  },
  {
    text: "Endişeli veya gergin hissetmek benim için nadir değildir.",
    dimension: OceanDimension.NEUROTICISM,
    reversed: false,
    orderNum: 19,
    section: 5,
    sectionTitle: "Duygusal Denge",
    active: true,
  },
];

async function main() {
  console.log("Seed başlıyor...");

  // Mevcut soruları temizle, yenilerini ekle
  await prisma.oceanQuestion.deleteMany({});
  for (const q of oceanQuestions) {
    await prisma.oceanQuestion.create({ data: q });
  }
  console.log(`✓ ${oceanQuestions.length} OCEAN sorusu eklendi (5 bölüm, O:4 C:4 E:4 A:4 N:3)`);

  // Superadmin hesabı
  const superadminEmail = process.env.SUPERADMIN_EMAIL ?? "admin@ahenk.tr";
  const superadminPassword = process.env.SUPERADMIN_PASSWORD ?? "Ahenk2024!";

  const existingSuperadmin = await prisma.user.findUnique({
    where: { email: superadminEmail },
  });

  if (!existingSuperadmin) {
    const passwordHash = await bcrypt.hash(superadminPassword, 12);
    const superadmin = await prisma.user.create({
      data: {
        email: superadminEmail,
        passwordHash,
        role: UserRole.SUPERADMIN,
        emailVerified: true,
        profile: {
          create: {
            firstName: "Super",
            lastName: "Admin",
            isPublic: false,
          },
        },
      },
    });
    console.log(`✓ Superadmin oluşturuldu: ${superadmin.email}`);
  } else {
    console.log(`✓ Superadmin zaten mevcut: ${superadminEmail}`);
  }

  // Bot kullanıcısı
  const botEmail = "bot@ahenk.tr";
  const existingBot = await prisma.user.findUnique({ where: { email: botEmail } });
  if (!existingBot) {
    const botPasswordHash = await bcrypt.hash("BotAhenk2024!", 12);
    const bot = await prisma.user.create({
      data: {
        email: botEmail,
        passwordHash: botPasswordHash,
        role: UserRole.USER,
        isBot: true,
        emailVerified: true,
        profile: {
          create: {
            firstName: "Ahenk",
            lastName: "Botu",
            isPublic: false,
            gender: Gender.FEMALE,
          },
        },
      },
    });
    // Manuel OCEAN skoru (50/50/50/50/50 — dengeli/nötr)
    await prisma.oceanScore.create({
      data: {
        userId: bot.id,
        openness: 50,
        conscientiousness: 50,
        extraversion: 50,
        agreeableness: 50,
        neuroticism: 50,
      },
    });
    console.log(`✓ Bot kullanıcısı oluşturuldu: ${bot.email}`);
  } else {
    console.log(`✓ Bot kullanıcısı zaten mevcut: ${botEmail}`);
  }

  // Aktif şehirler
  const activeCities = ["İstanbul", "Ankara", "İzmir", "Antalya", "Balıkesir", "Muğla", "Aydın"];
  for (const name of activeCities) {
    await prisma.city.upsert({
      where: { name },
      update: {},
      create: { name, isActive: true },
    });
  }
  console.log(`✓ ${activeCities.length} aktif şehir yüklendi`);

  // Varsayılan sistem ayarları
  const defaultConfigs = [
    { key: "WEEKLY_TABLE_LIMIT", value: "0" },       // 0 = sınırsız
    { key: "MATCHING_ENABLED", value: "true" },
  ];
  for (const cfg of defaultConfigs) {
    await prisma.appConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: cfg,
    });
  }
  console.log("✓ Varsayılan sistem ayarları yüklendi");

  console.log("Seed tamamlandı.");
}

main()
  .catch((e) => {
    console.error("Seed hatası:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
