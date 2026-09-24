import request from 'supertest';
import {
  Contexto,
  criarApp,
  criarUsuarioLogado,
  encerrar,
  ultimoEmail,
} from './helpers';

function emailUnico(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.local`;
}

/// Cadastro público com aprovação e formulário configurável pela equipe.
describe('Inscrição (cadastro público com aprovação)', () => {
  let ctx: Contexto;

  beforeAll(async () => {
    ctx = await criarApp();
  });
  afterAll(async () => {
    await encerrar(ctx);
  });

  async function montarFormulario() {
    // Cada cenário monta o próprio formulário do zero — campos de outros
    // cenários (ou rodadas anteriores) ficariam misturados.
    await ctx.prisma.campoInscricao.updateMany({ data: { arquivado: true } });
    const revisor = await criarUsuarioLogado(ctx, 'REVISOR');
    const criar = (corpo: object) =>
      revisor.agente.post('/inscricao/campos').send(corpo).expect(201);
    const telefone = await criar({
      rotulo: 'Telefone',
      tipo: 'TELEFONE',
      obrigatorio: true,
    });
    const nivel = await criar({
      rotulo: 'Nível',
      tipo: 'SELECAO',
      obrigatorio: true,
      opcoes: ['Iniciante', 'Intermediário', 'Avançado'],
    });
    const nda = await criar({
      rotulo: 'Aceito o termo de confidencialidade',
      tipo: 'ACEITE',
      obrigatorio: true,
    });
    const cv = await criar({
      rotulo: 'Currículo',
      tipo: 'ARQUIVO',
      obrigatorio: false,
    });
    return {
      revisor,
      campos: {
        telefone: telefone.body.id,
        nivel: nivel.body.id,
        nda: nda.body.id,
        cv: cv.body.id,
      },
    };
  }

  function inscrever(
    email: string,
    respostas: Record<string, unknown>,
    anexo?: { campo: string; nome: string },
  ) {
    const req = request(ctx.app)
      .post('/inscricao')
      .field('nome', 'Aluno Novo')
      .field('email', email)
      .field('senha', 'SenhaDoAluno1')
      .field('respostas', JSON.stringify(respostas));
    return anexo
      ? req.attach(
          `anexo_${anexo.campo}`,
          Buffer.from('%PDF-1.4 cv'),
          anexo.nome,
        )
      : req;
  }

  it('fluxo completo: formulário → inscrição → confirma e-mail → aprovação → entra', async () => {
    const { campos } = await montarFormulario();
    const formulario = await request(ctx.app)
      .get('/inscricao/formulario')
      .expect(200);
    expect(formulario.body.aberto).toBe(true);
    expect(
      formulario.body.campos.map((c: { rotulo: string }) => c.rotulo),
    ).toEqual([
      'Telefone',
      'Nível',
      'Aceito o termo de confidencialidade',
      'Currículo',
    ]);

    const email = emailUnico('aluno');
    await inscrever(
      email,
      {
        [campos.telefone]: '(91) 99999-0000',
        [campos.nivel]: 'Iniciante',
        [campos.nda]: true,
      },
      { campo: campos.cv, nome: 'currículo.pdf' },
    ).expect(201);

    // Antes de confirmar o e-mail: não entra, e a mensagem diz o porquê.
    const antes = await request(ctx.app)
      .post('/auth/login')
      .send({ email, senha: 'SenhaDoAluno1' })
      .expect(403);
    expect(antes.body.message).toMatch(/confirme/i);

    const { token } = ultimoEmail(email);
    await request(ctx.app)
      .post('/auth/confirmar-email')
      .send({ token })
      .expect(200);
    const pendente = await request(ctx.app)
      .post('/auth/login')
      .send({ email, senha: 'SenhaDoAluno1' })
      .expect(403);
    expect(pendente.body.message).toMatch(/aprova/i);

    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    const fila = await lider.agente
      .get('/inscricoes?situacao=PENDENTE')
      .expect(200);
    const minha = fila.body.find(
      (i: { user: { email: string } }) => i.user.email === email,
    );
    expect(minha.respostas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rotulo: 'Telefone',
          valor: '(91) 99999-0000',
        }),
        expect.objectContaining({ rotulo: 'Nível', valor: 'Iniciante' }),
      ]),
    );
    expect(minha.anexos).toEqual([
      expect.objectContaining({ nome: 'currículo.pdf' }),
    ]);
    await lider.agente
      .get(`/inscricoes/${minha.id}/anexos/${minha.anexos[0].id}`)
      .expect(200);

    await lider.agente
      .post(`/inscricoes/${minha.id}/aprovar`)
      .send({ papelGlobal: 'COLABORADOR' })
      .expect(201);
    expect(ultimoEmail(email).assunto).toMatch(/aprovad/i);
    await request(ctx.app)
      .post('/auth/login')
      .send({ email, senha: 'SenhaDoAluno1' })
      .expect(200);
  });

  it('valida as respostas conforme o formulário configurado', async () => {
    const { campos } = await montarFormulario();
    // Falta campo obrigatório
    await inscrever(emailUnico('a'), {
      [campos.nivel]: 'Iniciante',
      [campos.nda]: true,
    }).expect(400);
    // Opção que não existe
    await inscrever(emailUnico('b'), {
      [campos.telefone]: '1',
      [campos.nivel]: 'Expert',
      [campos.nda]: true,
    }).expect(400);
    // Termo obrigatório não aceito
    await inscrever(emailUnico('c'), {
      [campos.telefone]: '1',
      [campos.nivel]: 'Iniciante',
      [campos.nda]: false,
    }).expect(400);
  });

  it('e-mail já cadastrado: responde igual (não revela quem tem conta) e não duplica', async () => {
    const { campos } = await montarFormulario();
    const existente = await criarUsuarioLogado(ctx, 'COLABORADOR');
    await inscrever(existente.user.email, {
      [campos.telefone]: '1',
      [campos.nivel]: 'Iniciante',
      [campos.nda]: true,
    }).expect(201);
    const usuario = await ctx.prisma.user.findUniqueOrThrow({
      where: { email: existente.user.email },
    });
    expect(usuario.situacao).toBe('ATIVO');
  });

  it('robô que preenche o campo-armadilha é descartado em silêncio', async () => {
    const { campos } = await montarFormulario();
    const email = emailUnico('robo');
    await inscrever(email, {
      [campos.telefone]: '1',
      [campos.nivel]: 'Iniciante',
      [campos.nda]: true,
    })
      .field('site', 'http://spam.example')
      .expect(201);
    expect(await ctx.prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it('recusa com observação; recusado não entra', async () => {
    const { campos } = await montarFormulario();
    const email = emailUnico('recusado');
    await inscrever(email, {
      [campos.telefone]: '1',
      [campos.nivel]: 'Iniciante',
      [campos.nda]: true,
    }).expect(201);
    await request(ctx.app)
      .post('/auth/confirmar-email')
      .send({ token: ultimoEmail(email).token })
      .expect(200);
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    const user = await ctx.prisma.user.findUniqueOrThrow({
      where: { email },
      include: { inscricao: true },
    });
    await admin.agente
      .post(`/inscricoes/${user.inscricao!.id}/recusar`)
      .send({ observacao: 'Perfil fora do escopo atual' })
      .expect(201);
    await request(ctx.app)
      .post('/auth/login')
      .send({ email, senha: 'SenhaDoAluno1' })
      .expect(401);
  });

  it('permissões: revisor edita o formulário e consulta, mas não aprova; colaborador não vê nada', async () => {
    const { revisor, campos } = await montarFormulario();
    const colab = await criarUsuarioLogado(ctx, 'COLABORADOR');
    await colab.agente
      .post('/inscricao/campos')
      .send({ rotulo: 'X', tipo: 'TEXTO' })
      .expect(403);
    await colab.agente.get('/inscricoes').expect(403);

    const email = emailUnico('perm');
    await inscrever(email, {
      [campos.telefone]: '1',
      [campos.nivel]: 'Iniciante',
      [campos.nda]: true,
    }).expect(201);
    await request(ctx.app)
      .post('/auth/confirmar-email')
      .send({ token: ultimoEmail(email).token })
      .expect(200);
    const user = await ctx.prisma.user.findUniqueOrThrow({
      where: { email },
      include: { inscricao: true },
    });
    await revisor.agente.get('/inscricoes?situacao=PENDENTE').expect(200);
    await revisor.agente
      .post(`/inscricoes/${user.inscricao!.id}/aprovar`)
      .send({ papelGlobal: 'COLABORADOR' })
      .expect(403);

    const lider = await criarUsuarioLogado(ctx, 'LIDER');
    await lider.agente
      .post(`/inscricoes/${user.inscricao!.id}/aprovar`)
      .send({ papelGlobal: 'ADMIN' })
      .expect(403);
  });

  it('editar ou arquivar um campo não altera respostas já enviadas', async () => {
    const { revisor, campos } = await montarFormulario();
    const email = emailUnico('snapshot');
    await inscrever(email, {
      [campos.telefone]: '555',
      [campos.nivel]: 'Avançado',
      [campos.nda]: true,
    }).expect(201);
    await revisor.agente
      .patch(`/inscricao/campos/${campos.telefone}`)
      .send({ rotulo: 'Celular' })
      .expect(200);
    await revisor.agente
      .delete(`/inscricao/campos/${campos.nivel}`)
      .expect(200);

    const formulario = await request(ctx.app)
      .get('/inscricao/formulario')
      .expect(200);
    const rotulos = formulario.body.campos.map(
      (c: { rotulo: string }) => c.rotulo,
    );
    expect(rotulos).toContain('Celular');
    expect(rotulos).not.toContain('Nível');

    const user = await ctx.prisma.user.findUniqueOrThrow({
      where: { email },
      include: { inscricao: true },
    });
    expect(user.inscricao!.respostas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rotulo: 'Telefone', valor: '555' }),
        expect.objectContaining({ rotulo: 'Nível', valor: 'Avançado' }),
      ]),
    );
  });

  it('formulário externo: a equipe configura o link e ele aparece no cadastro público', async () => {
    const revisor = await criarUsuarioLogado(ctx, 'REVISOR');
    await revisor.agente
      .put('/inscricao/configuracao')
      .send({ link_externo: 'javascript:alert(1)', instrucao_externa: 'x' })
      .expect(400);
    await revisor.agente
      .put('/inscricao/configuracao')
      .send({
        link_externo: 'https://forms.gle/exemplo',
        instrucao_externa: 'Conte sua experiência e envie seu portfólio.',
      })
      .expect(200);
    const formulario = await request(ctx.app)
      .get('/inscricao/formulario')
      .expect(200);
    expect(formulario.body.formulario_externo).toEqual({
      link: 'https://forms.gle/exemplo',
      instrucao: 'Conte sua experiência e envie seu portfólio.',
    });

    const colab = await criarUsuarioLogado(ctx, 'COLABORADOR');
    await colab.agente
      .put('/inscricao/configuracao')
      .send({ link_externo: null })
      .expect(403);

    await revisor.agente
      .put('/inscricao/configuracao')
      .send({ link_externo: null, instrucao_externa: null })
      .expect(200);
    const semLink = await request(ctx.app)
      .get('/inscricao/formulario')
      .expect(200);
    expect(semLink.body.formulario_externo).toBeNull();
  });

  it('equipe pode aprovar quem ainda não confirmou o e-mail (verificação manual)', async () => {
    const { campos } = await montarFormulario();
    const email = emailUnico('manual');
    await inscrever(email, {
      [campos.telefone]: '1',
      [campos.nivel]: 'Iniciante',
      [campos.nda]: true,
    }).expect(201);
    const user = await ctx.prisma.user.findUniqueOrThrow({
      where: { email },
      include: { inscricao: true },
    });
    expect(user.situacao).toBe('AGUARDANDO_EMAIL');
    const admin = await criarUsuarioLogado(ctx, 'ADMIN');
    await admin.agente
      .post(`/inscricoes/${user.inscricao!.id}/aprovar`)
      .send({ papelGlobal: 'COLABORADOR' })
      .expect(201);
    await request(ctx.app)
      .post('/auth/login')
      .send({ email, senha: 'SenhaDoAluno1' })
      .expect(200);
  });

  it('reordena os campos e recusa seleção sem opções', async () => {
    const { revisor, campos } = await montarFormulario();
    await revisor.agente
      .post('/inscricao/campos')
      .send({ rotulo: 'Área', tipo: 'SELECAO', opcoes: [] })
      .expect(400);
    await revisor.agente
      .put('/inscricao/campos/ordem')
      .send({ ids: [campos.cv, campos.nda, campos.nivel, campos.telefone] })
      .expect(200);
    const formulario = await request(ctx.app)
      .get('/inscricao/formulario')
      .expect(200);
    const ids = formulario.body.campos.map((c: { id: string }) => c.id);
    expect(ids.slice(0, 4)).toEqual([
      campos.cv,
      campos.nda,
      campos.nivel,
      campos.telefone,
    ]);
  });
});
