import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsString,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AnswerItemDto {
  @ApiProperty({ description: "Soru ID'si" })
  @IsString()
  questionId: string;

  @ApiProperty({ description: "1 (Hiç katılmıyorum) — 5 (Tamamen katılıyorum)", minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;
}

export class SubmitTestDto {
  @ApiProperty({ type: [AnswerItemDto], description: "Tüm 19 sorunun cevabı" })
  @IsArray()
  @ArrayMinSize(19, { message: "19 sorunun tamamına cevap verilmeli" })
  @ArrayMaxSize(19, { message: "Fazladan cevap var" })
  @ValidateNested({ each: true })
  @Type(() => AnswerItemDto)
  answers: AnswerItemDto[];
}
