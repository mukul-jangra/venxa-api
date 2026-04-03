import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { SendNotificationDto } from './dto/send-notification.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('devices/register')
  registerDevice(@Body() dto: RegisterDeviceDto) {
    return this.notificationsService.registerDevice(dto);
  }

  @Get('devices/:userId')
  listDevices(@Param('userId') userId: string) {
    return this.notificationsService.listDevices(userId);
  }

  @Get('users/:userId')
  listNotifications(@Param('userId') userId: string) {
    return this.notificationsService.listNotifications(userId);
  }

  @Patch('users/:userId/read-all')
  markAllRead(@Param('userId') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }

  @Delete(':id')
  deleteNotification(@Param('id') id: string) {
    return this.notificationsService.deleteNotification(id);
  }

  @Get('templates')
  listTemplates() {
    return this.notificationsService.listTemplates();
  }

  @Post('templates')
  createTemplate(@Body() dto: CreateNotificationTemplateDto) {
    return this.notificationsService.createTemplate(dto);
  }

  @Patch('templates/:id')
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateNotificationTemplateDto) {
    return this.notificationsService.updateTemplate(id, dto);
  }

  @Post('send')
  sendNotification(@Body() dto: SendNotificationDto) {
    return this.notificationsService.sendNotification(dto);
  }
}
