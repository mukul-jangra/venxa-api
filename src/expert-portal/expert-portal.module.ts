import { Module } from '@nestjs/common';
import { ExpertPortalController } from './expert-portal.controller';
import { ExpertPortalService } from './expert-portal.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [ExpertPortalController],
  providers: [ExpertPortalService],
  exports: [ExpertPortalService],
})
export class ExpertPortalModule {}
