import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  private withDerivedStatus<T extends { cta: string; comingSoon: boolean; isActive: boolean }>(agent: T) {
    return {
      ...agent,
      cta: agent.comingSoon ? 'Coming Soon' : agent.isActive ? 'Subscribe Now' : 'Coming Soon',
    };
  }

  async getAllAgents() {
    const agents = await this.prisma.agent.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    return agents.map((agent) => this.withDerivedStatus(agent));
  }

  async getAgentById(id: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return this.withDerivedStatus(agent);
  }

  async createAgent(dto: CreateAgentDto) {
    const createdAgent = await this.prisma.agent.create({
      data: {
        ...dto,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        role: dto.role.trim(),
        domain: dto.domain.trim(),
        personality: dto.personality.trim(),
        cta: dto.comingSoon ? 'Coming Soon' : dto.isActive === false ? 'Coming Soon' : 'Subscribe Now',
        apiKeyRef: dto.apiKeyRef.trim(),
        iconKey: dto.iconKey.trim(),
        searchAliases: dto.searchAliases.map((item) => item.trim()).filter(Boolean),
      },
    });

    return this.withDerivedStatus(createdAgent);
  }

  async updateAgent(id: string, dto: UpdateAgentDto) {
    const existingAgent = await this.prisma.agent.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      throw new NotFoundException('Agent not found');
    }

    const nextComingSoon = dto.comingSoon ?? existingAgent.comingSoon;
    const nextIsActive = dto.isActive ?? existingAgent.isActive;

    const updatedAgent = await this.prisma.agent.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.role ? { role: dto.role.trim() } : {}),
        ...(dto.domain ? { domain: dto.domain.trim() } : {}),
        ...(dto.personality ? { personality: dto.personality.trim() } : {}),
        cta: nextComingSoon ? 'Coming Soon' : nextIsActive ? 'Subscribe Now' : 'Coming Soon',
        ...(dto.apiKeyRef ? { apiKeyRef: dto.apiKeyRef.trim() } : {}),
        ...(dto.iconKey ? { iconKey: dto.iconKey.trim() } : {}),
        ...(dto.totalExperts !== undefined ? { totalExperts: dto.totalExperts } : {}),
        ...(dto.comingSoon !== undefined ? { comingSoon: dto.comingSoon } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.searchAliases
          ? {
              searchAliases: dto.searchAliases.map((item) => item.trim()).filter(Boolean),
            }
          : {}),
      },
    });

    return this.withDerivedStatus(updatedAgent);
  }

  async deleteAgent(id: string) {
    await this.getAgentById(id);
    await this.prisma.agent.delete({
      where: { id },
    });

    return { success: true };
  }

  async getPlansForAgent(agentId: string) {
    await this.getAgentById(agentId);

    return this.prisma.agentPlan.findMany({
      where: {
        agentId,
        isActive: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });
  }

  async createPlan(agentId: string, dto: CreatePlanDto) {
    await this.getAgentById(agentId);

    return this.prisma.agentPlan.create({
      data: {
        agentId,
        title: dto.title.trim(),
        price: dto.price,
        description: dto.description?.trim() || null,
        features: dto.features.map((item) => item.trim()).filter(Boolean),
        cta: dto.cta.trim(),
        durationDays: dto.durationDays,
        isActive: dto.isActive ?? true,
        highlight: dto.highlight ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updatePlan(agentId: string, planId: string, dto: UpdatePlanDto) {
    await this.getAgentById(agentId);

    const existingPlan = await this.prisma.agentPlan.findFirst({
      where: { id: planId, agentId },
    });

    if (!existingPlan) {
      throw new NotFoundException('Plan not found');
    }

    return this.prisma.agentPlan.update({
      where: { id: planId },
      data: {
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
        ...(dto.features
          ? { features: dto.features.map((item) => item.trim()).filter(Boolean) }
          : {}),
        ...(dto.cta ? { cta: dto.cta.trim() } : {}),
        ...(dto.durationDays !== undefined ? { durationDays: dto.durationDays } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.highlight !== undefined ? { highlight: dto.highlight } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async deletePlan(agentId: string, planId: string) {
    await this.getAgentById(agentId);

    const existingPlan = await this.prisma.agentPlan.findFirst({
      where: { id: planId, agentId },
    });

    if (!existingPlan) {
      throw new NotFoundException('Plan not found');
    }

    await this.prisma.agentPlan.delete({
      where: { id: planId },
    });

    return { success: true };
  }
}
