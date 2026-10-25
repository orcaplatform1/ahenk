import { Body, Controller, Post } from '@nestjs/common';
import { CareersService } from './careers.service';
import { ApplyCareerDto } from './careers.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('careers')
@Throttle({ default: { ttl: 60000, limit: 5 } })
export class CareersController {
  constructor(private service: CareersService) {}

  @Post('apply')
  apply(@Body() dto: ApplyCareerDto) {
    return this.service.apply(dto);
  }
}
