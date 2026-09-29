import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/email.service';
import { urlFrontend } from '../auth/auth.service';
import {
  EVT_INSCRICAO_PENDENTE,
  type InscricaoPendente,
} from './inscricao.events';

/// Cadastro novo na fila: quem pode aprová-lo (Admin e Coordenador ativos)
/// recebe um e-mail com o link direto para as solicitações — sem isso o
/// pedido só era visto se alguém fosse procurar.
@Injectable()
export class AvisoEquipeListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  @OnEvent(EVT_INSCRICAO_PENDENTE)
  async avisar({ userId }: InscricaoPendente) {
    const candidato = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nome: true, email: true },
    });
    if (!candidato) return;
    const equipe = await this.prisma.user.findMany({
      where: { situacao: 'ATIVO', papel_global: { in: ['ADMIN', 'LIDER'] } },
      select: { email: true },
    });
    await Promise.all(
      equipe.map((pessoa) =>
        this.emailService.enviar({
          para: pessoa.email,
          assunto: 'Nova solicitação de cadastro — {{instancia}}',
          texto:
            `${candidato.nome} (${candidato.email}) pediu acesso à plataforma da {{instancia}}.\n\n` +
            'Analise o pedido e, se aprovar, defina o papel, as equipes e as áreas da pessoa:\n' +
            urlFrontend('/usuarios?aba=solicitacoes'),
        }),
      ),
    );
  }
}
