import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import type { Papel } from '../src/common/constants/papeis';
import { URL_API_TESTE, URL_BANCO_TESTE } from './env-teste';

export const SENHA_PADRAO = 'SenhaForte123';

/// `app` é a URL do servidor de teste (backend compilado, ver global-setup);
/// `prisma` fala direto com o banco de testes, só para preparar cenários e
/// conferir efeitos colaterais que a API não expõe.
export interface Contexto {
  app: string;
  prisma: PrismaClient;
}

export function criarApp(): Promise<Contexto> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: URL_BANCO_TESTE }),
  });
  return Promise.resolve({ app: URL_API_TESTE, prisma });
}

export async function encerrar(ctx: Contexto): Promise<void> {
  await ctx.prisma.$disconnect();
}

export function api(ctx: Contexto) {
  return request(ctx.app);
}

let contador = 0;

export async function criarUsuario(ctx: Contexto, papel: Papel, nome?: string) {
  contador += 1;
  const email = `${papel.toLowerCase()}-${Date.now()}-${contador}@teste.local`;
  const user = await ctx.prisma.user.create({
    data: {
      nome: nome ?? `${papel} ${contador}`,
      email,
      senha_hash: await bcrypt.hash(SENHA_PADRAO, 4),
      papel_global: papel,
    },
  });
  return { ...user, email };
}

/// Agente com cookie de sessão já estabelecido (login de verdade pela API).
export async function logar(ctx: Contexto, email: string): Promise<TestAgent> {
  const agente = request.agent(ctx.app);
  await agente
    .post('/auth/login')
    .send({ email, senha: SENHA_PADRAO })
    .expect(200);
  return agente;
}

export async function criarUsuarioLogado(
  ctx: Contexto,
  papel: Papel,
  nome?: string,
) {
  const user = await criarUsuario(ctx, papel, nome);
  return { user, agente: await logar(ctx, user.email) };
}

export async function criarHierarquia(ctx: Contexto, criadoPorId?: string) {
  const workspace = await ctx.prisma.workspace.create({
    data: { nome: `WS ${Date.now()}` },
  });
  const area = await ctx.prisma.area.create({
    data: {
      workspace_id: workspace.id,
      nome: 'Perícia',
      tipo: 'PERICIA',
      criado_por_id: criadoPorId,
    },
  });
  const projeto = await ctx.prisma.projeto.create({
    data: {
      area_id: area.id,
      nome: 'Caso',
      criado_por_id: criadoPorId,
      colunas: { create: [{ nome: 'Pendente', ordem: 0 }] },
    },
  });
  return { workspace, area, projeto };
}

/// Aloca o usuário no projeto do jeito mais comum na prática: como
/// responsável por uma missão. Colaborador só enxerga projeto onde está
/// alocado (ver visibilidade.e2e-spec.ts).
export async function alocar(ctx: Contexto, projetoId: string, userId: string) {
  return ctx.prisma.missao.create({
    data: {
      projeto_id: projetoId,
      titulo: `Alocação ${userId.slice(0, 8)}`,
      responsaveis: { create: { user_id: userId } },
    },
  });
}
