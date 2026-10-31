import { Module } from '@nestjs/common';
import { PartnershipsController } from './partnerships.controller';
import { PartnershipsService } from './partnerships.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PartnershipsController],
  providers: [PartnershipsService],
})
export class PartnershipsModule {}
