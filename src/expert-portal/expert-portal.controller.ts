import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ExpertPortalService } from './expert-portal.service';
import { ExpertLoginDto } from './dto/expert-login.dto';
import { ExpertSignupDto } from './dto/expert-signup.dto';
import { SubmitExpertTestDto } from './dto/submit-expert-test.dto';
import { UpdateExpertProfileDto } from './dto/update-expert-profile.dto';
import { SendExpertPortalMessageDto } from './dto/send-expert-portal-message.dto';

@Controller('expert-portal')
export class ExpertPortalController {
  constructor(private readonly expertPortalService: ExpertPortalService) {}

  @Post('signup')
  signup(@Body() dto: ExpertSignupDto) {
    return this.expertPortalService.signup(dto);
  }

  @Post('login')
  login(@Body() dto: ExpertLoginDto) {
    return this.expertPortalService.login(dto);
  }

  @Get(':expertId/profile')
  getProfile(@Param('expertId') expertId: string) {
    return this.expertPortalService.getProfile(expertId);
  }

  @Patch(':expertId/profile')
  updateProfile(@Param('expertId') expertId: string, @Body() dto: UpdateExpertProfileDto) {
    return this.expertPortalService.updateProfile(expertId, dto);
  }

  @Get(':expertId/test/questions')
  getTestQuestions(@Param('expertId') expertId: string) {
    return this.expertPortalService.getTestQuestions(expertId);
  }

  @Post(':expertId/test/submit')
  submitTest(@Param('expertId') expertId: string, @Body() dto: SubmitExpertTestDto) {
    return this.expertPortalService.submitTest(expertId, dto);
  }

  @Get(':expertId/dashboard')
  getDashboard(@Param('expertId') expertId: string) {
    return this.expertPortalService.getDashboard(expertId);
  }

  @Get(':expertId/chat-hub')
  getChatHub(@Param('expertId') expertId: string) {
    return this.expertPortalService.getChatHub(expertId);
  }

  @Post(':expertId/requests/:sessionId/accept')
  acceptRequest(@Param('expertId') expertId: string, @Param('sessionId') sessionId: string) {
    return this.expertPortalService.acceptRequest(expertId, sessionId);
  }

  @Get(':expertId/conversations/:conversationId')
  getConversation(@Param('expertId') expertId: string, @Param('conversationId') conversationId: string) {
    return this.expertPortalService.getConversationDetail(expertId, conversationId);
  }

  @Post(':expertId/conversations/:conversationId/messages')
  sendConversationMessage(
    @Param('expertId') expertId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendExpertPortalMessageDto,
  ) {
    return this.expertPortalService.sendConversationMessage(expertId, conversationId, dto);
  }

  @Get(':expertId/notifications')
  getNotifications(@Param('expertId') expertId: string) {
    return this.expertPortalService.listNotifications(expertId);
  }

  @Patch('notifications/:id/read')
  markNotificationRead(@Param('id') id: string) {
    return this.expertPortalService.markNotificationRead(id);
  }
}
