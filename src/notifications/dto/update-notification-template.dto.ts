import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateNotificationTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  body?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
