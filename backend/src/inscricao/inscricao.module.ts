import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AuthModule } from '../auth/auth.module';
import {
  InscricaoController,
  InscricoesController,
} from './inscricao.controller';
import { InscricaoService } from './inscricao.service';

@Module({
  imports: [AuditoriaModule, AuthModule],
  controllers: [InscricaoController, InscricoesController],
  providers: [InscricaoService],
})
export class InscricaoModule {}
