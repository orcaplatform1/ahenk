import { Module } from '@nestjs/common';
import { CareersController } from './careers.controller';
import { CareersService } from './careers.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CareersController],
  providers: [CareersService],
})
export class CareersModule {}
