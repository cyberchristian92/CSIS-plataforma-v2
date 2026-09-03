import { IsString, MinLength } from 'class-validator';

export class CreateComentarioDto {
  @IsString()
  @MinLength(1)
  texto: string;
}
