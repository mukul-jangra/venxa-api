import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatMessageDto, CreateConversationDto } from './chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async send(@Body() body: ChatMessageDto) {
    return this.chatService.sendMessage(body);
  }

  @Post('conversations')
  async createConversation(@Body() body: CreateConversationDto) {
    return this.chatService.createConversation(body);
  }

  @Get('conversations/:userId')
  async listConversations(@Param('userId') userId: string) {
    return this.chatService.listConversations(userId);
  }

  @Get('conversations/:conversationId/messages')
  async getConversationMessages(@Param('conversationId') conversationId: string) {
    return this.chatService.getConversationMessages(conversationId);
  }

  @Get('recent')
  async recent() {
    return this.chatService.listRecent();
  }
}
