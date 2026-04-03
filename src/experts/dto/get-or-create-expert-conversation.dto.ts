import { IsString } from 'class-validator';

export class GetOrCreateExpertConversationDto {
  @IsString()
  userId!: string;

  @IsString()
  expertId!: string;
}
