import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateExpertProfileDto {
  @IsString()
  fullName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specialties?: string[];

  @IsInt()
  @Min(0)
  @Max(60)
  yearsExperience: number;

  @IsInt()
  @Min(0)
  @Max(10000)
  pricePerMinute: number;

  @IsString()
  @IsOptional()
  avatarUrl?: string;
}
