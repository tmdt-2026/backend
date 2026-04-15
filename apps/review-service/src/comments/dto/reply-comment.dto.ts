import { IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ReplyCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  content: string;
}
