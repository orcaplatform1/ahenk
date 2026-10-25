import { Body, Controller, Post } from '@nestjs/common';
import { PartnershipsService } from './partnerships.service';
import { ApplyPartnershipDto } from './partnerships.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('partnerships')
@Throttle({ default: { ttl: 60000, limit: 5 } })
export class PartnershipsController {
  constructor(private service: PartnershipsService) {}

  @Post('apply')
  apply(@Body() dto: ApplyPartnershipDto) {
    return this.service.apply(dto);
  }
}
