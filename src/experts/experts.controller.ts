import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ExpertsService } from './experts.service';
import { CreateExpertDto } from './dto/create-expert.dto';
import { UpdateExpertDto } from './dto/update-expert.dto';
import { StartExpertSessionDto } from './dto/start-expert-session.dto';
import { GetOrCreateExpertConversationDto } from './dto/get-or-create-expert-conversation.dto';
import { SendExpertChatMessageDto } from './dto/send-expert-chat-message.dto';
import { StartExpertChatDto } from './dto/start-expert-chat.dto';
import { ReviewExpertSessionDto } from './dto/review-expert-session.dto';

@Controller('experts')
export class ExpertsController {
  constructor(private readonly expertsService: ExpertsService) {}

  @Get()
  listExperts(
    @Query('agentId') agentId?: string,
    @Query('userId') userId?: string,
    @Query('agentCode') agentCode?: string,
  ) {
    return this.expertsService.listExperts(agentId, userId, agentCode);
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string) {
    return this.expertsService.getSession(id);
  }

  @Get('history/:userId')
  getUserHistory(@Param('userId') userId: string, @Query('agentCode') agentCode?: string) {
    return this.expertsService.getUserHistory(userId, agentCode);
  }

  @Post('conversations')
  getOrCreateConversation(@Body() dto: GetOrCreateExpertConversationDto) {
    return this.expertsService.getOrCreateConversation(dto);
  }

  @Get('conversations/user/:userId')
  getUserConversations(@Param('userId') userId: string, @Query('agentCode') agentCode?: string) {
    return this.expertsService.getUserConversations(userId, agentCode);
  }

  @Get('conversations/:conversationId/messages')
  getConversationMessages(@Param('conversationId') conversationId: string, @Query('userId') userId?: string) {
    return this.expertsService.getConversationMessages(conversationId, userId);
  }

  @Post('conversations/:conversationId/messages')
  sendConversationMessage(
    @Param('conversationId') conversationId: string,
    @Body() dto: SendExpertChatMessageDto,
  ) {
    return this.expertsService.sendConversationMessage(conversationId, dto);
  }

  @Post('chat-access')
  startChatAccess(@Body() dto: StartExpertChatDto) {
    return this.expertsService.startChatAccess(dto);
  }

  @Post('sessions/start')
  startSession(@Body() dto: StartExpertSessionDto) {
    return this.expertsService.startSession(dto);
  }

  @Post('sessions/:id/end')
  endSession(@Param('id') id: string) {
    return this.expertsService.endSession(id);
  }

  @Post('sessions/:id/review')
  reviewSession(@Param('id') id: string, @Body() dto: ReviewExpertSessionDto) {
    return this.expertsService.reviewSession(id, dto);
  }

  @Get(':id')
  getExpertById(@Param('id') id: string, @Query('userId') userId?: string) {
    return this.expertsService.getExpertById(id, userId);
  }

  @Post()
  createExpert(@Body() dto: CreateExpertDto) {
    return this.expertsService.createExpert(dto);
  }

  @Patch(':id')
  updateExpert(@Param('id') id: string, @Body() dto: UpdateExpertDto) {
    return this.expertsService.updateExpert(id, dto);
  }

  @Delete(':id')
  deleteExpert(@Param('id') id: string) {
    return this.expertsService.deleteExpert(id);
  }
}
