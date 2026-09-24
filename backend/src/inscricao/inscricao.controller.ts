import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { uploadsTmpDir } from '../arquivos/utils/armazenamento';
import { InscricaoService } from './inscricao.service';
import {
  AtualizarCampoDto,
  ConfiguracaoInscricaoDto,
  CriarCampoDto,
  OrdenarCamposDto,
} from './dto/campo-inscricao.dto';
import {
  AprovarInscricaoDto,
  RecusarInscricaoDto,
} from './dto/decisao-inscricao.dto';
import { InscreverDto } from './dto/inscrever.dto';

const LIMITE_ANEXO_MB = Number(process.env.MAX_ANEXO_INSCRICAO_MB ?? 10);
const LIMITE_CADASTROS_POR_HORA = Number(
  process.env.CADASTRO_LIMITE_POR_HORA ?? 10,
);

/// Cadastro é público: anexos com tamanho e quantidade limitados, direto em
/// disco (nunca na memória), e poucos envios por hora por IP.
const opcoesAnexosInscricao = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const destino = uploadsTmpDir();
      mkdirSync(destino, { recursive: true });
      cb(null, destino);
    },
    filename: (_req, _file, cb) => cb(null, randomUUID()),
  }),
  limits: {
    fileSize: LIMITE_ANEXO_MB * 1024 * 1024,
    files: 10,
    fields: 20,
    fieldSize: 256 * 1024,
  },
};

/// Formulário de inscrição: leitura pública; edição pela equipe (Admin,
/// Coordenador e Revisor — decisão de produto: quem avalia candidatos
/// também decide o que perguntar a eles).
@Controller('inscricao')
export class InscricaoController {
  constructor(private readonly inscricaoService: InscricaoService) {}

  @Get('formulario')
  formulario() {
    return this.inscricaoService.formularioPublico();
  }

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: LIMITE_CADASTROS_POR_HORA, ttl: 60 * 60 * 1000 },
  })
  @UseInterceptors(AnyFilesInterceptor(opcoesAnexosInscricao))
  inscrever(
    @Body() dto: InscreverDto,
    @UploadedFiles() arquivos: Express.Multer.File[] | undefined,
  ) {
    return this.inscricaoService.inscrever(dto, arquivos ?? []);
  }

  @Get('configuracao')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LIDER', 'REVISOR')
  configuracao() {
    return this.inscricaoService.configuracao();
  }

  @Put('configuracao')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LIDER', 'REVISOR')
  definirConfiguracao(
    @Body() dto: ConfiguracaoInscricaoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inscricaoService.definirConfiguracao(dto, user.id);
  }

  @Get('campos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LIDER', 'REVISOR')
  listarCampos(
    @Query('arquivados', new ParseBoolPipe({ optional: true }))
    arquivados?: boolean,
  ) {
    return this.inscricaoService.listarCampos(arquivados ?? false);
  }

  @Post('campos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LIDER', 'REVISOR')
  criarCampo(
    @Body() dto: CriarCampoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inscricaoService.criarCampo(dto, user.id);
  }

  @Put('campos/ordem')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LIDER', 'REVISOR')
  ordenarCampos(
    @Body() dto: OrdenarCamposDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inscricaoService.ordenarCampos(dto.ids, user.id);
  }

  @Patch('campos/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LIDER', 'REVISOR')
  atualizarCampo(
    @Param('id') id: string,
    @Body() dto: AtualizarCampoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inscricaoService.atualizarCampo(id, dto, user.id);
  }

  @Delete('campos/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LIDER', 'REVISOR')
  arquivarCampo(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inscricaoService.arquivarCampo(id, user.id);
  }
}

/// Fila de inscrições: a equipe (inclusive Revisor) consulta; só Admin e
/// Coordenador decidem, porque aprovar é também definir o papel da pessoa.
@Controller('inscricoes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InscricoesController {
  constructor(private readonly inscricaoService: InscricaoService) {}

  @Get()
  @Roles('ADMIN', 'LIDER', 'REVISOR')
  listar(@Query('situacao') situacao?: string) {
    return this.inscricaoService.listar(situacao);
  }

  @Get(':id/anexos/:anexoId')
  @Roles('ADMIN', 'LIDER', 'REVISOR')
  async anexo(
    @Param('id') id: string,
    @Param('anexoId') anexoId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const anexo = await this.inscricaoService.anexo(id, anexoId, user.id);
    res.set({
      'Content-Type': anexo.tipo_mime,
      'Content-Disposition': `attachment; filename="${anexo.nome.replace(/[^\x20-\x7e]|"/g, '_')}"; filename*=UTF-8''${encodeURIComponent(anexo.nome)}`,
      'X-Hash-Sha256': anexo.hash_sha256,
    });
    res.sendFile(anexo.caminho);
  }

  @Post(':id/aprovar')
  @Roles('ADMIN', 'LIDER')
  aprovar(
    @Param('id') id: string,
    @Body() dto: AprovarInscricaoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inscricaoService.aprovar(id, dto.papelGlobal, dto.observacao, {
      id: user.id,
      papel: user.papel_global,
    });
  }

  @Post(':id/recusar')
  @Roles('ADMIN', 'LIDER')
  recusar(
    @Param('id') id: string,
    @Body() dto: RecusarInscricaoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inscricaoService.recusar(id, dto.observacao, user.id);
  }
}
