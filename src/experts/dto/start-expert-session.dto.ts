import { IsOptional, IsString } from 'class-validator';

export class StartExpertSessionDto {
  @IsString()
  userId: string;

  @IsString()
  expertId: string;

  @IsString()
  @IsOptional()
  mode?: string;
}
