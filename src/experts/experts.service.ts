import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateExpertDto } from './dto/create-expert.dto';
import { UpdateExpertDto } from './dto/update-expert.dto';
import { StartExpertSessionDto } from './dto/start-expert-session.dto';
import { GetOrCreateExpertConversationDto } from './dto/get-or-create-expert-conversation.dto';
import { SendExpertChatMessageDto } from './dto/send-expert-chat-message.dto';
import { StartExpertChatDto } from './dto/start-expert-chat.dto';
import { ReviewExpertSessionDto } from './dto/review-expert-session.dto';

@Injectable()
export class ExpertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private resolveExpertAvatarUrl(expert: {
    avatarUrl: string | null;
    avatarKey?: string | null;
    name: string;
  }) {
    if (expert.avatarUrl?.trim()) {
      return expert.avatarUrl.trim();
    }

    const fallbackSeed =
      expert.avatarKey?.trim() ||
      expert.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');

    return `https://i.pravatar.cc/300?u=${encodeURIComponent(`venxa-${fallbackSeed}`)}`;
  }

  private async hasActiveSubscription(userId: string, agentId: string) {
    const subscription = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        agentId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    return Boolean(subscription);
  }

  private buildExpertConversationPreview(message: {
    text: string | null;
    imageUri: string | null;
    audioUri: string | null;
  } | null) {
    if (!message) {
      return '';
    }

    if (message.text?.trim()) {
      return message.text.trim();
    }

    if (message.imageUri) {
      return 'Image shared';
    }

    if (message.audioUri) {
      return 'Voice note shared';
    }

    return '';
  }

  private async getReviewStatsByExpertIds(expertIds: string[]) {
    if (expertIds.length === 0) {
      return new Map<string, { average: number; count: number }>();
    }

    const reviews = await this.prisma.expertSession.findMany({
      where: {
        expertId: { in: expertIds },
        reviewRating: { not: null },
      },
      select: {
        expertId: true,
        reviewRating: true,
      },
    });

    const stats = new Map<string, { total: number; count: number }>();

    for (const review of reviews) {
      if (review.reviewRating == null) continue;
      const existing = stats.get(review.expertId) ?? { total: 0, count: 0 };
      existing.total += review.reviewRating;
      existing.count += 1;
      stats.set(review.expertId, existing);
    }

    return new Map(
      Array.from(stats.entries()).map(([expertId, value]) => [
        expertId,
        { average: Number((value.total / value.count).toFixed(1)), count: value.count },
      ]),
    );
  }

  private async getRecentReviews(expertId: string, limit = 5) {
    const reviews = await this.prisma.expertSession.findMany({
      where: {
        expertId,
        reviewRating: { not: null },
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: [{ reviewedAt: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
    });

    return reviews.map((review) => ({
      id: review.id,
      rating: review.reviewRating ?? 0,
      comment: review.reviewComment,
      reviewedAt: review.reviewedAt ?? review.updatedAt,
      reviewerName:
        review.user.profile?.fullName?.trim() ||
        review.user.name?.trim() ||
        review.user.email.split('@')[0],
    }));
  }

  private getSessionExpiresAt(session: {
    startedAt: Date | null;
    createdAt: Date;
    purchasedMinutes: number;
  }) {
    const baseTime = session.startedAt ?? session.createdAt;
    return new Date(baseTime.getTime() + session.purchasedMinutes * 60_000);
  }

  private mapSessionSummary(session: {
    id: string;
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    mode: 'CHAT' | 'CALL';
    ratePerMinute: number;
    purchasedMinutes: number;
    totalCost: number;
    startedAt: Date | null;
    endedAt: Date | null;
    createdAt: Date;
    reviewRating: number | null;
    reviewComment: string | null;
    reviewedAt: Date | null;
  }) {
    const expiresAt =
      session.mode === 'CHAT' && session.status === 'ACTIVE'
        ? this.getSessionExpiresAt(session)
        : session.endedAt;

    return {
      id: session.id,
      status: session.status,
      mode: session.mode,
      ratePerMinute: session.ratePerMinute,
      purchasedMinutes: session.purchasedMinutes,
      totalCost: session.totalCost,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      createdAt: session.createdAt,
      expiresAt,
      remainingSeconds:
        session.mode === 'CHAT' && session.status === 'ACTIVE' && expiresAt
          ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000))
          : 0,
      reviewRating: session.reviewRating,
      reviewComment: session.reviewComment,
      reviewedAt: session.reviewedAt,
    };
  }

  private async syncChatSessionExpiry<T extends {
    id: string;
    userId: string;
    expertId: string;
    agentId: string;
    mode: 'CHAT' | 'CALL';
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    ratePerMinute: number;
    purchasedMinutes: number;
    totalCost: number;
    startedAt: Date | null;
    endedAt: Date | null;
    createdAt: Date;
    reviewRating: number | null;
    reviewComment: string | null;
    reviewedAt: Date | null;
  } | null>(session: T): Promise<T> {
    if (!session || session.mode !== 'CHAT' || session.status !== 'ACTIVE') {
      return session;
    }

    const expiresAt = this.getSessionExpiresAt(session);
    if (expiresAt.getTime() > Date.now()) {
      return session;
    }

    await this.prisma.expertSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        endedAt: expiresAt,
      },
    });

    return {
      ...session,
      status: 'COMPLETED',
      endedAt: expiresAt,
    } as T;
  }

  private async getLatestChatSession(userId: string, expertId: string) {
    const session = await this.prisma.expertSession.findFirst({
      where: {
        userId,
        expertId,
        mode: 'CHAT',
      },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return this.syncChatSessionExpiry(session);
  }

  private mapExpertResponse(
    expert: {
      id: string;
      name: string;
      role: string;
      bio: string | null;
      aiRating: number;
      aiTestScore: number;
      rating: number;
      pricePerMinute: number;
      status: 'ONLINE' | 'BUSY' | 'OFFLINE';
      languages: string[];
      yearsExperience: number;
      avatarKey: string | null;
      avatarUrl: string | null;
      isActive: boolean;
      sortOrder: number;
      agentId: string;
      agent: {
        id: string;
        code: string;
        name: string;
        domain: string;
        role: string;
      };
    },
    subscribedAgentIds: Set<string>,
    userId?: string,
    reviewStats?: { average: number; count: number },
    reviews?: Array<{
      id: string;
      rating: number;
      comment: string | null;
      reviewedAt: Date;
      reviewerName: string;
    }>,
  ) {
    const minimumMinutesRequired = 1;
    const effectiveUserRating = reviewStats?.count ? reviewStats.average : 0;

    return {
      id: expert.id,
      name: expert.name,
      role: expert.role,
      bio: expert.bio,
      aiRating: expert.aiRating,
      aiTestScore: expert.aiTestScore,
      rating: effectiveUserRating,
      reviewCount: reviewStats?.count ?? 0,
      pricePerMinute: expert.pricePerMinute,
      status: expert.status,
      languages: expert.languages,
      yearsExperience: expert.yearsExperience,
      avatarKey: expert.avatarKey,
      avatarUrl: this.resolveExpertAvatarUrl(expert),
      isActive: expert.isActive,
      sortOrder: expert.sortOrder,
      minimumMinutesRequired,
      minimumBalanceRequired: expert.pricePerMinute * minimumMinutesRequired,
      canConsult: userId ? subscribedAgentIds.has(expert.agentId) : false,
      requiresSubscription: true,
      agent: {
        id: expert.agent.id,
        code: expert.agent.code,
        name: expert.agent.name,
        domain: expert.agent.domain,
        role: expert.agent.role,
      },
      reviews: reviews ?? [],
    };
  }

  async listExperts(agentId?: string, userId?: string, agentCode?: string) {
    const experts = await this.prisma.expert.findMany({
      where: {
        isActive: true,
        ...(agentId ? { agentId } : {}),
        agent: {
          ...(agentCode ? { code: agentCode } : {}),
          isActive: true,
        },
      },
      include: {
        agent: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const reviewStats = await this.getReviewStatsByExpertIds(experts.map((expert) => expert.id));

    let walletBalance: number | null = null;
    let subscribedAgentIds = new Set<string>();

    if (userId) {
      const [settings, subscriptions] = await Promise.all([
        this.prisma.userSettings.findUnique({ where: { userId } }),
        this.prisma.userSubscription.findMany({
          where: {
            userId,
            status: 'ACTIVE',
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: { agentId: true },
        }),
      ]);

      walletBalance = settings?.walletBalance ?? 0;
      subscribedAgentIds = new Set(subscriptions.map((item) => item.agentId));
    }

    return {
      walletBalance,
      subscribedAgentIds: Array.from(subscribedAgentIds),
      experts: experts.map((expert) =>
        this.mapExpertResponse(expert, subscribedAgentIds, userId, reviewStats.get(expert.id)),
      ),
    };
  }

  async getExpertById(id: string, userId?: string) {
    const expert = await this.prisma.expert.findUnique({
      where: { id },
      include: {
        agent: true,
      },
    });

    if (!expert || !expert.isActive || !expert.agent.isActive) {
      throw new NotFoundException('Expert not found');
    }

    let subscribedAgentIds = new Set<string>();

    if (userId) {
      const subscriptions = await this.prisma.userSubscription.findMany({
        where: {
          userId,
          status: 'ACTIVE',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { agentId: true },
      });
      subscribedAgentIds = new Set(subscriptions.map((item) => item.agentId));
    }

    const [reviewStats, reviews] = await Promise.all([
      this.getReviewStatsByExpertIds([expert.id]),
      this.getRecentReviews(expert.id),
    ]);

    return this.mapExpertResponse(
      expert,
      subscribedAgentIds,
      userId,
      reviewStats.get(expert.id),
      reviews,
    );
  }

  async getUserHistory(userId: string, agentCode?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.userSubscription.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
        expiresAt: {
          lte: new Date(),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    const [subscriptions, sessions] = await Promise.all([
      this.prisma.userSubscription.findMany({
        where: {
          userId,
          status: 'ACTIVE',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: {
          agentId: true,
        },
      }),
      this.prisma.expertSession.findMany({
        where: {
          userId,
          ...(agentCode
            ? {
                agent: {
                  code: agentCode,
                },
              }
            : {}),
        },
        include: {
          expert: {
            include: {
              agent: true,
            },
          },
          agent: true,
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    const subscribedAgentIds = new Set(subscriptions.map((item) => item.agentId));
    const groupedHistory = new Map<
      string,
      {
          expert: {
            id: string;
            name: string;
            role: string;
            status: 'ONLINE' | 'BUSY' | 'OFFLINE';
            rating: number;
            pricePerMinute: number;
            languages: string[];
            yearsExperience: number;
            avatarUrl: string | null;
            agent: {
              id: string;
              code: string;
            name: string;
            domain: string;
          };
        };
        canConsult: boolean;
        sessionsCount: number;
        completedSessions: number;
        totalSpent: number;
        lastSession: {
          id: string;
          status: string;
          mode: string;
          createdAt: Date;
          updatedAt: Date;
          totalCost: number;
        };
      }
    >();

    for (const session of sessions) {
      const existing = groupedHistory.get(session.expertId);

      if (!existing) {
        groupedHistory.set(session.expertId, {
          expert: {
            id: session.expert.id,
            name: session.expert.name,
            role: session.expert.role,
            status: session.expert.status,
            rating: session.expert.rating,
            pricePerMinute: session.expert.pricePerMinute,
            languages: session.expert.languages,
            yearsExperience: session.expert.yearsExperience,
            avatarUrl: this.resolveExpertAvatarUrl(session.expert),
            agent: {
              id: session.agent.id,
              code: session.agent.code,
              name: session.agent.name,
              domain: session.agent.domain,
            },
          },
          canConsult: subscribedAgentIds.has(session.agentId),
          sessionsCount: 1,
          completedSessions: session.status === 'COMPLETED' ? 1 : 0,
          totalSpent: session.totalCost,
          lastSession: {
            id: session.id,
            status: session.status,
            mode: session.mode,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            totalCost: session.totalCost,
          },
        });
        continue;
      }

      existing.sessionsCount += 1;
      existing.completedSessions += session.status === 'COMPLETED' ? 1 : 0;
      existing.totalSpent += session.totalCost;
    }

    const experts = Array.from(groupedHistory.values()).sort(
      (left, right) =>
        new Date(right.lastSession.updatedAt).getTime() - new Date(left.lastSession.updatedAt).getTime(),
    );

    return {
      summary: {
        totalExperts: experts.length,
        totalSessions: sessions.length,
        activeRequests: sessions.filter((session) => session.status === 'PENDING').length,
      },
      experts,
    };
  }

  async getOrCreateConversation(dto: GetOrCreateExpertConversationDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const expert = await this.prisma.expert.findUnique({
      where: { id: dto.expertId },
      include: {
        agent: true,
      },
    });

    if (!expert || !expert.isActive || !expert.agent.isActive) {
      throw new NotFoundException('Expert not found');
    }

    const canConsult = await this.hasActiveSubscription(user.id, expert.agentId);
    const latestSession = await this.getLatestChatSession(user.id, expert.id);

    const existingConversation = await this.prisma.expertConversation.findUnique({
      where: {
        userId_expertId: {
          userId: user.id,
          expertId: expert.id,
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        expert: {
          include: {
            agent: true,
          },
        },
      },
    });

    if (existingConversation) {
      return {
        id: existingConversation.id,
        title: existingConversation.title,
        canConsult,
        expert: {
          id: existingConversation.expert.id,
          name: existingConversation.expert.name,
          role: existingConversation.expert.role,
          status: existingConversation.expert.status,
          pricePerMinute: existingConversation.expert.pricePerMinute,
          avatarUrl: this.resolveExpertAvatarUrl(existingConversation.expert),
          agent: {
            id: existingConversation.expert.agent.id,
            code: existingConversation.expert.agent.code,
            name: existingConversation.expert.agent.name,
            domain: existingConversation.expert.agent.domain,
          },
        },
        messages: existingConversation.messages,
        latestSession: latestSession ? this.mapSessionSummary(latestSession) : null,
      };
    }

    if (!canConsult) {
      throw new BadRequestException('Active subscription required to start this expert chat');
    }

    const greeting =
      (user.profile?.fullName || user.name || user.email.split('@')[0]).trim();

    const conversation = await this.prisma.expertConversation.create({
      data: {
        userId: user.id,
        expertId: expert.id,
        agentId: expert.agentId,
        title: expert.name,
        messages: {
          create: {
            sender: 'EXPERT',
            text: `Hi ${greeting}, how can I help you today?`,
          },
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        expert: {
          include: {
            agent: true,
          },
        },
      },
    });

    return {
      id: conversation.id,
      title: conversation.title,
      canConsult,
      expert: {
        id: conversation.expert.id,
        name: conversation.expert.name,
        role: conversation.expert.role,
        status: conversation.expert.status,
        pricePerMinute: conversation.expert.pricePerMinute,
        avatarUrl: this.resolveExpertAvatarUrl(conversation.expert),
        agent: {
          id: conversation.expert.agent.id,
          code: conversation.expert.agent.code,
          name: conversation.expert.agent.name,
          domain: conversation.expert.agent.domain,
        },
      },
      messages: conversation.messages,
      latestSession: latestSession ? this.mapSessionSummary(latestSession) : null,
    };
  }

  async getUserConversations(userId: string, agentCode?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const conversations = await this.prisma.expertConversation.findMany({
      where: {
        userId,
        ...(agentCode
          ? {
              agent: {
                code: agentCode,
              },
            }
          : {}),
      },
      include: {
        expert: {
          include: {
            agent: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const canConsultByAgent = new Map<string, boolean>();

    for (const conversation of conversations) {
      if (!canConsultByAgent.has(conversation.agentId)) {
        canConsultByAgent.set(
          conversation.agentId,
          await this.hasActiveSubscription(userId, conversation.agentId),
        );
      }
    }

    return Promise.all(
      conversations.map(async (conversation) => {
        const latestSession = await this.getLatestChatSession(conversation.userId, conversation.expertId);

        return {
          id: conversation.id,
          title: conversation.title,
          preview: this.buildExpertConversationPreview(conversation.messages[0] ?? null),
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          canConsult: canConsultByAgent.get(conversation.agentId) ?? false,
          latestSession: latestSession ? this.mapSessionSummary(latestSession) : null,
          expert: {
            id: conversation.expert.id,
            name: conversation.expert.name,
            role: conversation.expert.role,
            status: conversation.expert.status,
            pricePerMinute: conversation.expert.pricePerMinute,
            avatarUrl: this.resolveExpertAvatarUrl(conversation.expert),
            agent: {
              id: conversation.expert.agent.id,
              code: conversation.expert.agent.code,
              name: conversation.expert.agent.name,
              domain: conversation.expert.agent.domain,
            },
          },
        };
      }),
    );
  }

  async getConversationMessages(conversationId: string, userId?: string) {
    const conversation = await this.prisma.expertConversation.findUnique({
      where: { id: conversationId },
      include: {
        expert: {
          include: {
            agent: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Expert conversation not found');
    }

    if (userId && conversation.userId !== userId) {
      throw new BadRequestException('This conversation does not belong to the user');
    }

    const canConsult = userId ? await this.hasActiveSubscription(userId, conversation.agentId) : false;
    const latestSession = userId ? await this.getLatestChatSession(userId, conversation.expertId) : null;

    return {
      id: conversation.id,
      title: conversation.title,
      canConsult,
      expert: {
        id: conversation.expert.id,
        name: conversation.expert.name,
        role: conversation.expert.role,
        status: conversation.expert.status,
        pricePerMinute: conversation.expert.pricePerMinute,
        avatarUrl: this.resolveExpertAvatarUrl(conversation.expert),
        agent: {
          id: conversation.expert.agent.id,
          code: conversation.expert.agent.code,
          name: conversation.expert.agent.name,
          domain: conversation.expert.agent.domain,
        },
      },
      messages: conversation.messages,
      latestSession: latestSession ? this.mapSessionSummary(latestSession) : null,
    };
  }

  async sendConversationMessage(conversationId: string, dto: SendExpertChatMessageDto) {
    const conversation = await this.prisma.expertConversation.findUnique({
      where: { id: conversationId },
      include: {
        expert: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Expert conversation not found');
    }

    if (conversation.userId !== dto.userId) {
      throw new BadRequestException('This conversation does not belong to the user');
    }

    const hasPayload = Boolean(dto.text?.trim() || dto.imageUri || dto.audioUri);
    if (!hasPayload) {
      throw new BadRequestException('Message cannot be empty');
    }

    const canConsult = await this.hasActiveSubscription(dto.userId, conversation.agentId);
    if (!canConsult) {
      throw new BadRequestException('Your plan has expired. Please renew to continue this expert chat.');
    }

    const latestSession = await this.getLatestChatSession(dto.userId, conversation.expertId);
    if (!latestSession || latestSession.status !== 'ACTIVE') {
      throw new BadRequestException('Your chat time is over. Start chatting again to continue talking to this expert.');
    }

    const saved = await this.prisma.expertChatMessage.create({
      data: {
        conversationId,
        sender: 'USER',
        text: dto.text?.trim() || null,
        imageUri: dto.imageUri || null,
        audioUri: dto.audioUri || null,
        audioDurationMs: dto.audioDurationMs ?? null,
      },
    });

    await this.prisma.expertConversation.update({
      where: { id: conversationId },
      data: {
        title: conversation.expert.name,
      },
    });

    return {
      success: true,
      saved,
    };
  }

  async startChatAccess(dto: StartExpertChatDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { settings: true, profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const expert = await this.prisma.expert.findUnique({
      where: { id: dto.expertId },
      include: { agent: true },
    });

    if (!expert || !expert.isActive || !expert.agent.isActive) {
      throw new NotFoundException('Expert not available');
    }

    const canConsult = await this.hasActiveSubscription(user.id, expert.agentId);
    if (!canConsult) {
      throw new BadRequestException('Active subscription required to talk to this expert');
    }

    const currentBalance = user.settings?.walletBalance ?? 0;
    const existingSession = await this.getLatestChatSession(user.id, expert.id);

    if (existingSession && existingSession.status === 'ACTIVE') {
      return {
        success: true,
        chargedAmount: 0,
        balance: currentBalance,
        transaction: null,
        expert: {
          id: expert.id,
          name: expert.name,
          role: expert.role,
        },
        session: this.mapSessionSummary(existingSession),
      };
    }

    if (currentBalance < expert.pricePerMinute) {
      throw new BadRequestException('Insufficient wallet balance for this expert chat');
    }

    const nextBalance = currentBalance - expert.pricePerMinute;

    await this.prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {
        walletBalance: nextBalance,
      },
      create: {
        userId: user.id,
        walletBalance: nextBalance,
        focusAreas: ['Career', 'Mental Health'],
      },
    });

    const transaction = await this.prisma.walletTransaction.create({
      data: {
        userId: user.id,
        type: 'DEBIT',
        status: 'COMPLETED',
        amount: expert.pricePerMinute,
        balanceAfter: nextBalance,
        description: `Expert chat started with ${expert.name}`,
        referenceType: 'EXPERT_CHAT_ACCESS',
        referenceId: expert.id,
        metadata: {
          expertId: expert.id,
          agentId: expert.agentId,
          ratePerMinute: expert.pricePerMinute,
          chargedMinutes: 1,
          source: 'mobile-app',
        },
      },
    });

    const session = await this.prisma.expertSession.create({
      data: {
        userId: user.id,
        expertId: expert.id,
        agentId: expert.agentId,
        status: 'ACTIVE',
        mode: 'CHAT',
        ratePerMinute: expert.pricePerMinute,
        purchasedMinutes: 1,
        totalCost: expert.pricePerMinute,
        startedAt: new Date(),
      },
    });

    return {
      success: true,
      chargedAmount: expert.pricePerMinute,
      balance: nextBalance,
      transaction: {
        id: transaction.id,
        createdAt: transaction.createdAt,
      },
      expert: {
        id: expert.id,
        name: expert.name,
        role: expert.role,
      },
      session: this.mapSessionSummary(session),
    };
  }

  async startSession(dto: StartExpertSessionDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { settings: true, profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const expert = await this.prisma.expert.findUnique({
      where: { id: dto.expertId },
      include: { agent: true },
    });

    if (!expert || !expert.isActive) {
      throw new NotFoundException('Expert not available');
    }

    const subscription = await this.prisma.userSubscription.findFirst({
      where: {
        userId: dto.userId,
        agentId: expert.agentId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new BadRequestException('Active subscription required to talk to this expert');
    }

    const walletBalance = user.settings?.walletBalance ?? 0;
    if (walletBalance < expert.pricePerMinute) {
      throw new BadRequestException('Insufficient wallet balance for this expert session');
    }

    const session = await this.prisma.expertSession.create({
      data: {
        userId: user.id,
        expertId: expert.id,
        agentId: expert.agentId,
        status: 'PENDING',
        mode: (dto.mode?.trim().toUpperCase() as 'CHAT' | 'CALL' | undefined) ?? 'CHAT',
        ratePerMinute: expert.pricePerMinute,
      },
      include: {
        expert: true,
        agent: true,
      },
    });

    await this.notificationsService.createInAppNotification({
      userId: user.id,
      title: `${expert.name} request sent`,
      body: `Your ${expert.agent.name} consultation request is now pending. We’ll update you as soon as the expert responds.`,
      channel: 'expert',
      type: 'expert_request',
      metadata: {
        source: 'expert-request',
        expertId: expert.id,
        sessionId: session.id,
        agentId: expert.agentId,
      },
    });

    await this.prisma.expertNotification.create({
      data: {
        expertId: expert.id,
        title: 'New consultation request',
        body: `${user.profile?.fullName?.trim() || user.name?.trim() || user.email.split('@')[0]} wants to start a ${session.mode.toLowerCase()} session with you.`,
        type: 'CONSULTATION_REQUEST',
        metadata: {
          sessionId: session.id,
          userId: user.id,
          mode: session.mode,
          agentId: expert.agentId,
        },
      },
    });

    return {
      message: 'Expert consultation request created',
      session: {
        id: session.id,
        status: session.status,
        mode: session.mode,
        ratePerMinute: session.ratePerMinute,
        startedAt: session.startedAt,
        expert: {
          id: session.expert.id,
          name: session.expert.name,
          role: session.expert.role,
        },
        agent: {
          id: session.agent.id,
          code: session.agent.code,
          name: session.agent.name,
        },
      },
      walletBalance,
      subscription: {
        id: subscription.id,
        planTitle: subscription.plan.title,
        expiresAt: subscription.expiresAt,
      },
    };
  }

  async getSession(sessionId: string) {
    const rawSession = await this.prisma.expertSession.findUnique({
      where: { id: sessionId },
      include: {
        expert: true,
        agent: true,
      },
    });

    if (!rawSession) {
      throw new NotFoundException('Expert session not found');
    }

    const session = (await this.syncChatSessionExpiry(rawSession))!;

    return {
      ...this.mapSessionSummary(session),
      expert: {
        id: session.expert.id,
        name: session.expert.name,
        role: session.expert.role,
        status: session.expert.status,
      },
      agent: {
        id: session.agent.id,
        code: session.agent.code,
        name: session.agent.name,
        domain: session.agent.domain,
      },
    };
  }

  async endSession(sessionId: string) {
    const rawSession = await this.prisma.expertSession.findUnique({
      where: { id: sessionId },
      include: {
        expert: true,
        agent: true,
        user: {
          include: {
            settings: true,
          },
        },
      },
    });

    if (!rawSession) {
      throw new NotFoundException('Expert session not found');
    }

    const session = (await this.syncChatSessionExpiry(rawSession))!;

    if (session.mode === 'CHAT') {
      const now = new Date();
      if (session.status === 'ACTIVE') {
        await this.prisma.expertSession.update({
          where: { id: session.id },
          data: {
            status: 'COMPLETED',
            endedAt: now,
          },
        });
      }

      const completedSession =
        session.status === 'ACTIVE'
          ? ({
              ...session,
              status: 'COMPLETED',
              endedAt: now,
            } as typeof session)
          : session;

      return {
        message: 'Expert chat completed',
        session: this.mapSessionSummary(completedSession),
        billing: {
          elapsedMinutes: completedSession.purchasedMinutes,
          billedMinutes: completedSession.purchasedMinutes,
          remainingBalance: session.user.settings?.walletBalance ?? 0,
          expertName: session.expert.name,
          agentName: session.agent.name,
        },
      };
    }

    if (session.status !== 'ACTIVE') {
      throw new BadRequestException('Only active sessions can be ended');
    }

    const now = new Date();
    const startedAt = session.startedAt ?? session.createdAt;
    const elapsedMs = Math.max(now.getTime() - startedAt.getTime(), 0);
    const elapsedMinutes = Math.max(1, Math.ceil(elapsedMs / 60000));
    const walletBalance = session.user.settings?.walletBalance ?? 0;
    const affordableMinutes = Math.floor(walletBalance / session.ratePerMinute);

    if (affordableMinutes <= 0) {
      throw new BadRequestException('Insufficient wallet balance to bill this expert session');
    }

    const billedMinutes = Math.min(elapsedMinutes, affordableMinutes);
    const totalCost = billedMinutes * session.ratePerMinute;
    const remainingBalance = walletBalance - totalCost;

    await this.prisma.userSettings.upsert({
      where: { userId: session.userId },
      update: { walletBalance: remainingBalance },
      create: {
        userId: session.userId,
        walletBalance: remainingBalance,
        focusAreas: ['Career', 'Mental Health'],
      },
    });

    await this.prisma.walletTransaction.create({
      data: {
        userId: session.userId,
        type: 'DEBIT',
        status: 'COMPLETED',
        amount: totalCost,
        balanceAfter: remainingBalance,
        description: `Expert ${session.mode.toLowerCase()} with ${session.expert.name}`,
        referenceType: 'EXPERT_SESSION',
        referenceId: session.id,
        metadata: {
          expertId: session.expertId,
          agentId: session.agentId,
          elapsedMinutes,
          billedMinutes,
          ratePerMinute: session.ratePerMinute,
        },
      },
    });

    const updatedSession = await this.prisma.expertSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        endedAt: now,
        totalCost,
      },
    });

    return {
      message: 'Expert session completed',
      session: {
        id: updatedSession.id,
        status: updatedSession.status,
        mode: updatedSession.mode,
        ratePerMinute: updatedSession.ratePerMinute,
        startedAt: updatedSession.startedAt,
        endedAt: updatedSession.endedAt,
        totalCost: updatedSession.totalCost,
      },
      billing: {
        elapsedMinutes,
        billedMinutes,
        remainingBalance,
        expertName: session.expert.name,
        agentName: session.agent.name,
      },
    };
  }

  async reviewSession(sessionId: string, dto: ReviewExpertSessionDto) {
    const session = await this.prisma.expertSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Expert session not found');
    }

    if (session.mode !== 'CHAT') {
      throw new BadRequestException('Reviews are only enabled for expert chats right now');
    }

    if (session.status !== 'COMPLETED' && session.status !== 'CANCELLED') {
      throw new BadRequestException('You can review the expert after the chat ends');
    }

    const updated = await this.prisma.expertSession.update({
      where: { id: sessionId },
      data: {
        reviewRating: dto.rating,
        reviewComment: dto.comment?.trim() || null,
        reviewedAt: new Date(),
      },
    });

    return {
      success: true,
      review: {
        rating: updated.reviewRating,
        comment: updated.reviewComment,
        reviewedAt: updated.reviewedAt,
      },
    };
  }

  async createExpert(dto: CreateExpertDto) {
    await this.ensureAgent(dto.agentId);

    return this.prisma.expert.create({
      data: {
        agentId: dto.agentId,
        name: dto.name.trim(),
        role: dto.role.trim(),
        bio: dto.bio?.trim() || null,
        aiRating: dto.aiRating ?? 4.5,
        aiTestScore: dto.aiTestScore ?? 85,
        rating: dto.rating ?? 4.5,
        pricePerMinute: dto.pricePerMinute,
        status: (dto.status?.trim().toUpperCase() as 'ONLINE' | 'BUSY' | 'OFFLINE' | undefined) ?? 'ONLINE',
        languages: dto.languages?.map((item) => item.trim()).filter(Boolean) || [],
        yearsExperience: dto.yearsExperience ?? 1,
        avatarKey: dto.avatarKey?.trim() || null,
        avatarUrl: dto.avatarUrl?.trim() || null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        agent: true,
      },
    });
  }

  async updateExpert(id: string, dto: UpdateExpertDto) {
    const existing = await this.prisma.expert.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Expert not found');
    }

    if (dto.agentId) {
      await this.ensureAgent(dto.agentId);
    }

    return this.prisma.expert.update({
      where: { id },
      data: {
        ...(dto.agentId !== undefined ? { agentId: dto.agentId } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.role !== undefined ? { role: dto.role.trim() } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio.trim() || null } : {}),
        ...(dto.aiRating !== undefined ? { aiRating: dto.aiRating } : {}),
        ...(dto.aiTestScore !== undefined ? { aiTestScore: dto.aiTestScore } : {}),
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
        ...(dto.pricePerMinute !== undefined ? { pricePerMinute: dto.pricePerMinute } : {}),
        ...(dto.status !== undefined
          ? { status: dto.status.trim().toUpperCase() as 'ONLINE' | 'BUSY' | 'OFFLINE' }
          : {}),
        ...(dto.languages !== undefined
          ? { languages: dto.languages.map((item) => item.trim()).filter(Boolean) }
          : {}),
        ...(dto.yearsExperience !== undefined ? { yearsExperience: dto.yearsExperience } : {}),
        ...(dto.avatarKey !== undefined ? { avatarKey: dto.avatarKey.trim() || null } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: {
        agent: true,
      },
    });
  }

  async deleteExpert(id: string) {
    const existing = await this.prisma.expert.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Expert not found');
    }

    await this.prisma.expert.delete({ where: { id } });
    return { success: true };
  }

  private async ensureAgent(agentId: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    return agent;
  }
}
