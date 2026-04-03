import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserProfileDto {
  @IsString()
  @MinLength(2)
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  timeOfBirth?: string;

  @IsString()
  @IsOptional()
  placeOfBirth?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  relationshipStatus?: string;

  @IsBoolean()
  @IsOptional()
  birthDetailsVerified?: boolean;
}
