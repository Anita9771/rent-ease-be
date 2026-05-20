import { IsString, MaxLength } from 'class-validator';

export class CreateComplaintCommentDto {
  @IsString()
  @MaxLength(1500)
  message!: string;
}

