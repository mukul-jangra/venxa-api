import { IsString } from 'class-validator';

export class StartExpertChatDto {
  @IsString()
  userId!: string;

  @IsString()
  expertId!: string;
}
