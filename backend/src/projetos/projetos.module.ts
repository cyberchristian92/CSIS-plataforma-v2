import { Module } from '@nestjs/common';
import { ProjetosService } from './projetos.service';
import { ProjetosController } from './projetos.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AcessoModule } from '../acesso/acesso.module';

@Module({
  imports: [AuditoriaModule, AcessoModule],
  controllers: [ProjetosController],
  providers: [ProjetosService],
  exports: [ProjetosService],
})
export class ProjetosModule {}
