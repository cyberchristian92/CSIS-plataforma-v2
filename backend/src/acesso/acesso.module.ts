import { Module } from '@nestjs/common';
import { AcessoService } from './acesso.service';
import { AcessoController } from './acesso.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [AcessoController],
  providers: [AcessoService],
  exports: [AcessoService],
})
export class AcessoModule {}
