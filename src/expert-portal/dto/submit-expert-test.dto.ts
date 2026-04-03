import { ArrayMinSize, IsArray, IsString, MinLength } from 'class-validator';

export class SubmitExpertTestDto {
  @IsArray()
  @ArrayMinSize(4)
  @IsString({ each: true })
  @MinLength(10, { each: true })
  answers: string[];
}
