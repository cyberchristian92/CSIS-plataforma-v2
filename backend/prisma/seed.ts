import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/// Cria um usuário ADMIN padrão (e um workspace de exemplo) na primeira vez
/// que o banco é migrado — sem isso, um banco novo fica sem nenhum usuário e
/// não tem como logar (o cadastro é fechado: só ADMIN/LIDER podem convidar
/// alguém). Idempotente: não faz nada se já existir qualquer usuário, então
/// rodar de novo num banco que já tem dados reais é seguro.
async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  try {
    const totalUsuarios = await prisma.user.count();
    if (totalUsuarios > 0) {
      console.log(`[seed] Banco já tem ${totalUsuarios} usuário(s) — nada a fazer.`);
      return;
    }

    const nome = process.env.SEED_ADMIN_NOME ?? 'Administrador';
    const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@csis.local';
    const senha = process.env.SEED_ADMIN_SENHA ?? 'TrocarSenha123';

    const senha_hash = await bcrypt.hash(senha, SALT_ROUNDS);
    const admin = await prisma.user.create({
      data: { nome, email, senha_hash, papel_global: 'ADMIN' },
    });
    console.log(`[seed] Usuário ADMIN criado: ${email} — troque a senha padrão depois do primeiro login.`);

    const workspace = await prisma.workspace.create({
      data: {
        nome: 'Workspace de Exemplo',
        descricao: 'Criado automaticamente no primeiro boot — pode apagar quando quiser.',
        areas: {
          create: {
            nome: 'Perícia',
            tipo: 'PERICIA',
            projetos: {
              create: {
                nome: 'Projeto de Exemplo',
                descricao: 'Projeto de demonstração criado pelo seed inicial.',
                status: 'ATIVO',
                // Board Kanban nasce com as mesmas 5 colunas que existiam
                // como status antes — livres pra renomear/reordenar depois.
                colunas: {
                  create: [
                    { nome: 'Pendente', ordem: 0 },
                    { nome: 'Em Andamento', ordem: 1 },
                    { nome: 'Em Revisão', ordem: 2 },
                    { nome: 'Aprovada', ordem: 3 },
                    { nome: 'Rejeitada', ordem: 4 },
                  ],
                },
              },
            },
          },
        },
      },
      include: { areas: { include: { projetos: { include: { colunas: true } } } } },
    });

    const projetoExemplo = workspace.areas[0].projetos[0];
    const primeiraColuna = projetoExemplo.colunas.find((c) => c.ordem === 0);
    await prisma.missao.create({
      data: {
        projeto_id: projetoExemplo.id,
        titulo: 'Missão de exemplo',
        descricao: 'Edite ou apague — isso é só pra você não abrir o app numa tela vazia.',
        status: 'PENDENTE',
        coluna_id: primeiraColuna?.id,
        responsaveis: { create: { user_id: admin.id } },
      },
    });
    console.log('[seed] Workspace de exemplo criado.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed] Falhou:', err);
  process.exit(1);
});
