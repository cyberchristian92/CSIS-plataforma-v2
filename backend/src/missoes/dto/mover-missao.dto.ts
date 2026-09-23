import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class MoverMissaoDto {
  // `undefined`/omitido e `null` são equivalentes aqui: card vai pro bucket
  // "Sem coluna". Sempre aceito, sem checagem de regra de negócio — é o
  // endpoint de drag-and-drop livre do board.
  @IsOptional()
  @IsString()
  colunaId?: string | null;

  @IsInt()
  @Min(0)
  ordem: number;
}
