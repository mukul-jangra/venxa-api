import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, randomUUID } from 'crypto';
import Razorpay from 'razorpay';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { TopUpWalletDto } from './dto/top-up-wallet.dto';

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getWalletLedger(filters?: {
    userId?: string;
    agentCode?: string;
    type?: 'CREDIT' | 'DEBIT';
  }) {
    const transactions = await this.prisma.walletTransaction.findMany({
      where: {
        ...(filters?.userId ? { userId: filters.userId } : {}),
        ...(filters?.type ? { type: filters.type } : {}),
      },
      include: {
        user: {
          include: {
            profile: true,
            settings: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 300,
    });

    const agentIds = Array.from(
      new Set(
        transactions
          .map((transaction) => {
            const metadata =
              transaction.metadata && typeof transaction.metadata === 'object' && !Array.isArray(transaction.metadata)
                ? (transaction.metadata as Record<string, unknown>)
                : null;
            return typeof metadata?.agentId === 'string' ? metadata.agentId : null;
          })
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const agents = agentIds.length
      ? await this.prisma.agent.findMany({
          where: {
            id: {
              in: agentIds,
            },
          },
          select: {
            id: true,
            code: true,
            name: true,
            domain: true,
          },
        })
      : [];

    const agentMap = new Map(agents.map((agent) => [agent.id, agent]));

    const ledgerItems = transactions
      .map((transaction) => {
        const metadata =
          transaction.metadata && typeof transaction.metadata === 'object' && !Array.isArray(transaction.metadata)
            ? (transaction.metadata as Record<string, unknown>)
            : null;
        const agentId = typeof metadata?.agentId === 'string' ? metadata.agentId : null;
        const agent = agentId ? agentMap.get(agentId) ?? null : null;

        return {
          id: transaction.id,
          userId: transaction.userId,
          userEmail: transaction.user.email,
          userName: transaction.user.profile?.fullName || transaction.user.name || transaction.user.email,
          type: transaction.type,
          status: transaction.status,
          amount: transaction.amount,
          balanceAfter: transaction.balanceAfter,
          description: transaction.description,
          referenceType: transaction.referenceType,
          referenceId: transaction.referenceId,
          paymentMethod:
            typeof metadata?.paymentMethod === 'string'
              ? metadata.paymentMethod
              : transaction.type === 'CREDIT'
                ? transaction.user.settings?.paymentMethod ?? null
                : null,
          source: typeof metadata?.source === 'string' ? metadata.source : null,
          agent: agent
            ? {
                id: agent.id,
                code: agent.code,
                name: agent.name,
                domain: agent.domain,
              }
            : null,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt,
        };
      })
      .filter((transaction) => {
        if (!filters?.agentCode) {
          return true;
        }

        return transaction.agent?.code === filters.agentCode;
      });

    const totalAdded = ledgerItems
      .filter((item) => item.type === 'CREDIT')
      .reduce((sum, item) => sum + item.amount, 0);
    const totalUsed = ledgerItems
      .filter((item) => item.type === 'DEBIT')
      .reduce((sum, item) => sum + item.amount, 0);
    const uniqueUsers = new Set(ledgerItems.map((item) => item.userId)).size;

    return {
      summary: {
        totalTransactions: ledgerItems.length,
        totalAdded,
        totalUsed,
        uniqueUsers,
      },
      transactions: ledgerItems,
    };
  }

  async createOrder(dto: CreatePaymentOrderDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const agent = await this.prisma.agent.findUnique({
      where: { id: dto.agentId },
    });

    if (!agent || !agent.isActive) {
      throw new NotFoundException('Agent not available');
    }

    const plan = await this.prisma.agentPlan.findFirst({
      where: {
        id: dto.planId,
        agentId: dto.agentId,
        isActive: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const currentSubscription = await this.getCurrentAgentSubscription(user.id, agent.id);
    this.assertPlanPurchaseAllowed(plan, currentSubscription?.plan);

    const amount = plan.price * 100;
    const receipt = this.buildReceipt(plan.id);
    const mode = this.isMockMode() ? 'mock' : 'razorpay';
    const customerName = dto.customerName?.trim() || user.name || 'Venxa User';
    const customerEmail = dto.customerEmail?.trim().toLowerCase() || user.email;
    const customerContact = dto.customerContact?.trim() || undefined;

    const providerOrder = this.isMockMode()
      ? this.createMockProviderOrder(amount, receipt)
      : await this.createRazorpayOrder(amount, receipt, agent.name, plan.title, customerEmail);

    const paymentOrder = await this.prisma.paymentOrder.create({
      data: {
        userId: user.id,
        agentId: agent.id,
        planId: plan.id,
        receipt,
        amount,
        currency: providerOrder.currency,
        status: 'CREATED',
        provider: 'RAZORPAY',
        providerOrderId: providerOrder.id,
        customerName,
        customerEmail,
        customerContact,
        notes: {
          agentCode: agent.code,
          agentName: agent.name,
          planTitle: plan.title,
          mode,
        },
      },
    });

    return {
      paymentOrderId: paymentOrder.id,
      mode,
      keyId: this.isMockMode() ? 'rzp_test_mock_venxa' : process.env.RAZORPAY_KEY_ID,
      amount: providerOrder.amount,
      currency: providerOrder.currency,
      providerOrderId: providerOrder.id,
      receipt: providerOrder.receipt,
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
      },
      plan: {
        id: plan.id,
        title: plan.title,
        price: plan.price,
        description: plan.description,
      },
      customer: {
        name: customerName,
        email: customerEmail,
        contact: customerContact,
      },
    };
  }

  async verifyPayment(dto: VerifyPaymentDto) {
    const paymentOrder = await this.prisma.paymentOrder.findUnique({
      where: { id: dto.paymentOrderId },
      include: {
        plan: true,
      },
    });

    if (!paymentOrder) {
      throw new NotFoundException('Payment order not found');
    }

    if (paymentOrder.providerOrderId !== dto.razorpayOrderId) {
      throw new BadRequestException('Order mismatch detected');
    }

    const isMock = this.isMockMode();
    const signatureValid = isMock
      ? dto.mockSuccess === true
      : this.isPaymentSignatureValid(dto.razorpayOrderId, dto.razorpayPaymentId, dto.razorpaySignature);

    if (!signatureValid) {
      await this.prisma.paymentOrder.update({
        where: { id: paymentOrder.id },
        data: {
          status: 'FAILED',
          providerPaymentId: dto.razorpayPaymentId,
          providerSignature: dto.razorpaySignature,
        },
      });
      throw new BadRequestException('Payment verification failed');
    }

    const updatedPayment = await this.prisma.paymentOrder.update({
      where: { id: paymentOrder.id },
      data: {
        status: 'PAID',
        providerPaymentId: dto.razorpayPaymentId || `pay_mock_${randomUUID().slice(0, 12)}`,
        providerSignature: dto.razorpaySignature || 'mock_signature_verified',
        verifiedAt: new Date(),
      },
    });

    const expiresAt = this.calculateExpiryDate(paymentOrder.plan.durationDays);

    const subscription = await this.prisma.$transaction(async (tx) => {
      const nextSubscription = await tx.userSubscription.upsert({
        where: {
          paymentOrderId: paymentOrder.id,
        },
        update: {
          status: 'ACTIVE',
          amountPaid: paymentOrder.amount,
          currency: paymentOrder.currency,
          startedAt: new Date(),
          expiresAt,
        },
        create: {
          userId: paymentOrder.userId!,
          agentId: paymentOrder.agentId,
          planId: paymentOrder.planId,
          paymentOrderId: paymentOrder.id,
          status: 'ACTIVE',
          amountPaid: paymentOrder.amount,
          currency: paymentOrder.currency,
          expiresAt,
        },
        include: {
          agent: true,
          plan: true,
        },
      });

      await tx.userSubscription.updateMany({
        where: {
          userId: paymentOrder.userId!,
          agentId: paymentOrder.agentId,
          status: 'ACTIVE',
          id: {
            not: nextSubscription.id,
          },
        },
        data: {
          status: 'CANCELLED',
          expiresAt: new Date(),
        },
      });

      return nextSubscription;
    });

    await this.notificationsService.createInAppNotification({
      userId: paymentOrder.userId!,
      title: `${subscription.plan.title} is now active`,
      body: `Your ${subscription.agent.name} subscription is live${subscription.expiresAt ? ` until ${subscription.expiresAt.toLocaleDateString('en-IN')}` : ''}.`,
      channel: 'plan',
      type: 'subscription',
      metadata: {
        source: 'payment',
        agentId: subscription.agent.id,
        planId: subscription.plan.id,
        paymentOrderId: paymentOrder.id,
      },
    });

    return {
      success: true,
      payment: {
        id: updatedPayment.id,
        amount: updatedPayment.amount,
        currency: updatedPayment.currency,
        status: updatedPayment.status,
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        agentName: subscription.agent.name,
        planTitle: subscription.plan.title,
        expiresAt: subscription.expiresAt,
      },
    };
  }

  async getSubscriptions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const subscriptions = await this.getNormalizedActiveSubscriptions(userId);

    return subscriptions.map((subscription) => ({
      id: subscription.id,
      status: subscription.status,
      startedAt: subscription.startedAt,
      amountPaid: subscription.amountPaid,
      currency: subscription.currency,
      agent: {
        id: subscription.agent.id,
        code: subscription.agent.code,
        name: subscription.agent.name,
        role: subscription.agent.role,
        domain: subscription.agent.domain,
        personality: subscription.agent.personality,
        totalExperts: subscription.agent.totalExperts,
        iconKey: subscription.agent.iconKey,
      },
      plan: {
        id: subscription.plan.id,
        title: subscription.plan.title,
        price: subscription.plan.price,
        description: subscription.plan.description,
        durationDays: subscription.plan.durationDays,
        sortOrder: subscription.plan.sortOrder,
      },
      expiresAt: subscription.expiresAt,
    }));
  }

  async getWallet(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        settings: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const transactions = await this.prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      balance: user.settings?.walletBalance ?? 0,
      autoRecharge: user.settings?.autoRecharge ?? false,
      autoRechargeThreshold: user.settings?.autoRechargeThreshold ?? 0,
      autoRechargeAmount: user.settings?.autoRechargeAmount ?? 0,
      paymentMethod: user.settings?.paymentMethod ?? 'UPI',
      config: {
        minTopUpAmount: 50,
        maxTopUpAmount: 50000,
        suggestedAmounts: [100, 500, 1000, 2000],
        paymentMethods: ['UPI', 'Card'],
      },
      transactions,
    };
  }

  async topUpWallet(dto: TopUpWalletDto) {
    const normalizedAmount = Math.round(Number(dto.amount));

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new BadRequestException('Enter a valid wallet amount');
    }

    if (normalizedAmount < 50) {
      throw new BadRequestException('Minimum wallet top-up is ₹50');
    }

    if (normalizedAmount > 50000) {
      throw new BadRequestException('Maximum wallet top-up is ₹50,000');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { settings: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentBalance = user.settings?.walletBalance ?? 0;
    const nextBalance = currentBalance + normalizedAmount;
    const normalizedMethod =
      dto.paymentMethod?.trim() === 'Card' ? 'Card' : 'UPI';

    const settings = await this.prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {
        walletBalance: nextBalance,
        paymentMethod: normalizedMethod,
      },
      create: {
        userId: user.id,
        walletBalance: nextBalance,
        paymentMethod: normalizedMethod,
        focusAreas: ['Career', 'Mental Health'],
      },
    });

    const transaction = await this.prisma.walletTransaction.create({
      data: {
        userId: user.id,
        type: 'CREDIT',
        status: 'COMPLETED',
        amount: normalizedAmount,
        balanceAfter: nextBalance,
        description: dto.description?.trim() || 'Wallet top-up',
        referenceType: 'WALLET_TOP_UP',
        metadata: {
          paymentMethod: normalizedMethod || settings.paymentMethod,
          source: 'mobile-app',
        },
      },
    });

    await this.notificationsService.createInAppNotification({
      userId: user.id,
      title: `₹${normalizedAmount} added to wallet`,
      body: `Your wallet top-up via ${normalizedMethod} was successful. Available balance is now ₹${nextBalance}.`,
      channel: 'wallet',
      type: 'wallet_top_up',
      metadata: {
        source: 'wallet-top-up',
        amount: normalizedAmount,
        paymentMethod: normalizedMethod,
        balanceAfter: nextBalance,
      },
    });

    return {
      success: true,
      message: `₹${normalizedAmount} added to wallet`,
      balance: nextBalance,
      transaction,
    };
  }

  private async createRazorpayOrder(
    amount: number,
    receipt: string,
    agentName: string,
    planTitle: string,
    customerEmail: string,
  ): Promise<RazorpayOrderResponse> {
    const instance = this.getRazorpayInstance();

    const order = await instance.orders.create({
      amount,
      currency: 'INR',
      receipt,
      notes: {
        agentName,
        planTitle,
        customerEmail,
      },
    });

    return {
      id: order.id,
      amount: typeof order.amount === 'string' ? Number(order.amount) : order.amount,
      currency: order.currency,
      receipt: order.receipt || receipt,
      status: order.status,
    };
  }

  private createMockProviderOrder(amount: number, receipt: string): RazorpayOrderResponse {
    return {
      id: `order_mock_${randomUUID().replace(/-/g, '').slice(0, 18)}`,
      amount,
      currency: 'INR',
      receipt,
      status: 'created',
    };
  }

  private buildReceipt(planId: string) {
    const shortPlanId = planId.slice(0, 10);
    return `venxa_${shortPlanId}_${Date.now()}`.slice(0, 40);
  }

  private calculateExpiryDate(durationDays: number) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);
    return expiresAt;
  }

  private async syncExpiredSubscriptions(userId: string, agentId?: string) {
    await this.prisma.userSubscription.updateMany({
      where: {
        userId,
        ...(agentId ? { agentId } : {}),
        status: 'ACTIVE',
        expiresAt: {
          lte: new Date(),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });
  }

  private comparePlanTier(
    left: { sortOrder: number; price: number },
    right: { sortOrder: number; price: number },
  ) {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.price - right.price;
  }

  private assertPlanPurchaseAllowed(
    requestedPlan: { id: string; title: string; sortOrder: number; price: number },
    currentPlan?: { id: string; title: string; sortOrder: number; price: number } | null,
  ) {
    if (!currentPlan) {
      return;
    }

    if (currentPlan.id === requestedPlan.id) {
      throw new BadRequestException(
        `Your ${requestedPlan.title} plan is already active. You can buy it again after it expires.`,
      );
    }

    if (this.comparePlanTier(requestedPlan, currentPlan) <= 0) {
      throw new BadRequestException(
        `You already have ${currentPlan.title}. You can only upgrade to a higher plan while it is active.`,
      );
    }
  }

  private async getCurrentAgentSubscription(userId: string, agentId: string) {
    await this.syncExpiredSubscriptions(userId, agentId);

    const subscriptions = await this.prisma.userSubscription.findMany({
      where: {
        userId,
        agentId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        agent: true,
        plan: true,
      },
    });

    if (subscriptions.length === 0) {
      return null;
    }

    const sorted = [...subscriptions].sort((left, right) => {
      const tierDiff = this.comparePlanTier(right.plan, left.plan);
      if (tierDiff !== 0) {
        return tierDiff;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

    const [current, ...duplicates] = sorted;

    if (duplicates.length > 0) {
      await this.prisma.userSubscription.updateMany({
        where: {
          id: {
            in: duplicates.map((subscription) => subscription.id),
          },
        },
        data: {
          status: 'CANCELLED',
          expiresAt: new Date(),
        },
      });
    }

    return current;
  }

  private async getNormalizedActiveSubscriptions(userId: string) {
    await this.syncExpiredSubscriptions(userId);

    const subscriptions = await this.prisma.userSubscription.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        agent: true,
        plan: true,
      },
    });

    if (subscriptions.length === 0) {
      return [];
    }

    const byAgent = new Map<string, (typeof subscriptions)[number]>();
    const duplicates: string[] = [];

    for (const subscription of [...subscriptions].sort((left, right) => {
      if (left.agentId !== right.agentId) {
        return left.agentId.localeCompare(right.agentId);
      }

      const tierDiff = this.comparePlanTier(right.plan, left.plan);
      if (tierDiff !== 0) {
        return tierDiff;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })) {
      if (!byAgent.has(subscription.agentId)) {
        byAgent.set(subscription.agentId, subscription);
      } else {
        duplicates.push(subscription.id);
      }
    }

    if (duplicates.length > 0) {
      await this.prisma.userSubscription.updateMany({
        where: {
          id: {
            in: duplicates,
          },
        },
        data: {
          status: 'CANCELLED',
          expiresAt: new Date(),
        },
      });
    }

    return Array.from(byAgent.values()).sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }

  private isMockMode() {
    return process.env.RAZORPAY_USE_MOCK !== 'false';
  }

  private getRazorpayInstance() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new BadRequestException('Razorpay keys are not configured');
    }

    return new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  private isPaymentSignatureValid(orderId: string, paymentId?: string, signature?: string) {
    if (!paymentId || !signature) {
      return false;
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new BadRequestException('Razorpay secret is not configured');
    }

    const generatedSignature = createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return generatedSignature === signature;
  }
}
