import { IsEmail, IsString, MinLength } from 'class-validator';

export class ExpertSignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
