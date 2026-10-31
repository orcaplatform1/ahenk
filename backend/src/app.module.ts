import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bull";
import { ScheduleModule } from "@nestjs/schedule";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
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
import { ReferralModule } from "./referral/referral.module";
import { KankaModule } from "./kanka/kanka.module";
import { ChatModule } from "./chat/chat.module";
import { SosModule } from "./sos/sos.module";
import { VenuePanelModule } from "./venue-panel/venue-panel.module";

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
    // Tek varsayılan limit (IP başına dakikada 300); endpoint'e özel limitler @Throttle({ default }) ile
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 300 }]),
    PrismaModule,
    RedisModule,
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
    VenuePanelModule,
    ReferralModule,
    KankaModule,
    CareersModule,
    ChatModule,
    SosModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
