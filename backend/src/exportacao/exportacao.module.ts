import { Module } from '@nestjs/common';
import { ExportacaoService } from './exportacao.service';
import { ExportacaoController } from './exportacao.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [ExportacaoController],
  providers: [ExportacaoService],
})
export class ExportacaoModule {}
