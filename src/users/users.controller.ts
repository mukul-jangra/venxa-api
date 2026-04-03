import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  listUsers() {
    return this.usersService.listUsers();
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.usersService.getUser(id);
  }

  @Patch(':id/profile')
  updateProfile(@Param('id') id: string, @Body() dto: UpdateUserProfileDto) {
    return this.usersService.updateProfile(id, dto);
  }

  @Patch(':id/settings')
  updateSettings(@Param('id') id: string, @Body() dto: UpdateUserSettingsDto) {
    return this.usersService.updateSettings(id, dto);
  }

  @Get(':id/privacy/summary')
  getPrivacySummary(@Param('id') id: string) {
    return this.usersService.getPrivacySummary(id);
  }

  @Get(':id/privacy/requests')
  listPrivacyRequests(@Param('id') id: string) {
    return this.usersService.listPrivacyRequests(id);
  }

  @Post(':id/privacy/export')
  exportUserData(@Param('id') id: string) {
    return this.usersService.exportUserData(id);
  }

  @Post(':id/privacy/clear-history')
  clearChatHistory(@Param('id') id: string) {
    return this.usersService.clearChatHistory(id);
  }

  @Post(':id/privacy/delete-request')
  requestAccountDeletion(@Param('id') id: string) {
    return this.usersService.requestAccountDeletion(id);
  }
}
