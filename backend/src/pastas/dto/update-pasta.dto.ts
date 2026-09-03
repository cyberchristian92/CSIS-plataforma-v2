import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePastaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nome?: string;

  @IsOptional()
  @IsString()
  pastaPaiId?: string;
}
