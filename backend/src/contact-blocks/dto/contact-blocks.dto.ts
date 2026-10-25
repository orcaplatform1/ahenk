import { IsArray, IsString, ArrayMaxSize } from "class-validator";

export class SyncContactBlocksDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  hashedPhones: string[];
}
