import { IsOptional, IsString, MinLength } from 'class-validator';

export class SendNotificationDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(2)
  body!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  channel?: string;
}
