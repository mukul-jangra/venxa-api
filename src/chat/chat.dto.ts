import { IsOptional, IsString } from 'class-validator';

export class ChatMessageDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  agentName?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}

export class CreateConversationDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  agentName?: string;

  @IsOptional()
  @IsString()
  title?: string;
}
