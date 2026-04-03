import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateUserSettingsDto {
  @IsString() @IsOptional() responseTone?: string;
  @IsString() @IsOptional() responseDepth?: string;
  @IsBoolean() @IsOptional() astrologyEnabled?: boolean;
  @IsBoolean() @IsOptional() psychologyEnabled?: boolean;
  @IsBoolean() @IsOptional() legalEnabled?: boolean;
  @IsArray() @IsString({ each: true }) @IsOptional() focusAreas?: string[];
  @IsString() @IsOptional() beliefSystem?: string;
  @IsString() @IsOptional() guidanceType?: string;
  @IsBoolean() @IsOptional() notifyDailyInsight?: boolean;
  @IsBoolean() @IsOptional() notifyWeeklyReport?: boolean;
  @IsBoolean() @IsOptional() notifyAlerts?: boolean;
  @IsBoolean() @IsOptional() notifyEmailUpdates?: boolean;
  @IsBoolean() @IsOptional() notifySmartNudges?: boolean;
  @IsBoolean() @IsOptional() allowAiLearning?: boolean;
  @IsBoolean() @IsOptional() anonymousMode?: boolean;
  @IsBoolean() @IsOptional() storeChatHistory?: boolean;
  @IsBoolean() @IsOptional() autoDeleteAfter90Days?: boolean;
  @IsBoolean() @IsOptional() twoFactorEnabled?: boolean;
  @IsBoolean() @IsOptional() biometricLock?: boolean;
  @IsString() @IsOptional() currentPlanLabel?: string;
  @IsInt() @Min(0) @IsOptional() creditsRemaining?: number;
  @IsInt() @Min(0) @Max(100) @IsOptional() usageChatsPercent?: number;
  @IsInt() @Min(0) @Max(100) @IsOptional() usageCallsPercent?: number;
  @IsInt() @Min(0) @Max(100) @IsOptional() usageConsultsPercent?: number;
  @IsInt() @Min(0) @IsOptional() walletBalance?: number;
  @IsBoolean() @IsOptional() autoRecharge?: boolean;
  @IsInt() @Min(0) @IsOptional() autoRechargeThreshold?: number;
  @IsInt() @Min(0) @IsOptional() autoRechargeAmount?: number;
  @IsString() @IsOptional() paymentMethod?: string;
  @IsBoolean() @IsOptional() googleCalendarConnected?: boolean;
  @IsBoolean() @IsOptional() appleHealthConnected?: boolean;
  @IsBoolean() @IsOptional() notesConnected?: boolean;
  @IsString() @IsOptional() themeChoice?: string;
}
