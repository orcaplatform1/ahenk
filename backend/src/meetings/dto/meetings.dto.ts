import { IsArray, IsString, ArrayMinSize } from "class-validator";

export class BlockUsersDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  blockedUserIds: string[];
}
