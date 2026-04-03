import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class TopUpWalletDto {
  @IsString()
  userId!: string;

  @IsNumber()
  @Min(50)
  @Max(50000)
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(['UPI', 'Card'])
  paymentMethod?: 'UPI' | 'Card';
}
