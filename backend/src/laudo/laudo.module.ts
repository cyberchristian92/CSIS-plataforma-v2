import { Module } from '@nestjs/common';
import { LaudoService } from './laudo.service';
import { LaudoCompilerService } from './laudo-compiler.service';
import { LaudoController } from './laudo.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [LaudoController],
  providers: [LaudoService, LaudoCompilerService],
})
export class LaudoModule {}
