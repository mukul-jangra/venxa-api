import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SendExpertPortalMessageDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  imageUri?: string;

  @IsOptional()
  @IsString()
  audioUri?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  audioDurationMs?: number;
}
