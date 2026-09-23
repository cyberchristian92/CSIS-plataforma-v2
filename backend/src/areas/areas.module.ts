import { Module } from '@nestjs/common';
import { AreasService } from './areas.service';
import { AreasController } from './areas.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AcessoModule } from '../acesso/acesso.module';

@Module({
  imports: [AuditoriaModule, AcessoModule],
  controllers: [AreasController],
  providers: [AreasService],
  exports: [AreasService],
})
export class AreasModule {}
