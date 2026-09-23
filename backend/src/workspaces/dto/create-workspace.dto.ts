import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000) // ~1.5MB em base64 — suficiente pra logo, evita abuso
  @Matches(/^data:image\/(png|jpeg|jpg|svg\+xml|webp);base64,/, {
    message: 'logo_data_url precisa ser uma data URI de imagem (png/jpeg/svg/webp).',
  })
  logo_data_url?: string;
}
