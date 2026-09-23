import { IsString, MinLength } from 'class-validator';

export class AddMembroDto {
  @IsString()
  @MinLength(1)
  userId: string;
}
