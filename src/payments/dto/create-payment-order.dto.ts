import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class CreatePaymentOrderDto {
  @IsString()
  userId!: string;

  @IsString()
  agentId!: string;

  @IsString()
  planId!: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  customerName?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  @Length(8, 20)
  customerContact?: string;
}
