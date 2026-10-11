import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsString, IsOptional } from "class-validator";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

class SaveCitiesDto {
  @IsString()
  primaryCityId: string;

  @IsOptional()
  @IsString()
  secondaryCityId?: string;
}

@ApiTags("Users")
@Controller("users")
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post("cities")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Şehir tercihlerini kaydet" })
  saveCities(@CurrentUser() user: any, @Body() dto: SaveCitiesDto) {
    return this.usersService.saveCities(user.id, dto.primaryCityId, dto.secondaryCityId);
  }
}
