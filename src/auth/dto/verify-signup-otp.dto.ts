import { IsEmail, IsString, Length } from 'class-validator';

export class VerifySignupOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(4, 8)
  otp: string;
}
