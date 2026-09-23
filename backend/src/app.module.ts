import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { AreasModule } from './areas/areas.module';
import { ProjetosModule } from './projetos/projetos.module';
import { MissoesModule } from './missoes/missoes.module';
import { ColunasModule } from './colunas/colunas.module';
import { MissaoLabelsModule } from './missao-labels/missao-labels.module';
import { ArquivosModule } from './arquivos/arquivos.module';
import { DocumentosModule } from './documentos/documentos.module';
import { PastasModule } from './pastas/pastas.module';
import { EntregasModule } from './entregas/entregas.module';
import { RevisoesModule } from './revisoes/revisoes.module';
import { ComentariosModule } from './comentarios/comentarios.module';
import { ChecklistModule } from './checklist/checklist.module';
import { ExportacaoModule } from './exportacao/exportacao.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { LaudoModule } from './laudo/laudo.module';
import { IntegridadeModule } from './integridade/integridade.module';
import { AcessoModule } from './acesso/acesso.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    WorkspacesModule,
    AreasModule,
    ProjetosModule,
    MissoesModule,
    ColunasModule,
    MissaoLabelsModule,
    ArquivosModule,
    DocumentosModule,
    PastasModule,
    EntregasModule,
    RevisoesModule,
    ComentariosModule,
    ChecklistModule,
    ExportacaoModule,
    AuditoriaModule,
    LaudoModule,
    IntegridadeModule,
    AcessoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
