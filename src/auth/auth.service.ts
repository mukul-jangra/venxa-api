import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'crypto';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetOtpDto } from './dto/request-password-reset-otp.dto';
import { RequestSignupOtpDto } from './dto/request-signup-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendSignupOtpDto } from './dto/resend-signup-otp.dto';
import { VerifySignupOtpDto } from './dto/verify-signup-otp.dto';

type DeliveryMode = 'email' | 'development';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async requestSignupOtp(dto: RequestSignupOtpDto) {
    const email = dto.email.trim().toLowerCase();
    await this.prisma.pendingSignup.deleteMany({
      where: { otpExpiresAt: { lt: new Date() } },
    });

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('This email is already registered');
    }

    const now = new Date();
    const existingPending = await this.prisma.pendingSignup.findUnique({
      where: { email },
    });

    if (existingPending && now.getTime() - existingPending.lastSentAt.getTime() < 30_000) {
      throw new HttpException(
        'Please wait 30 seconds before requesting another OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const passwordHash = this.hashPassword(dto.password);

    await this.prisma.pendingSignup.upsert({
      where: { email },
      update: {
        passwordHash,
        name: dto.name?.trim() || null,
        otpHash: this.hashOtp(otp),
        otpExpiresAt: expiresAt,
        lastSentAt: now,
        attempts: 0,
      },
      create: {
        email,
        passwordHash,
        name: dto.name?.trim() || null,
        otpHash: this.hashOtp(otp),
        otpExpiresAt: expiresAt,
        lastSentAt: now,
      },
    });

    const delivery = await this.deliverOtpEmail({
      email,
      otp,
      subject: 'Your Venxa verification code',
      heading: 'Verify your Venxa account',
      message: 'Enter this code in the app to complete your signup. The code expires in 10 minutes.',
      logLabel: 'VENXA SIGNUP OTP',
    });

    return {
      email,
      expiresAt,
      delivery,
      message:
        delivery === 'email'
          ? 'We sent a verification code to your email'
          : 'OTP generated in development mode',
      otpPreview: delivery === 'development' ? otp : null,
    };
  }

  async resendSignupOtp(dto: ResendSignupOtpDto) {
    const email = dto.email.trim().toLowerCase();

    const pendingSignup = await this.prisma.pendingSignup.findUnique({
      where: { email },
    });

    if (!pendingSignup) {
      throw new NotFoundException('Start signup first');
    }

    const now = new Date();
    if (now.getTime() - pendingSignup.lastSentAt.getTime() < 30_000) {
      throw new HttpException(
        'Please wait 30 seconds before requesting another OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    await this.prisma.pendingSignup.update({
      where: { email },
      data: {
        otpHash: this.hashOtp(otp),
        otpExpiresAt: expiresAt,
        lastSentAt: now,
        attempts: 0,
      },
    });

    const delivery = await this.deliverOtpEmail({
      email,
      otp,
      subject: 'Your Venxa verification code',
      heading: 'Verify your Venxa account',
      message: 'Enter this code in the app to complete your signup. The code expires in 10 minutes.',
      logLabel: 'VENXA SIGNUP OTP',
    });

    return {
      email,
      expiresAt,
      delivery,
      message:
        delivery === 'email'
          ? 'A new verification code has been sent'
          : 'A new OTP was generated in development mode',
      otpPreview: delivery === 'development' ? otp : null,
    };
  }

  async verifySignupOtp(dto: VerifySignupOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const otp = dto.otp.trim();

    const pendingSignup = await this.prisma.pendingSignup.findUnique({
      where: { email },
    });

    if (!pendingSignup) {
      throw new NotFoundException('Start signup first');
    }

    if (pendingSignup.otpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP expired. Please request a new one');
    }

    if (pendingSignup.attempts >= 5) {
      throw new HttpException(
        'Too many invalid OTP attempts. Please request a new OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (this.hashOtp(otp) !== pendingSignup.otpHash) {
      await this.prisma.pendingSignup.update({
        where: { email },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid OTP');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      await this.prisma.pendingSignup.delete({ where: { email } });
      throw new ConflictException('This email is already registered');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        password: pendingSignup.passwordHash,
        name: pendingSignup.name,
        profile: {
          create: {
            fullName: pendingSignup.name?.trim() || '',
            dateOfBirth: null,
            timeOfBirth: null,
            placeOfBirth: null,
            gender: null,
            relationshipStatus: null,
            birthDetailsVerified: false,
          },
        },
        settings: {
          create: {
            focusAreas: [],
            themeChoice: 'system',
          },
        },
      },
    });

    await this.prisma.pendingSignup.delete({
      where: { email },
    });

    await this.notificationsService.ensureWelcomeNotification(user.id);

    return {
      ...this.toAuthResponse(user),
      message: 'Email verified successfully',
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('This user is not registered');
    }

    if (!this.verifyPassword(dto.password, user.password)) {
      throw new UnauthorizedException('Wrong password');
    }

    return this.toAuthResponse(user);
  }

  async requestPasswordResetOtp(dto: RequestPasswordResetOtpDto) {
    const email = dto.email.trim().toLowerCase();
    await this.prisma.passwordResetOtp.deleteMany({
      where: { otpExpiresAt: { lt: new Date() } },
    });

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('This user is not registered');
    }

    const now = new Date();
    const existingReset = await this.prisma.passwordResetOtp.findUnique({
      where: { email },
    });

    if (existingReset && now.getTime() - existingReset.lastSentAt.getTime() < 30_000) {
      throw new HttpException(
        'Please wait 30 seconds before requesting another OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    await this.prisma.passwordResetOtp.upsert({
      where: { email },
      update: {
        otpHash: this.hashOtp(otp),
        otpExpiresAt: expiresAt,
        lastSentAt: now,
        attempts: 0,
      },
      create: {
        email,
        otpHash: this.hashOtp(otp),
        otpExpiresAt: expiresAt,
        lastSentAt: now,
      },
    });

    const delivery = await this.deliverOtpEmail({
      email,
      otp,
      subject: 'Your Venxa password reset code',
      heading: 'Reset your Venxa password',
      message: 'Enter this code and create a new password in the app. The code expires in 10 minutes.',
      logLabel: 'VENXA RESET OTP',
    });

    return {
      email,
      expiresAt,
      delivery,
      message:
        delivery === 'email'
          ? 'We sent a password reset code to your email'
          : 'Password reset OTP generated in development mode',
      otpPreview: delivery === 'development' ? otp : null,
    };
  }

  async resendPasswordResetOtp(dto: RequestPasswordResetOtpDto) {
    const email = dto.email.trim().toLowerCase();

    const resetRequest = await this.prisma.passwordResetOtp.findUnique({
      where: { email },
    });

    if (!resetRequest) {
      throw new NotFoundException('Start password reset first');
    }

    const now = new Date();
    if (now.getTime() - resetRequest.lastSentAt.getTime() < 30_000) {
      throw new HttpException(
        'Please wait 30 seconds before requesting another OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    await this.prisma.passwordResetOtp.update({
      where: { email },
      data: {
        otpHash: this.hashOtp(otp),
        otpExpiresAt: expiresAt,
        lastSentAt: now,
        attempts: 0,
      },
    });

    const delivery = await this.deliverOtpEmail({
      email,
      otp,
      subject: 'Your Venxa password reset code',
      heading: 'Reset your Venxa password',
      message: 'Enter this code and create a new password in the app. The code expires in 10 minutes.',
      logLabel: 'VENXA RESET OTP',
    });

    return {
      email,
      expiresAt,
      delivery,
      message:
        delivery === 'email'
          ? 'A new password reset code has been sent'
          : 'A new password reset OTP was generated in development mode',
      otpPreview: delivery === 'development' ? otp : null,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const otp = dto.otp.trim();

    const resetRequest = await this.prisma.passwordResetOtp.findUnique({
      where: { email },
    });

    if (!resetRequest) {
      throw new NotFoundException('Start password reset first');
    }

    if (resetRequest.otpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP expired. Please request a new one');
    }

    if (resetRequest.attempts >= 5) {
      throw new HttpException(
        'Too many invalid OTP attempts. Please request a new OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (this.hashOtp(otp) !== resetRequest.otpHash) {
      await this.prisma.passwordResetOtp.update({
        where: { email },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid OTP');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      await this.prisma.passwordResetOtp.delete({ where: { email } });
      throw new NotFoundException('This user is not registered');
    }

    await this.prisma.user.update({
      where: { email },
      data: {
        password: this.hashPassword(dto.newPassword),
      },
    });

    await this.prisma.passwordResetOtp.delete({
      where: { email },
    });

    return {
      success: true,
      message: 'Password reset successful',
    };
  }

  private generateOtp() {
    return String(randomInt(100000, 1_000_000));
  }

  private hashOtp(otp: string) {
    return createHash('sha256').update(otp).digest('hex');
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, storedPassword: string) {
    const [salt, storedHash] = storedPassword.split(':');
    const inputHash = scryptSync(password, salt, 64);
    const knownHash = Buffer.from(storedHash, 'hex');
    return timingSafeEqual(inputHash, knownHash);
  }

  private async deliverOtpEmail({
    email,
    otp,
    subject,
    heading,
    message,
    logLabel,
  }: {
    email: string;
    otp: string;
    subject: string;
    heading: string;
    message: string;
    logLabel: string;
  }): Promise<DeliveryMode> {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = Number(this.configService.get<string>('SMTP_PORT') || '587');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const smtpFrom = this.configService.get<string>('SMTP_FROM') || smtpUser;
    const smtpSecure =
      this.configService.get<string>('SMTP_SECURE') === 'true' || smtpPort === 465;

    if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
      console.log(`[${logLabel}][DEV] ${email} -> ${otp}`);
      return 'development';
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject,
        text: `${heading}: ${otp}. ${message}`,
        html: `
          <div style="font-family:Arial,sans-serif;background:#100b1a;color:#ffffff;padding:24px;">
            <div style="max-width:520px;margin:0 auto;background:#161623;border:1px solid #33313F;border-radius:18px;padding:28px;">
              <p style="margin:0 0 12px;font-size:14px;color:#bfc2ca;">${heading}</p>
              <h1 style="margin:0 0 18px;font-size:28px;letter-spacing:6px;">${otp}</h1>
              <p style="margin:0;color:#bfc2ca;font-size:14px;line-height:1.6;">
                ${message}
              </p>
            </div>
          </div>
        `,
      });

      return 'email';
    } catch (error) {
      console.error(`Failed to send OTP email for ${logLabel}`, error);
      throw new InternalServerErrorException('Unable to send OTP right now');
    }
  }

  private toAuthResponse(user: { id: string; email: string; name: string | null; createdAt: Date }) {
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      message: 'Authentication successful',
    };
  }
}
