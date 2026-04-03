import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ChatModule } from './chat/chat.module';
import { AuthModule } from './auth/auth.module';
import { AgentsModule } from './agents/agents.module';
import { PaymentsModule } from './payments/payments.module';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ExpertsModule } from './experts/experts.module';
import { ExpertPortalModule } from './expert-portal/expert-portal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ChatModule,
    AgentsModule,
    PaymentsModule,
    UsersModule,
    NotificationsModule,
    ExpertsModule,
    ExpertPortalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
