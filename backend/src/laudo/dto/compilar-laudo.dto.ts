import { IsOptional, IsString } from 'class-validator';

export class CompilarLaudoDto {
  // Id de um Arquivo (.latex) já enviado na raiz do Projeto, pra usar como
  // template do Pandoc no lugar do Eisvogel embutido no motor de compilação.
  // Ausente/undefined = usa o template padrão (eisvogel).
  @IsOptional()
  @IsString()
  templateArquivoId?: string;
}
