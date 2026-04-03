import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateExpertDto {
  @IsString()
  agentId: string;

  @IsString()
  name: string;

  @IsString()
  role: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  aiRating?: number;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  aiTestScore?: number;

  @IsInt()
  @Min(0)
  pricePerMinute: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  yearsExperience?: number;

  @IsString()
  @IsOptional()
  avatarKey?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
