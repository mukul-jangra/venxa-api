import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  paymentOrderId!: string;

  @IsString()
  razorpayOrderId!: string;

  @IsOptional()
  @IsString()
  razorpayPaymentId?: string;

  @IsOptional()
  @IsString()
  razorpaySignature?: string;

  @IsOptional()
  @IsBoolean()
  mockSuccess?: boolean;
}
