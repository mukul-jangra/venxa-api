import { IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  userId!: string;

  @IsString()
  @MinLength(5)
  expoPushToken!: string;

  @IsString()
  platform!: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}
