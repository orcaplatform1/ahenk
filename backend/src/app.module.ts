import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bull";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { StorageModule } from "./storage/storage.module";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { KycModule } from "./kyc/kyc.module";
import { TestModule } from "./test/test.module";
import { MatchingModule } from "./matching/matching.module";
import { PaymentModule } from "./payment/payment.module";
import { NotificationModule } from "./notification/notification.module";
import { AdminModule } from "./admin/admin.module";
import { MeetingsModule } from "./meetings/meetings.module";
import { ContactBlocksModule } from "./contact-blocks/contact-blocks.module";
import { PartnershipsModule } from "./partnerships/partnerships.module";
import { CareersModule } from "./careers/careers.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: "../.env",
    }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get("REDIS_HOST", "localhost"),
          port: config.get<number>("REDIS_PORT", 6379),
          password: config.get("REDIS_PASSWORD"),
        },
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60000, limit: 60 },
    ]),
    PrismaModule,
    RedisModule,
    StorageModule,
    UsersModule,
    AuthModule,
    KycModule,
    TestModule,
    MatchingModule,
    PaymentModule,
    NotificationModule,
    AdminModule,
    MeetingsModule,
    ContactBlocksModule,
    PartnershipsModule,
    CareersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
