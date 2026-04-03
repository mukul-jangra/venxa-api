import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAgentDto {
  @IsString()
  @MinLength(2)
  code: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  role: string;

  @IsString()
  @MinLength(2)
  domain: string;

  @IsString()
  @MinLength(4)
  personality: string;

  @IsInt()
  @Min(0)
  totalExperts: number;

  @IsString()
  @MinLength(2)
  cta: string;

  @IsBoolean()
  @IsOptional()
  comingSoon?: boolean;

  @IsString()
  @MinLength(2)
  apiKeyRef: string;

  @IsString()
  @MinLength(2)
  iconKey: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  searchAliases: string[];
}
