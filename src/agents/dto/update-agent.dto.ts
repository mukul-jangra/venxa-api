import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateAgentDto {
  @IsString()
  @MinLength(2)
  @IsOptional()
  code?: string;

  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @IsString()
  @MinLength(2)
  @IsOptional()
  role?: string;

  @IsString()
  @MinLength(2)
  @IsOptional()
  domain?: string;

  @IsString()
  @MinLength(4)
  @IsOptional()
  personality?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  totalExperts?: number;

  @IsString()
  @MinLength(2)
  @IsOptional()
  cta?: string;

  @IsBoolean()
  @IsOptional()
  comingSoon?: boolean;

  @IsString()
  @MinLength(2)
  @IsOptional()
  apiKeyRef?: string;

  @IsString()
  @MinLength(2)
  @IsOptional()
  iconKey?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  searchAliases?: string[];
}
