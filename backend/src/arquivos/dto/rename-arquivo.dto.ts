import { IsString, MinLength } from 'class-validator';

export class RenameArquivoDto {
  @IsString()
  @MinLength(1)
  nome!: string;
}
