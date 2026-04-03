import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { SendNotificationDto } from './dto/send-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async registerDevice(dto: RegisterDeviceDto) {
    await this.ensureUser(dto.userId);

    const device = await this.prisma.userNotificationDevice.upsert({
      where: { expoPushToken: dto.expoPushToken },
      update: {
        userId: dto.userId,
        platform: dto.platform,
        deviceName: dto.deviceName?.trim() || null,
        appVersion: dto.appVersion?.trim() || null,
        projectId: dto.projectId?.trim() || null,
        isActive: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId: dto.userId,
        expoPushToken: dto.expoPushToken.trim(),
        platform: dto.platform.trim(),
        deviceName: dto.deviceName?.trim() || null,
        appVersion: dto.appVersion?.trim() || null,
        projectId: dto.projectId?.trim() || null,
        isActive: true,
      },
    });

    await this.ensureWelcomeNotification(dto.userId);

    return device;
  }

  async listDevices(userId: string) {
    await this.ensureUser(userId);
    return this.prisma.userNotificationDevice.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listNotifications(userId: string) {
    await this.ensureUser(userId);
    await this.ensureWelcomeNotification(userId);
    return this.prisma.userNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAllRead(userId: string) {
    await this.ensureUser(userId);

    const result = await this.prisma.userNotification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
        status: 'DELIVERED',
      },
    });

    return {
      success: true,
      updatedCount: result.count,
    };
  }

  async markRead(id: string) {
    const notification = await this.prisma.userNotification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.userNotification.update({
      where: { id },
      data: {
        readAt: notification.readAt ?? new Date(),
        status: notification.status === 'PENDING' ? 'DELIVERED' : notification.status,
      },
    });
  }

  async deleteNotification(id: string) {
    const notification = await this.prisma.userNotification.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.userNotification.delete({
      where: { id },
    });

    return {
      success: true,
      id,
    };
  }

  async listTemplates() {
    return this.prisma.notificationTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createTemplate(dto: CreateNotificationTemplateDto) {
    return this.prisma.notificationTemplate.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        title: dto.title.trim(),
        body: dto.body.trim(),
        channel: dto.channel?.trim() || 'general',
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateTemplate(id: string, dto: UpdateNotificationTemplateDto) {
    const template = await this.prisma.notificationTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException('Notification template not found');
    }

    return this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.body !== undefined ? { body: dto.body.trim() } : {}),
        ...(dto.channel !== undefined ? { channel: dto.channel.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async sendNotification(dto: SendNotificationDto) {
    await this.ensureUser(dto.userId);
    const now = new Date();

    return this.prisma.userNotification.create({
      data: {
        userId: dto.userId,
        templateId: dto.templateId || null,
        title: dto.title.trim(),
        body: dto.body.trim(),
        type: dto.type?.trim() || 'manual',
        channel: dto.channel?.trim() || 'general',
        status: 'DELIVERED',
        sentAt: now,
        deliveredAt: now,
        metadata: {
          source: 'admin-or-backend',
          deliveryProvider: 'in-app',
        },
      },
    });
  }

  async createInAppNotification(params: {
    userId: string;
    title: string;
    body: string;
    channel?: string;
    type?: string;
    metadata?: Record<string, unknown> | null;
  }) {
    await this.ensureUser(params.userId);

    const now = new Date();

    return this.prisma.userNotification.create({
      data: {
        userId: params.userId,
        title: params.title.trim(),
        body: params.body.trim(),
        type: params.type?.trim() || 'system',
        channel: params.channel?.trim() || 'general',
        status: 'DELIVERED',
        sentAt: now,
        deliveredAt: now,
        metadata: (params.metadata ?? {
          source: 'backend-event',
          deliveryProvider: 'in-app',
        }) as Prisma.InputJsonValue,
      },
    });
  }

  async ensureWelcomeNotification(userId: string) {
    await this.ensureUser(userId);

    const existingWelcome = await this.prisma.userNotification.findFirst({
      where: {
        userId,
        type: 'welcome',
      },
      select: { id: true },
    });

    if (existingWelcome) {
      return existingWelcome;
    }

    return this.createInAppNotification({
      userId,
      title: 'Welcome to Venxa',
      body: 'Thanks for downloading Venxa. Explore domain-specific AI, connect with trusted experts, and start your first guided conversation.',
      channel: 'general',
      type: 'welcome',
      metadata: {
        source: 'app-download',
        deliveryProvider: 'in-app',
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
}
