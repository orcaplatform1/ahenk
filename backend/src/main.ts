import { NestFactory } from "@nestjs/core";
import { ForbiddenException, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { csrfOriginCheck } from "./auth/csrf-origin.middleware";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true });

  // Gerçek istemci IP'si nginx'in X-Forwarded-For başlığından alınır (rate limit için).
  // Sadece loopback'ten (nginx) gelen istekte güvenilir; dışarıdan sahte başlık dikkate alınmaz.
  app.getHttpAdapter().getInstance().set("trust proxy", "loopback");

  const allowedOrigins = [
    process.env.APP_URL ?? "http://localhost:3000",
    "https://ahenk.co",
    "https://www.ahenk.co",
  ].filter(Boolean);

  app.use(cookieParser());
  app.use(csrfOriginCheck(allowedOrigins));
  app.setGlobalPrefix("api/v1");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // iyzico ödeme dönüşü: tarayıcı iyzico sayfasından POST eder (Origin iyzico) — CORS kontrolüne girmez,
  // token iyzico'dan doğrulanır. İzinsiz Origin 500 değil 403 alır.
  const CORS_EXEMPT_PATHS = new Set(["/api/v1/payment/callback"]);
  app.enableCors((req: { path: string }, callback) => {
    if (CORS_EXEMPT_PATHS.has(req.path)) return callback(null, { origin: false });
    callback(null, {
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) {
          cb(null, true);
        } else {
          cb(new ForbiddenException(`CORS: ${origin} izin listesinde değil`));
        }
      },
      credentials: true,
    });
  });

  // Swagger sadece geliştirme ortamında açık; canlıda /api/docs yok
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Ahenk API")
      .setDescription("Ahenk — Haftalık Sosyal Buluşma Platformu API")
      .setVersion("1.0")
      .addBearerAuth()
      .addCookieAuth("refresh_token")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Ahenk API çalışıyor: http://localhost:${port}/api/v1`);
  if (!isProduction) console.log(`Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
