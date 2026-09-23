import { IsOptional, IsString } from 'class-validator';

export class CreateEntregaDto {
  @IsOptional()
  @IsString()
  conteudo?: string;
}
