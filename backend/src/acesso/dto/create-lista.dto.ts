import { IsString, MinLength } from 'class-validator';

export class CreateListaDto {
  @IsString()
  @MinLength(1)
  nome: string;
}
