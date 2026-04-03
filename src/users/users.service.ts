import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers() {
    const users = await this.prisma.user.findMany({
      include: {
        profile: true,
        settings: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => this.serializeUser(user));
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, settings: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.serializeUser(user);
  }

  async getPrivacySummary(userId: string) {
    await this.ensureUser(userId);

    const [conversations, messages, subscriptions, notifications, privacyRequests] = await Promise.all([
      this.prisma.chatConversation.count({ where: { userId } }),
      this.prisma.chatMessage.count({ where: { userId } }),
      this.prisma.userSubscription.count({ where: { userId } }),
      this.prisma.userNotification.count({ where: { userId } }),
      this.prisma.privacyRequest.count({ where: { userId } }),
    ]);

    return {
      conversations,
      messages,
      subscriptions,
      notifications,
      privacyRequests,
    };
  }

  async listPrivacyRequests(userId: string) {
    await this.ensureUser(userId);

    return this.prisma.privacyRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async updateProfile(userId: string, dto: UpdateUserProfileDto) {
    await this.ensureUser(userId);

    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      update: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.dateOfBirth !== undefined ? { dateOfBirth: dto.dateOfBirth.trim() || null } : {}),
        ...(dto.timeOfBirth !== undefined ? { timeOfBirth: dto.timeOfBirth.trim() || null } : {}),
        ...(dto.placeOfBirth !== undefined ? { placeOfBirth: dto.placeOfBirth.trim() || null } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender.trim() || null } : {}),
        ...(dto.relationshipStatus !== undefined
          ? { relationshipStatus: dto.relationshipStatus.trim() || null }
          : {}),
        ...(dto.birthDetailsVerified !== undefined
          ? { birthDetailsVerified: dto.birthDetailsVerified }
          : {}),
      },
      create: {
        userId,
        fullName: dto.fullName?.trim() || '',
        dateOfBirth: dto.dateOfBirth?.trim() || null,
        timeOfBirth: dto.timeOfBirth?.trim() || null,
        placeOfBirth: dto.placeOfBirth?.trim() || null,
        gender: dto.gender?.trim() || null,
        relationshipStatus: dto.relationshipStatus?.trim() || null,
        birthDetailsVerified: dto.birthDetailsVerified ?? false,
      },
    });

    return profile;
  }

  async updateSettings(userId: string, dto: UpdateUserSettingsDto) {
    await this.ensureUser(userId);

    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      update: {
        ...dto,
        ...(dto.focusAreas ? { focusAreas: dto.focusAreas.map((item) => item.trim()).filter(Boolean) } : {}),
      },
      create: {
        userId,
        focusAreas: dto.focusAreas?.map((item) => item.trim()).filter(Boolean) || ['Career', 'Mental Health'],
        themeChoice: dto.themeChoice ?? 'system',
        ...dto,
      },
    });

    return settings;
  }

  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        settings: true,
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
        subscriptions: {
          include: {
            agent: true,
            plan: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        paymentOrders: {
          orderBy: { createdAt: 'desc' },
        },
        notificationDevices: true,
        notifications: {
          orderBy: { createdAt: 'desc' },
        },
        privacyRequests: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const request = await this.prisma.privacyRequest.create({
      data: {
        userId,
        type: 'EXPORT_DATA',
        status: 'COMPLETED',
        processedAt: new Date(),
        details: {
          exportedAt: new Date().toISOString(),
          exportSections: [
            'profile',
            'settings',
            'conversations',
            'subscriptions',
            'payments',
            'notifications',
          ],
        },
      },
    });

    return {
      request,
      export: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        profile: user.profile,
        settings: user.settings,
        conversations: user.conversations,
        subscriptions: user.subscriptions,
        paymentOrders: user.paymentOrders,
        notificationDevices: user.notificationDevices,
        notifications: user.notifications,
        privacyRequests: user.privacyRequests,
      },
    };
  }

  async clearChatHistory(userId: string) {
    await this.ensureUser(userId);

    const deleted = await this.prisma.chatConversation.deleteMany({
      where: { userId },
    });

    const request = await this.prisma.privacyRequest.create({
      data: {
        userId,
        type: 'CLEAR_CHAT_HISTORY',
        status: 'COMPLETED',
        processedAt: new Date(),
        details: {
          deletedConversations: deleted.count,
        },
      },
    });

    return {
      success: true,
      deletedConversations: deleted.count,
      request,
    };
  }

  async requestAccountDeletion(userId: string) {
    await this.ensureUser(userId);

    return this.prisma.privacyRequest.create({
      data: {
        userId,
        type: 'DELETE_ACCOUNT',
        status: 'PENDING',
        details: {
          requestedAt: new Date().toISOString(),
          source: 'mobile-app',
        },
      },
    });
  }

  private async ensureUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private serializeUser(user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
    profile: any;
    settings: any;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      profile: user.profile,
      settings: user.settings,
    };
  }
}
