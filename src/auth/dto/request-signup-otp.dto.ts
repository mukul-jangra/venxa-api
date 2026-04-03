import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RequestSignupOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;
}
