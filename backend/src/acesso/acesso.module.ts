import { Global, Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AcessoController } from './acesso.controller';
import { AcessoService } from './acesso.service';
import { EscopoGuard } from './escopo.guard';
import { EscopoService } from './escopo.service';

/// Global porque praticamente todo controller usa o EscopoGuard — importar
/// o módulo em cada um seria só ruído (e fácil de esquecer num módulo novo).
@Global()
@Module({
  imports: [AuditoriaModule],
  controllers: [AcessoController],
  providers: [AcessoService, EscopoService, EscopoGuard],
  exports: [AcessoService, EscopoService, EscopoGuard],
})
export class AcessoModule {}
