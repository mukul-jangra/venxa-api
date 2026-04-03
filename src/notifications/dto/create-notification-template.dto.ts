import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateNotificationTemplateDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(2)
  body!: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
