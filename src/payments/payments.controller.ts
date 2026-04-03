import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { TopUpWalletDto } from './dto/top-up-wallet.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('orders')
  createOrder(@Body() dto: CreatePaymentOrderDto) {
    return this.paymentsService.createOrder(dto);
  }

  @Post('verify')
  verifyPayment(@Body() dto: VerifyPaymentDto) {
    return this.paymentsService.verifyPayment(dto);
  }

  @Get('subscriptions/:userId')
  getSubscriptions(@Param('userId') userId: string) {
    return this.paymentsService.getSubscriptions(userId);
  }

  @Get('wallet/:userId')
  getWallet(@Param('userId') userId: string) {
    return this.paymentsService.getWallet(userId);
  }

  @Post('wallet/top-up')
  topUpWallet(@Body() dto: TopUpWalletDto) {
    return this.paymentsService.topUpWallet(dto);
  }

  @Get('admin/wallet-ledger')
  getWalletLedger(
    @Query('userId') userId?: string,
    @Query('agentCode') agentCode?: string,
    @Query('type') type?: 'CREDIT' | 'DEBIT',
  ) {
    return this.paymentsService.getWalletLedger({ userId, agentCode, type });
  }
}
