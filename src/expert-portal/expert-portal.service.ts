import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ExpertSessionStatus, ExpertStatus, ExpertTestStatus } from '@prisma/client';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ExpertLoginDto } from './dto/expert-login.dto';
import { ExpertSignupDto } from './dto/expert-signup.dto';
import { SendExpertPortalMessageDto } from './dto/send-expert-portal-message.dto';
import { SubmitExpertTestDto } from './dto/submit-expert-test.dto';
import { UpdateExpertProfileDto } from './dto/update-expert-profile.dto';

const TEST_QUESTIONS = [
  {
    id: 'astro-1',
    question: 'A client says Saturn mahadasha feels heavy. How would you explain it in a grounded and reassuring way?',
    keywords: ['saturn', 'discipline', 'karma', 'patience', 'growth'],
  },
  {
    id: 'astro-2',
    question: 'How do you combine chart reading with practical guidance instead of only giving predictions?',
    keywords: ['chart', 'guidance', 'practical', 'action', 'balance'],
  },
  {
    id: 'astro-3',
    question: 'What would you check first in a kundli for marriage timing and relationship stability?',
    keywords: ['7th house', 'venus', 'jupiter', 'dasha', 'relationship'],
  },
  {
    id: 'astro-4',
    question: 'If a user is anxious about the future, how would you answer with empathy and responsibility?',
    keywords: ['empathy', 'clarity', 'support', 'responsible', 'calm'],
  },
  {
    id: 'astro-5',
    question: 'Describe how you would explain transits to a beginner without overwhelming them.',
    keywords: ['transit', 'simple', 'timing', 'planet', 'easy'],
  },
] as const;

const MIN_REQUIRED_TEST_ANSWERS = 4;

@Injectable()
export class ExpertPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, storedPassword: string) {
    const [salt, storedHash] = storedPassword.split(':');
    if (!salt || !storedHash) return false;

    const inputHash = scryptSync(password, salt, 64);
    const storedBuffer = Buffer.from(storedHash, 'hex');
    return inputHash.length === storedBuffer.length && timingSafeEqual(inputHash, storedBuffer);
  }

  private createOtpLikeAvatar(seed: string) {
    return `https://i.pravatar.cc/300?u=${encodeURIComponent(`venxa-expert-${seed}`)}`;
  }

  private serializeExpert(expert: {
    id: string;
    email: string | null;
    name: string;
    role: string;
    phone: string | null;
    city: string | null;
    bio: string | null;
    languages: string[];
    specialties: string[];
    yearsExperience: number;
    pricePerMinute: number;
    avatarUrl: string | null;
    onboardingCompleted: boolean;
    testStatus: ExpertTestStatus;
    aiTestScore: number;
    status: ExpertStatus;
    isActive: boolean;
    createdAt: Date;
    agent: {
      id: string;
      code: string;
      name: string;
    };
  }) {
    return {
      id: expert.id,
      email: expert.email,
      name: expert.name,
      role: expert.role,
      phone: expert.phone,
      city: expert.city,
      bio: expert.bio,
      languages: expert.languages,
      specialties: expert.specialties,
      yearsExperience: expert.yearsExperience,
      pricePerMinute: expert.pricePerMinute,
      avatarUrl: expert.avatarUrl,
      onboardingCompleted: expert.onboardingCompleted,
      testStatus: expert.testStatus,
      aiTestScore: expert.aiTestScore,
      status: expert.status,
      isActive: expert.isActive,
      joinedAt: expert.createdAt,
      agent: expert.agent,
    };
  }

  private async getAstrologyAgent() {
    const astrologyAgent = await this.prisma.agent.findFirst({
      where: {
        OR: [{ code: 'ZENO' }, { domain: { contains: 'astro', mode: 'insensitive' } }],
      },
      orderBy: [{ code: 'asc' }],
    });

    if (!astrologyAgent) {
      throw new BadRequestException('Astrology agent is not configured yet');
    }

    return astrologyAgent;
  }

  private async createExpertNotification(expertId: string, title: string, body: string, type: string, metadata?: Record<string, unknown>) {
    const payload: Prisma.ExpertNotificationUncheckedCreateInput = {
      expertId,
      title,
      body,
      type,
      ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
    };

    return this.prisma.expertNotification.create({
      data: payload,
    });
  }

  private createUserAvatar(name: string, email: string) {
    const seed = createHash('sha1')
      .update(`${name}:${email}`)
      .digest('hex')
      .slice(0, 8);
    return `https://i.pravatar.cc/300?u=${encodeURIComponent(`venxa-user-${seed}`)}`;
  }

  private resolveUserName(user: {
    email: string;
    name: string | null;
    profile?: { fullName: string } | null;
  }) {
    return user.profile?.fullName?.trim() || user.name?.trim() || user.email.split('@')[0];
  }

  private buildConversationPreview(message: {
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
    status: ExpertSessionStatus;
    mode: 'CHAT' | 'CALL';
    ratePerMinute: number;
    purchasedMinutes: number;
    totalCost: number;
    startedAt: Date | null;
    endedAt: Date | null;
    createdAt: Date;
  }) {
    const expiresAt =
      session.mode === 'CHAT' && session.status === ExpertSessionStatus.ACTIVE
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
        session.mode === 'CHAT' && session.status === ExpertSessionStatus.ACTIVE && expiresAt
          ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000))
          : 0,
    };
  }

  private async syncChatSessionExpiry<T extends {
    id: string;
    mode: 'CHAT' | 'CALL';
    status: ExpertSessionStatus;
    purchasedMinutes: number;
    createdAt: Date;
    startedAt: Date | null;
    endedAt: Date | null;
    ratePerMinute: number;
    totalCost: number;
  } | null>(session: T): Promise<T> {
    if (!session || session.mode !== 'CHAT' || session.status !== ExpertSessionStatus.ACTIVE) {
      return session;
    }

    const expiresAt = this.getSessionExpiresAt(session);
    if (expiresAt.getTime() > Date.now()) {
      return session;
    }

    await this.prisma.expertSession.update({
      where: { id: session.id },
      data: {
        status: ExpertSessionStatus.COMPLETED,
        endedAt: expiresAt,
      },
    });

    return {
      ...session,
      status: ExpertSessionStatus.COMPLETED,
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

  private mapPortalConversationSummary(
    conversation: {
      id: string;
      title: string;
      createdAt: Date;
      updatedAt: Date;
      messages: Array<{
        text: string | null;
        imageUri: string | null;
        audioUri: string | null;
      }>;
      user: {
        id: string;
        email: string;
        name: string | null;
        profile: { fullName: string } | null;
      };
    },
    latestSession: {
      id: string;
      status: ExpertSessionStatus;
      mode: 'CHAT' | 'CALL';
      ratePerMinute: number;
      purchasedMinutes: number;
      totalCost: number;
      startedAt: Date | null;
      endedAt: Date | null;
      createdAt: Date;
    } | null,
  ) {
    const userName = this.resolveUserName(conversation.user);
    return {
      id: conversation.id,
      title: conversation.title,
      preview: this.buildConversationPreview(conversation.messages[0] ?? null),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      user: {
        id: conversation.user.id,
        name: userName,
        email: conversation.user.email,
        avatarUrl: this.createUserAvatar(userName, conversation.user.email),
      },
      latestSession: latestSession ? this.mapSessionSummary(latestSession) : null,
    };
  }

  async signup(dto: ExpertSignupDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.expert.findFirst({ where: { email } });

    if (existing) {
      throw new BadRequestException('Expert account already exists');
    }

    const agent = await this.getAstrologyAgent();
    const seed = createHash('sha1').update(email).digest('hex').slice(0, 8);

    const expert = await this.prisma.expert.create({
      data: {
        agentId: agent.id,
        email,
        password: this.hashPassword(dto.password),
        name: email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
        role: 'Astrologer',
        bio: '',
        specialties: [],
        aiRating: 4.5,
        aiTestScore: 0,
        testStatus: ExpertTestStatus.NOT_STARTED,
        pricePerMinute: 0,
        status: ExpertStatus.OFFLINE,
        languages: [],
        yearsExperience: 0,
        avatarUrl: this.createOtpLikeAvatar(seed),
        onboardingCompleted: false,
        isActive: false,
        sortOrder: 9999,
      },
      include: {
        agent: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    await this.createExpertNotification(
      expert.id,
      'Welcome to Venxa Astrologer',
      'Complete your profile, start the AI test, and get ready to receive real consultation requests.',
      'WELCOME',
    );

    return {
      expert: this.serializeExpert(expert),
    };
  }

  async login(dto: ExpertLoginDto) {
    const email = this.normalizeEmail(dto.email);
    const expert = await this.prisma.expert.findFirst({
      where: { email },
      include: {
        agent: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!expert || !expert.password) {
      throw new UnauthorizedException('This expert account is not registered');
    }

    if (!this.verifyPassword(dto.password, expert.password)) {
      throw new UnauthorizedException('Wrong password');
    }

    return {
      expert: this.serializeExpert(expert),
    };
  }

  async getProfile(expertId: string) {
    const expert = await this.prisma.expert.findUnique({
      where: { id: expertId },
      include: {
        agent: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!expert) {
      throw new NotFoundException('Expert not found');
    }

    return {
      expert: this.serializeExpert(expert),
    };
  }

  async updateProfile(expertId: string, dto: UpdateExpertProfileDto) {
    const expert = await this.prisma.expert.findUnique({ where: { id: expertId } });
    if (!expert) {
      throw new NotFoundException('Expert not found');
    }

    const updated = await this.prisma.expert.update({
      where: { id: expertId },
      data: {
        name: dto.fullName.trim(),
        phone: dto.phone?.trim() || null,
        city: dto.city?.trim() || null,
        bio: dto.bio?.trim() || null,
        languages: (dto.languages ?? []).map((item) => item.trim()).filter(Boolean),
        specialties: (dto.specialties ?? []).map((item) => item.trim()).filter(Boolean),
        yearsExperience: dto.yearsExperience,
        pricePerMinute: dto.pricePerMinute,
        avatarUrl: dto.avatarUrl?.trim() || expert.avatarUrl,
        onboardingCompleted: true,
      },
      include: {
        agent: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return {
      expert: this.serializeExpert(updated),
    };
  }

  async getTestQuestions(expertId: string) {
    const expert = await this.prisma.expert.findUnique({ where: { id: expertId } });
    if (!expert) {
      throw new NotFoundException('Expert not found');
    }

    if (!expert.onboardingCompleted) {
      throw new BadRequestException('Complete your profile before starting the AI test');
    }

    if (expert.testStatus === ExpertTestStatus.NOT_STARTED) {
      await this.prisma.expert.update({
        where: { id: expertId },
        data: { testStatus: ExpertTestStatus.IN_PROGRESS },
      });
    }

    return {
      questions: TEST_QUESTIONS.map(({ id, question }, index) => ({
        id,
        order: index + 1,
        question,
      })),
    };
  }

  private scoreAnswer(answer: string, keywords: readonly string[]) {
    const normalized = answer.trim().toLowerCase();
    const base = Math.min(8, Math.floor(normalized.length / 18));
    const keywordHits = keywords.reduce((total, keyword) => total + (normalized.includes(keyword.toLowerCase()) ? 1 : 0), 0);
    const coverage = Math.min(8, keywordHits * 2);
    const empathyBonus = /(guide|support|clarity|calm|practical|responsible|reassur)/.test(normalized) ? 4 : 0;
    return Math.min(20, base + coverage + empathyBonus);
  }

  async submitTest(expertId: string, dto: SubmitExpertTestDto) {
    const expert = await this.prisma.expert.findUnique({
      where: { id: expertId },
      include: {
        agent: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!expert) {
      throw new NotFoundException('Expert not found');
    }

    if (dto.answers.length < MIN_REQUIRED_TEST_ANSWERS) {
      throw new BadRequestException(`Please answer at least ${MIN_REQUIRED_TEST_ANSWERS} AI test questions`);
    }

    const usedQuestions = TEST_QUESTIONS.slice(0, Math.min(dto.answers.length, TEST_QUESTIONS.length));

    const transcript = usedQuestions.map((question, index) => ({
      id: question.id,
      question: question.question,
      answer: dto.answers[index]?.trim() || '',
    }));

    const rawScore = usedQuestions.reduce((total, question, index) => {
      return total + this.scoreAnswer(dto.answers[index] || '', question.keywords);
    }, 0);

    const scoreBase = usedQuestions.length * 20;
    const score = Math.max(0, Math.min(100, Math.round((rawScore / scoreBase) * 100)));
    const aiRecommendedPass = score >= 70;
    const passed = true;
    const now = new Date();

    await this.prisma.expertTestAttempt.create({
      data: {
        expertId,
        score,
        passed,
        transcript,
      },
    });

    const updated = await this.prisma.expert.update({
      where: { id: expertId },
      data: {
        aiTestScore: score,
        testStatus: ExpertTestStatus.PASSED,
        testCompletedAt: now,
        isActive: expert.onboardingCompleted,
      },
      include: {
        agent: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    await this.createExpertNotification(
      expertId,
      'AI test submitted',
      aiRecommendedPass
        ? `Great work — your preview score is ${score}/100. Live AI scoring is coming next, and your profile is unlocked for now.`
        : `Your preview score is ${score}/100. Live AI scoring is coming next, and your profile is unlocked for now.`,
      'TEST_RESULT',
      { score, passed, aiRecommendedPass, temporaryBypass: true },
    );

    return {
      score,
      passed,
      message: 'Your test is submitted. Live AI scoring will be connected next, so you can continue for now.',
      expert: this.serializeExpert(updated),
    };
  }

  async getDashboard(expertId: string) {
    const expert = await this.prisma.expert.findUnique({
      where: { id: expertId },
      include: {
        agent: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!expert) {
      throw new NotFoundException('Expert not found');
    }

    const [pendingRequests, revenueSessions, notifications] = await Promise.all([
      this.prisma.expertSession.findMany({
        where: {
          expertId,
          status: ExpertSessionStatus.PENDING,
        },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          agent: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      this.prisma.expertSession.findMany({
        where: {
          expertId,
          status: {
            in: [ExpertSessionStatus.ACTIVE, ExpertSessionStatus.COMPLETED],
          },
        },
        select: {
          totalCost: true,
          createdAt: true,
        },
      }),
      this.prisma.expertNotification.findMany({
        where: { expertId },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const todayKey = now.toDateString();

    const metrics = revenueSessions.reduce(
      (acc, session) => {
        acc.totalRevenue += session.totalCost;
        if (session.createdAt.toDateString() === todayKey) {
          acc.todayRevenue += session.totalCost;
        }
        if (`${session.createdAt.getFullYear()}-${session.createdAt.getMonth()}` === monthKey) {
          acc.monthRevenue += session.totalCost;
        }
        return acc;
      },
      { totalRevenue: 0, todayRevenue: 0, monthRevenue: 0 },
    );

    return {
      expert: this.serializeExpert(expert),
      revenue: {
        totalRevenue: metrics.totalRevenue,
        todayRevenue: metrics.todayRevenue,
        monthRevenue: metrics.monthRevenue,
        completedSessions: revenueSessions.length,
      },
      pendingRequests: pendingRequests.map((session) => ({
        id: session.id,
        mode: session.mode,
        status: session.status,
        createdAt: session.createdAt,
        userName:
          session.user.profile?.fullName?.trim() ||
          session.user.name?.trim() ||
          session.user.email.split('@')[0],
        userEmail: session.user.email,
        ratePerMinute: session.ratePerMinute,
        agent: session.agent,
      })),
      notifications: notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        type: notification.type,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      })),
      unreadNotificationCount: notifications.filter((notification) => !notification.readAt).length,
    };
  }

  async getChatHub(expertId: string) {
    const expert = await this.prisma.expert.findUnique({
      where: { id: expertId },
      include: {
        agent: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!expert) {
      throw new NotFoundException('Expert not found');
    }

    const [pendingRequests, revenueSessions, notifications, conversations] = await Promise.all([
      this.prisma.expertSession.findMany({
        where: {
          expertId,
          status: ExpertSessionStatus.PENDING,
        },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          agent: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.expertSession.findMany({
        where: {
          expertId,
          status: {
            in: [ExpertSessionStatus.ACTIVE, ExpertSessionStatus.COMPLETED],
          },
        },
        select: {
          totalCost: true,
          createdAt: true,
        },
      }),
      this.prisma.expertNotification.findMany({
        where: { expertId },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      this.prisma.expertConversation.findMany({
        where: { expertId },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const todayKey = now.toDateString();

    const revenue = revenueSessions.reduce(
      (acc, session) => {
        acc.totalRevenue += session.totalCost;
        if (session.createdAt.toDateString() === todayKey) {
          acc.todayRevenue += session.totalCost;
        }
        if (`${session.createdAt.getFullYear()}-${session.createdAt.getMonth()}` === monthKey) {
          acc.monthRevenue += session.totalCost;
        }
        return acc;
      },
      { totalRevenue: 0, todayRevenue: 0, monthRevenue: 0 },
    );

    const conversationIdByUser = new Map(conversations.map((item) => [item.userId, item.id]));

    const mappedConversations = await Promise.all(
      conversations.map(async (conversation) => {
        const latestSession = await this.getLatestChatSession(conversation.userId, conversation.expertId);
        return this.mapPortalConversationSummary(conversation, latestSession);
      }),
    );

    return {
      expert: this.serializeExpert(expert),
      revenue: {
        totalRevenue: revenue.totalRevenue,
        todayRevenue: revenue.todayRevenue,
        monthRevenue: revenue.monthRevenue,
        completedSessions: revenueSessions.length,
      },
      pendingRequests: pendingRequests.map((session) => {
        const userName = this.resolveUserName(session.user);
        return {
          id: session.id,
          mode: session.mode,
          status: session.status,
          createdAt: session.createdAt,
          ratePerMinute: session.ratePerMinute,
          conversationId: conversationIdByUser.get(session.userId) ?? null,
          user: {
            id: session.user.id,
            name: userName,
            email: session.user.email,
            avatarUrl: this.createUserAvatar(userName, session.user.email),
          },
          agent: session.agent,
        };
      }),
      conversations: mappedConversations,
      notifications: notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        type: notification.type,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      })),
      unreadNotificationCount: notifications.filter((notification) => !notification.readAt).length,
    };
  }

  async acceptRequest(expertId: string, sessionId: string) {
    const session = await this.prisma.expertSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        expert: {
          include: {
            agent: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!session || session.expertId !== expertId) {
      throw new NotFoundException('Request not found');
    }

    const activeSession =
      session.status === ExpertSessionStatus.PENDING
        ? await this.prisma.expertSession.update({
            where: { id: session.id },
            data: {
              status: ExpertSessionStatus.ACTIVE,
              startedAt: new Date(),
            },
          })
        : await this.syncChatSessionExpiry(session);

    const userName = this.resolveUserName(session.user);
    const conversation = await this.prisma.expertConversation.upsert({
      where: {
        userId_expertId: {
          userId: session.userId,
          expertId: session.expertId,
        },
      },
      update: {
        title: userName,
      },
      create: {
        userId: session.userId,
        expertId: session.expertId,
        agentId: session.agentId,
        title: userName,
        messages: {
          create: {
            sender: 'EXPERT',
            text: `Hi ${userName}, I’m here and ready to help you.`,
          },
        },
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.prisma.expert.update({
      where: { id: expertId },
      data: { status: ExpertStatus.BUSY },
    });

    if (session.status === ExpertSessionStatus.PENDING) {
      await this.notificationsService.createInAppNotification({
        userId: session.userId,
        title: `${session.expert.name} accepted your request`,
        body: `Your private chat with ${session.expert.name} is live now. You can continue the conversation in Venxa.`,
        channel: 'expert',
        type: 'expert_request_accepted',
        metadata: {
          expertId,
          sessionId: session.id,
          conversationId: conversation.id,
        },
      });
    }

    return {
      conversation: this.mapPortalConversationSummary(conversation, activeSession),
      detail: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        user: {
          id: session.user.id,
          name: userName,
          email: session.user.email,
          avatarUrl: this.createUserAvatar(userName, session.user.email),
        },
        messages: conversation.messages,
        latestSession: activeSession ? this.mapSessionSummary(activeSession) : null,
      },
    };
  }

  async getConversationDetail(expertId: string, conversationId: string) {
    const conversation = await this.prisma.expertConversation.findUnique({
      where: { id: conversationId },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation || conversation.expertId !== expertId) {
      throw new NotFoundException('Conversation not found');
    }

    const latestSession = await this.getLatestChatSession(conversation.userId, conversation.expertId);
    const userName = this.resolveUserName(conversation.user);

    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      user: {
        id: conversation.user.id,
        name: userName,
        email: conversation.user.email,
        avatarUrl: this.createUserAvatar(userName, conversation.user.email),
      },
      messages: conversation.messages,
      latestSession: latestSession ? this.mapSessionSummary(latestSession) : null,
    };
  }

  async sendConversationMessage(expertId: string, conversationId: string, dto: SendExpertPortalMessageDto) {
    const conversation = await this.prisma.expertConversation.findUnique({
      where: { id: conversationId },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        expert: true,
      },
    });

    if (!conversation || conversation.expertId !== expertId) {
      throw new NotFoundException('Conversation not found');
    }

    const hasPayload = Boolean(dto.text?.trim() || dto.imageUri || dto.audioUri);
    if (!hasPayload) {
      throw new BadRequestException('Message cannot be empty');
    }

    const latestSession = await this.getLatestChatSession(conversation.userId, conversation.expertId);
    if (!latestSession || latestSession.status !== ExpertSessionStatus.ACTIVE) {
      throw new BadRequestException('This chat session has ended. Wait for the next request to continue.');
    }

    const saved = await this.prisma.expertChatMessage.create({
      data: {
        conversationId,
        sender: 'EXPERT',
        text: dto.text?.trim() || null,
        imageUri: dto.imageUri || null,
        audioUri: dto.audioUri || null,
        audioDurationMs: dto.audioDurationMs ?? null,
      },
    });

    await this.notificationsService.createInAppNotification({
      userId: conversation.userId,
      title: `${conversation.expert.name} sent a message`,
      body:
        dto.text?.trim() ||
        (dto.imageUri ? 'You received an image from your expert.' : 'You received a voice note from your expert.'),
      channel: 'expert',
      type: 'expert_message',
      metadata: {
        conversationId,
        expertId,
      },
    });

    return {
      success: true,
      saved,
    };
  }

  async listNotifications(expertId: string) {
    const notifications = await this.prisma.expertNotification.findMany({
      where: { expertId },
      orderBy: { createdAt: 'desc' },
    });

    return notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    }));
  }

  async markNotificationRead(id: string) {
    const notification = await this.prisma.expertNotification.update({
      where: { id },
      data: {
        readAt: new Date(),
      },
    });

    return {
      id: notification.id,
      readAt: notification.readAt,
    };
  }
}
