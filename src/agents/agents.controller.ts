import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  async getAllAgents() {
    return this.agentsService.getAllAgents();
  }

  @Get(':id')
  async getAgentById(@Param('id') id: string) {
    return this.agentsService.getAgentById(id);
  }

  @Post()
  async createAgent(@Body() dto: CreateAgentDto) {
    return this.agentsService.createAgent(dto);
  }

  @Patch(':id')
  async updateAgent(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.agentsService.updateAgent(id, dto);
  }

  @Delete(':id')
  async deleteAgent(@Param('id') id: string) {
    return this.agentsService.deleteAgent(id);
  }

  @Get(':id/plans')
  async getPlansForAgent(@Param('id') id: string) {
    return this.agentsService.getPlansForAgent(id);
  }

  @Post(':id/plans')
  async createPlan(@Param('id') id: string, @Body() dto: CreatePlanDto) {
    return this.agentsService.createPlan(id, dto);
  }

  @Patch(':id/plans/:planId')
  async updatePlan(
    @Param('id') id: string,
    @Param('planId') planId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.agentsService.updatePlan(id, planId, dto);
  }

  @Delete(':id/plans/:planId')
  async deletePlan(@Param('id') id: string, @Param('planId') planId: string) {
    return this.agentsService.deletePlan(id, planId);
  }
}
