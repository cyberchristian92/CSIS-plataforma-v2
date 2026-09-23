import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateChecklistItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  texto?: string;

  @IsOptional()
  @IsBoolean()
  concluido?: boolean;
}
