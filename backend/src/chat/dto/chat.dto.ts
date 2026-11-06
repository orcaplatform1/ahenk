import { IsString, MaxLength, IsNotEmpty } from "class-validator";

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;
}
