import { IsEmail } from 'class-validator';

export class ResendSignupOtpDto {
  @IsEmail()
  email: string;
}
