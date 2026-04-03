import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetOtpDto } from './dto/request-password-reset-otp.dto';
import { RequestSignupOtpDto } from './dto/request-signup-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendSignupOtpDto } from './dto/resend-signup-otp.dto';
import { VerifySignupOtpDto } from './dto/verify-signup-otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  requestSignupOtp(@Body() dto: RequestSignupOtpDto) {
    return this.authService.requestSignupOtp(dto);
  }

  @Post('signup/verify-otp')
  verifySignupOtp(@Body() dto: VerifySignupOtpDto) {
    return this.authService.verifySignupOtp(dto);
  }

  @Post('signup/resend-otp')
  resendSignupOtp(@Body() dto: ResendSignupOtpDto) {
    return this.authService.resendSignupOtp(dto);
  }

  @Post('forgot-password')
  requestPasswordResetOtp(@Body() dto: RequestPasswordResetOtpDto) {
    return this.authService.requestPasswordResetOtp(dto);
  }

  @Post('forgot-password/resend-otp')
  resendPasswordResetOtp(@Body() dto: RequestPasswordResetOtpDto) {
    return this.authService.resendPasswordResetOtp(dto);
  }

  @Post('forgot-password/reset')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
