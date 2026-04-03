import { Injectable, NotFoundException } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { ChatMessageDto, CreateConversationDto } from './chat.dto';

@Injectable()
export class ChatService {
  private readonly openai: OpenAI | null;
  private readonly model: string;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.OPENAI_MODEL || 'gpt-5-mini';
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async createConversation(dto: CreateConversationDto) {
    return this.prisma.chatConversation.create({
      data: {
        userId: dto.userId,
        agentName: dto.agentName?.trim() || null,
        title: dto.title?.trim() || 'New chat',
      },
    });
  }

  async listConversations(userId: string) {
    const conversations = await this.prisma.chatConversation.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      agentName: conversation.agentName,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      preview: conversation.messages[0]?.text ?? '',
    }));
  }

  async getConversationMessages(conversationId: string) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return {
      id: conversation.id,
      title: conversation.title,
      agentName: conversation.agentName,
      messages: conversation.messages,
    };
  }

  async sendMessage(dto: ChatMessageDto) {
    const conversationId = await this.resolveConversationId(dto);

    const userMessage = await this.prisma.chatMessage.create({
      data: {
        text: dto.text,
        role: 'USER',
        userId: dto.userId ?? null,
        conversationId,
      },
    });

    const replyText = await this.generateReply(dto);

    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        text: replyText,
        role: 'ASSISTANT',
        userId: dto.userId ?? null,
        conversationId,
      },
    });

    if (conversationId) {
      await this.prisma.chatConversation.update({
        where: { id: conversationId },
        data: {
          agentName: dto.agentName?.trim() || undefined,
          title: await this.buildConversationTitle(conversationId, dto.text),
        },
      });
    }

    return {
      conversationId,
      saved: userMessage,
      reply: replyText,
      assistant: assistantMessage,
    };
  }

  async listRecent(limit = 20) {
    return this.prisma.chatMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async generateReply(dto: ChatMessageDto) {
    if (!this.openai) {
      return 'The AI service is not configured on the backend yet. Add a working OpenAI API key and we can continue.';
    }

    const recentMessages = dto.userId
      ? await this.prisma.chatMessage.findMany({
          where: dto.conversationId
            ? { conversationId: dto.conversationId }
            : { userId: dto.userId },
          orderBy: { createdAt: 'desc' },
          take: 8,
        })
      : [];

    const orderedHistory = [...recentMessages].reverse();
    const instructions = this.getAgentInstructions(dto.agentName);

    try {
      const response = await this.openai.responses.create({
        model: this.model,
        instructions,
        input: [
          ...orderedHistory.map((message) => ({
            role: message.role === 'USER' ? ('user' as const) : ('assistant' as const),
            content: [{ type: 'input_text' as const, text: message.text }],
          })),
          {
            role: 'user' as const,
            content: [{ type: 'input_text' as const, text: dto.text }],
          },
        ],
      });

      return (
        response.output_text?.trim() ||
        'I understand you. Please tell me a little more so I can guide you better.'
      );
    } catch (error) {
      if (this.isQuotaError(error)) {
        return 'The AI reply service is connected, but this OpenAI project has no remaining quota right now. Please add billing or share a fresh active API key, and then I can start returning real AI answers here.';
      }

      if (error instanceof Error) {
        return `The AI service is temporarily unavailable: ${error.message}`;
      }

      return 'The AI service is temporarily unavailable right now. Please try again in a moment.';
    }
  }

  private isQuotaError(error: unknown) {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const maybeError = error as { code?: string; status?: number; type?: string };
    return (
      maybeError.code === 'insufficient_quota' ||
      maybeError.type === 'insufficient_quota' ||
      maybeError.status === 429
    );
  }

  private getAgentInstructions(agentName?: string) {
    const normalized = (agentName || '').toLowerCase();

    if (normalized.includes('legal') || normalized.includes('lex') || normalized.includes('zeta')) {
      return 'You are Venxa Legal AI. Give practical, structured legal information in clear language. Do not claim to be a licensed lawyer. Suggest consulting a qualified professional for jurisdiction-specific advice.';
    }

    if (normalized.includes('psych') || normalized.includes('psyche')) {
      return 'You are Venxa Psychology AI. Respond with empathy, emotional clarity, and grounded reflective guidance. Do not diagnose. Encourage professional help when a situation sounds serious or unsafe.';
    }

    return 'You are Venxa Astrology AI named Zeno. Respond with calm, premium, insightful guidance blending astrology-style interpretation with practical advice. Keep replies clear, warm, and specific.';
  }

  private async resolveConversationId(dto: ChatMessageDto) {
    if (dto.conversationId) {
      const existing = await this.prisma.chatConversation.findUnique({
        where: { id: dto.conversationId },
      });

      if (!existing) {
        throw new NotFoundException('Conversation not found');
      }

      return existing.id;
    }

    if (!dto.userId) {
      return null;
    }

    const conversation = await this.prisma.chatConversation.create({
      data: {
        userId: dto.userId,
        agentName: dto.agentName?.trim() || null,
        title: this.makeTitleFromText(dto.text),
      },
    });

    dto.conversationId = conversation.id;
    return conversation.id;
  }

  private async buildConversationTitle(conversationId: string | null, text: string) {
    if (!conversationId) {
      return undefined;
    }

    const count = await this.prisma.chatMessage.count({
      where: { conversationId, role: 'USER' },
    });

    if (count > 1) {
      const existing = await this.prisma.chatConversation.findUnique({
        where: { id: conversationId },
      });
      return existing?.title;
    }

    return this.makeTitleFromText(text);
  }

  private makeTitleFromText(text: string) {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    return trimmed.length > 36 ? `${trimmed.slice(0, 36)}...` : trimmed;
  }
}
